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

    // Get realtime KPIs
    const { data: kpis, error: kpiError } = await supabase
      .from('marketing_kpis_realtime')
      .select('*')
      .eq('channel_id', channelId)
      .single()

    if (kpiError && kpiError.code !== 'PGRST116') throw kpiError

    // Get channel info
    const { data: channel } = await supabase
      .from('youtube_channels')
      .select('*')
      .eq('id', channelId)
      .single()

    // Get active recommendations
    const { data: activeRecs } = await supabase
      .from('marketing_recommendations')
      .select('*')
      .eq('channel_id', channelId)
      .eq('status', 'pending')
      .limit(3)
      .order('priority', { ascending: false })

    // Get active A/B tests
    const { data: tests } = await supabase
      .from('ab_test_variants')
      .select('*')
      .eq('status', 'active')
      .limit(2)

    const kpisData = kpis || {
      views_24h: 0,
      views_7d: 0,
      growth_rate_percent: 0,
      health_score: 50,
      revenue_24h: 0,
      revenue_7d: 0,
      avg_ctr: 0,
      viral_momentum_score: 0,
      current_progress_percent: 0,
      days_remaining: 10,
      daily_velocity_needed: 84000,
      on_track: false
    }

    const statusEmoji = kpisData.on_track ? '✅' : '🚨'
    const statusText = kpisData.on_track ? 'ON TRACK' : 'BEHIND TARGET'

    return NextResponse.json({
      channel: {
        id: channel?.id,
        name: channel?.name,
        createdAt: channel?.created_at
      },
      kpis: {
        // Views
        views24h: kpisData.views_24h,
        views7d: kpisData.views_7d,
        viewsAllTime: kpisData.views_7d > 0 ? Math.round(kpisData.views_7d * 4.3) : 0, // Rough estimate

        // Growth
        growthRate: kpisData.growth_rate_percent,
        viralMomentum: kpisData.viral_momentum_score,

        // Health
        healthScore: kpisData.health_score,
        healthStatus: kpisData.health_score > 75 ? '🟢 Excellent' : kpisData.health_score > 50 ? '🟡 Good' : '🔴 Needs work',

        // Revenue
        revenue24h: kpisData.revenue_24h,
        revenue7d: kpisData.revenue_7d,
        avgCTR: (kpisData.avg_ctr * 100).toFixed(2) + '%',

        // Business plan (840k views)
        businessPlan: {
          target: 840000,
          current: Math.round((kpisData.current_progress_percent / 100) * 840000),
          progressPercent: kpisData.current_progress_percent,
          daysRemaining: kpisData.days_remaining,
          dailyNeeded: Math.round(kpisData.daily_velocity_needed),
          status: statusText,
          statusEmoji: statusEmoji,
          onTrack: kpisData.on_track,
          deadline: new Date(Date.now() + kpisData.days_remaining * 24 * 60 * 60 * 1000).toLocaleDateString()
        }
      },
      recommendations: {
        active: activeRecs?.map(r => ({
          id: r.id,
          title: r.title,
          type: r.recommendation_type,
          priority: r.priority,
          confidence: (r.ai_confidence * 100).toFixed(0) + '%',
          estimatedImpact: `+${r.estimated_impact_views.toLocaleString()} views`
        })) || [],
        count: activeRecs?.length || 0
      },
      abTests: {
        active: tests?.map(t => ({
          id: t.id,
          type: t.variant_type,
          status: 'Testing',
          variantA: t.variant_a_value.slice(0, 30) + '...',
          variantB: t.variant_b_value.slice(0, 30) + '...',
          viewsA: t.variant_a_views,
          viewsB: t.variant_b_views
        })) || [],
        count: tests?.length || 0
      },
      alerts: [
        !kpisData.on_track ? {
          level: 'critical',
          message: `Behind target: ${kpisData.daily_velocity_needed.toLocaleString()} views/day needed`,
          action: 'Review recommendations'
        } : null,
        kpisData.health_score < 40 ? {
          level: 'warning',
          message: 'Health score declining - engagement dropping',
          action: 'Optimize content quality'
        } : null,
        kpisData.avg_ctr < 0.02 ? {
          level: 'warning',
          message: 'CTR critically low (<2%)',
          action: 'A/B test thumbnails immediately'
        } : null,
        kpisData.growth_rate_percent < 0 ? {
          level: 'info',
          message: 'Growth slowing - consider upload burst',
          action: 'Execute upload burst strategy'
        } : null
      ].filter(Boolean) as any[]
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
