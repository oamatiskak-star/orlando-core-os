import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAffiliateIntelligenceEngine } from '@/ai-os/affiliate-intelligence'

export const revalidate = 0

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { channel_id } = body

  if (!channel_id) {
    return NextResponse.json({ error: 'channel_id required' }, { status: 400 })
  }

  try {
    // Get channel details to use for recommendations
    const { data: channelData } = await supabase
      .from('media_holding_channels')
      .select('id, name, niche')
      .eq('id', channel_id)
      .single()

    if (!channelData) {
      return NextResponse.json({ error: 'Channel not found' }, { status: 404 })
    }

    // Create recommendation engine with database support
    const engine = createAffiliateIntelligenceEngine(supabase)

    // Build recommendation request based on channel
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
        primary_countries: ['NL', 'BE', 'DE'],
        interests: channelData.niche ? [channelData.niche] : [],
      },
      viewer_country: 'NL',
      count: 3,
    }

    const response = await engine.recommend(recommendationRequest)

    if (!response || !response.recommendations) {
      return NextResponse.json(
        { error: 'No recommendations available' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      recommendations: response.recommendations,
      channel_id,
    })
  } catch (error) {
    console.error('Recommendation error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate recommendations' },
      { status: 500 }
    )
  }
}
