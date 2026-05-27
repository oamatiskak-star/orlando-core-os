import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAffiliateIntelligenceEngine } from '@/ai-os/affiliate-intelligence'
import {
  isAffiliateAvailableInCountry,
  getCountryStrategy,
  getAllRestrictions,
} from '@/ai-os/affiliate-intelligence/country-compliance'

export const revalidate = 0

function detectCountryFromRequest(req: NextRequest): string {
  // Priority: body > header > IP geolocation > default
  const header = req.headers.get('x-viewer-country')
  if (header && /^[A-Z]{2}$/.test(header)) return header

  // Try CloudFlare country header (common in edge networks)
  const cfCountry = req.headers.get('cf-ipcountry')
  if (cfCountry && /^[A-Z]{2}$/.test(cfCountry)) return cfCountry

  // Default to NL (Netherlands - primary market)
  return 'NL'
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { channel_id, viewer_country } = body

  if (!channel_id) {
    return NextResponse.json({ error: 'channel_id required' }, { status: 400 })
  }

  try {
    // Get channel details
    const { data: channelData } = await supabase
      .from('media_holding_channels')
      .select('id, name, niche')
      .eq('id', channel_id)
      .single()

    if (!channelData) {
      return NextResponse.json({ error: 'Channel not found' }, { status: 404 })
    }

    // Detect viewer country
    const detectedCountry = viewer_country || detectCountryFromRequest(req)
    const countryStrategy = getCountryStrategy(detectedCountry)

    // Create recommendation engine
    const engine = createAffiliateIntelligenceEngine(supabase)

    // Build recommendation request with country-aware configuration
    const recommendationRequest = {
      video_id: 'query-' + channel_id,
      channel_id: channelData.name || 'unknown',
      content_metadata: {
        title: `${channelData.name} - Affiliate Selection`,
        description: `Find best affiliates for ${channelData.name} channel`,
        keywords: channelData.niche ? [channelData.niche] : [],
        topic: channelData.niche || 'general',
        audience_target: channelData.niche || 'general',
      },
      audience_profile: {
        audience_type: channelData.niche || 'general',
        primary_countries: countryStrategy
          ? [detectedCountry, ...countryStrategy.affiliate_preferences.slice(0, 2)]
          : ['NL', 'BE', 'DE'],
        interests: channelData.niche ? [channelData.niche] : [],
      },
      viewer_country: detectedCountry,
      count: 3,
    }

    const response = await engine.recommend(recommendationRequest)

    if (!response || !response.recommendations) {
      return NextResponse.json(
        { error: 'No recommendations available' },
        { status: 500 }
      )
    }

    // Filter and enhance recommendations with country compliance info
    const enhancedRecommendations = response.recommendations
      .filter((rec) => {
        // Only include affiliates available in viewer's country
        return isAffiliateAvailableInCountry(detectedCountry, rec.affiliate_id)
      })
      .map((rec) => ({
        ...rec,
        country_restrictions: getAllRestrictions(detectedCountry, rec.affiliate_id),
        country_code: detectedCountry,
      }))

    return NextResponse.json({
      recommendations: enhancedRecommendations,
      channel_id,
      viewer_country: detectedCountry,
      country_notes: countryStrategy?.notes || 'Default market settings',
    })
  } catch (error) {
    console.error('Recommendation error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate recommendations' },
      { status: 500 }
    )
  }
}
