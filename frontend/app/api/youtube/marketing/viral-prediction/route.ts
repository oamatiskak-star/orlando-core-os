import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Viral prediction logic (moved from monitoring-agent to avoid import issues)
// In production, call the monitoring-agent service directly or use a shared library
async function predictViral(
  channelId: string,
  metadata: any
): Promise<any> {
  // Simplified prediction - full version in monitoring-agent
  const viralScore = Math.min(
    50 +
    (metadata.title.length > 30 ? 10 : 0) +
    (metadata.tags?.length > 5 ? 10 : 0) +
    (metadata.description?.length > 100 ? 10 : 0) +
    (metadata.title.match(/\d+/) ? 5 : 0),
    100
  )

  return {
    viralScore,
    confidence: 0.75,
    recommendation: viralScore >= 80 ? '🚀 PUBLISH NOW' : viralScore >= 60 ? '✅ Good to go' : '⚠️ Needs work',
    estimatedViews: Math.round((viralScore / 50) * 5000),
    estimatedCTR: (viralScore / 100) * 0.05,
    trendingFactors: [],
    seasonalFactor: 1.0,
    risks: [],
    opportunities: []
  }
}

async function analyzeVideoContent(
  videoId: string,
  metadata: any
): Promise<any> {
  return {
    contentScore: 60,
    topics: metadata.tags || [],
    sentiment: 'neutral'
  }
}

async function storePrediction(videoId: string, channelId: string, prediction: any, metadata: any): Promise<void> {
  try {
    await supabase.from('viral_predictions').insert({
      video_id: videoId,
      channel_id: channelId,
      title: metadata.title,
      viral_score: prediction.viralScore,
      confidence: prediction.confidence,
      estimated_views: prediction.estimatedViews,
      estimated_ctr: prediction.estimatedCTR,
      recommendation: prediction.recommendation,
      risks: prediction.risks || [],
      opportunities: prediction.opportunities || [],
      trending_factors: prediction.trendingFactors || [],
      seasonal_factor: prediction.seasonalFactor,
      metadata: metadata,
      created_at: new Date().toISOString()
    })
  } catch (err) {
    console.error('Error storing prediction:', err)
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { channelId, videoId, title, description, tags, category, thumbnail } = body

    if (!channelId || !title) {
      return NextResponse.json(
        { error: 'channelId and title required' },
        { status: 400 }
      )
    }

    // Run prediction
    const prediction = await predictViral(channelId, {
      title,
      description: description || '',
      tags: tags || [],
      category: category || 'general',
      thumbnail: thumbnail || undefined
    })

    // Analyze content
    const contentAnalysis = await analyzeVideoContent(videoId || 'temp', {
      title,
      description: description || '',
      tags: tags || [],
      category: category || 'general'
    })

    // Store prediction if videoId provided
    if (videoId) {
      await storePrediction(videoId, channelId, prediction, {
        title,
        description: description || '',
        tags: tags || [],
        category: category || 'general',
        thumbnail: thumbnail || undefined
      })
    }

    return NextResponse.json({
      prediction: {
        ...prediction,
        contentScore: contentAnalysis.contentScore,
        sentiment: contentAnalysis.sentiment
      },
      analysis: contentAnalysis,
      recommendations: {
        shouldPublish:
          prediction.viralScore >= 60
            ? 'Ready to publish'
            : 'Optimize before publishing',
        optimizations: prediction.suggestedOptimizations,
        nextSteps:
          prediction.viralScore >= 80
            ? [
                'Publish immediately',
                'Prepare rapid follow-up content',
                'Plan cross-promotion strategy'
              ]
            : prediction.viralScore >= 60
              ? [
                  'Make suggested optimizations',
                  'Prepare thumbnail variations for A/B test',
                  'Plan promotion timeline'
                ]
              : [
                  'Address critical feedback',
                  'Redesign title/thumbnail',
                  'Revise description and tags',
                  'Consider repurposing into different format'
                ]
      }
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const videoId = searchParams.get('videoId')
    const channelId = searchParams.get('channelId')

    if (videoId) {
      // Get prediction for specific video
      const { data, error } = await supabase
        .from('viral_predictions')
        .select('*')
        .eq('video_id', videoId)
        .single()

      if (error && error.code !== 'PGRST116') throw error

      return NextResponse.json(data || null)
    }

    if (channelId) {
      // Get recent predictions for channel
      const { data, error } = await supabase
        .from('viral_predictions')
        .select('*')
        .eq('channel_id', channelId)
        .order('created_at', { ascending: false })
        .limit(10)

      if (error) throw error

      return NextResponse.json(data || [])
    }

    return NextResponse.json(
      { error: 'videoId or channelId required' },
      { status: 400 }
    )
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
