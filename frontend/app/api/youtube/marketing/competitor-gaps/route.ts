import { NextRequest, NextResponse } from 'next/server'
import { getServerSupabaseClient } from '@/lib/supabase/server-client'


export async function GET(request: NextRequest) {
  try {
    const supabase = getServerSupabaseClient()
    const { searchParams } = new URL(request.url)
    const channelId = searchParams.get('channelId')

    if (!channelId) {
      return NextResponse.json(
        { error: 'channelId required' },
        { status: 400 }
      )
    }

    // Get content gaps
    const { data: gaps, error: gapError } = await (supabase
      .from('content_gap_analysis') as any)
      .select('*')
      .eq('channel_id', channelId)
      .eq('status', 'open')
      .order('opportunity_score', { ascending: false }) as { data: { gap_category: string; estimated_views_opportunity: number; suggested_topics: string[]; opportunity_score: number }[] | null, error: any }

    if (gapError) throw gapError

    // Get competitor channels
    const { data: yourChannel } = await supabase
      .from('youtube_channels')
      .select('*')
      .eq('id', channelId)
      .single()

    // Estimate your content distribution
    const { data: yourVideos } = await (supabase
      .from('youtube_videos') as any)
      .select('description')
      .eq('channel_id', channelId) as { data: { description: string | null }[] | null }

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
