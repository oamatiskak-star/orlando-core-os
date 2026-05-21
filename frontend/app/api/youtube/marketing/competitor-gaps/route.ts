import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const channelId = searchParams.get('channelId')

    if (!channelId) {
      return NextResponse.json(
        { error: 'channelId required' },
        { status: 400 }
      )
    }

    // Get content gaps
    const { data: gaps, error: gapError } = await supabase
      .from('content_gap_analysis')
      .select('*')
      .eq('channel_id', channelId)
      .eq('status', 'open')
      .order('opportunity_score', { ascending: false })

    if (gapError) throw gapError

    // Get competitor channels
    const { data: yourChannel } = await supabase
      .from('youtube_channels')
      .select('*')
      .eq('id', channelId)
      .single()

    // Estimate your content distribution
    const { data: yourVideos } = await supabase
      .from('youtube_videos')
      .select('description')
      .eq('channel_id', channelId)

    const yourContentTypes = {
      shorts: yourVideos?.filter(v => (v.description || '').includes('short')).length || 0,
      longform: yourVideos?.filter(v => (v.description || '').includes('video')).length || 0,
      tutorials: yourVideos?.filter(v => (v.description || '').includes('tutorial')).length || 0,
      challenges: yourVideos?.filter(v => (v.description || '').includes('challenge')).length || 0,
      trends: yourVideos?.filter(v => (v.description || '').includes('trend')).length || 0,
    }

    // Benchmarks (example - in production, calculate from competitor data)
    const competitorAverages = {
      shorts: 15,
      longform: 8,
      tutorials: 12,
      challenges: 5,
      trends: 10
    }

    return NextResponse.json({
      openGaps: gaps || [],
      yourDistribution: yourContentTypes,
      competitorBenchmarks: competitorAverages,
      gaps: Object.entries(yourContentTypes).map(([type, count]) => ({
        type,
        youHave: count,
        competitorAvg: competitorAverages[type as keyof typeof competitorAverages],
        gap: Math.max(0, (competitorAverages[type as keyof typeof competitorAverages] || 0) - count),
        opportunity: Math.max(0, (competitorAverages[type as keyof typeof competitorAverages] || 0) - count) * 5000 // 5k views per video
      })).sort((a, b) => b.opportunity - a.opportunity),
      topOpportunities: gaps?.slice(0, 5).map(g => ({
        category: g.gap_category,
        estimatedViews: g.estimated_views_opportunity,
        topics: g.suggested_topics,
        priority: g.opportunity_score
      })) || [],
      actionPlan: [
        `Create ${Math.max(1, (competitorAverages.shorts || 0) - (yourContentTypes.shorts || 0))} Shorts`,
        `Produce ${Math.max(1, (competitorAverages.tutorials || 0) - (yourContentTypes.tutorials || 0))} tutorials`,
        'Leverage underutilized formats for rapid growth'
      ]
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
