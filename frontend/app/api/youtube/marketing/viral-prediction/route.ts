import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { predictViral, analyzeVideoContent, storePrediction } from '@/src/viral-prediction-engine'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

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
