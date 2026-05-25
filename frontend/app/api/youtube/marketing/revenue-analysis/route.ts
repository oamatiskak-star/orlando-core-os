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

    // Get revenue by content type
    const { data: revenueByType, error: revError } = await (supabase
      .from('revenue_per_content_type') as any)
      .select('*')
      .eq('channel_id', channelId)
      .order('total_revenue', { ascending: false }) as { data: any[], error: any }

    if (revError) throw revError

    // Get total analytics for projection
    const { data: analytics } = await (supabase
      .from('youtube_video_analytics') as any)
      .select('estimated_revenue, views, watch_time_minutes')
      .eq('channel_id', channelId) as { data: { estimated_revenue?: number; views?: number; watch_time_minutes?: number }[] | null }

    const totalRevenue = analytics?.reduce((sum, a) => sum + (a.estimated_revenue ?? 0), 0) || 0
    const totalViews = analytics?.reduce((sum, a) => sum + (a.views ?? 0), 0) || 0
    const totalWatchTime = analytics?.reduce((sum, a) => sum + (a.watch_time_minutes ?? 0), 0) || 0

    // Project revenue to 840k views
    const avgRevenuePerView = totalViews > 0 ? totalRevenue / totalViews : 0
    const projectedRevenue = avgRevenuePerView * 840000

    // Find best performing type
    const bestType = revenueByType?.[0]

    return NextResponse.json({
      byContentType: revenueByType || [],
      summary: {
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        totalViews,
        avgCPM: totalWatchTime > 0 ? (totalRevenue / (totalWatchTime / 1000)) : 0,
        avgRPM: totalWatchTime > 0 ? (totalRevenue / (totalWatchTime / 1000)) * 1000 : 0,
        avgRevenuePerView: Math.round(avgRevenuePerView * 10000) / 10000
      },
      projection: {
        goalsViews: 840000,
        projectedRevenue: Math.round(projectedRevenue * 100) / 100,
        byContentType: (revenueByType || []).map(type => ({
          type: type.content_type,
          projectedRevenue: Math.round((type.cpm || 0) * (840000 * 0.3) / 1000 * 100) / 100 // Assume 30% of traffic
        }))
      },
      recommendations: [
        bestType ? `Focus on ${bestType.content_type} - highest CPM (${bestType.cpm})` : 'Insufficient data',
        totalViews < 10000 ? 'Build audience base with value-focused content' : 'Optimize for high-value formats',
        avgRevenuePerView > 0.01 ? 'Revenue model working - scale production' : 'Monetization needs optimization'
      ]
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
