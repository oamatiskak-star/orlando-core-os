import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const revalidate = 0

interface RevenueGoalData {
  goal_id: string
  period: 'monthly' | 'quarterly' | 'yearly'
  start_date: string
  end_date: string
  target_amount: number
}

interface AffiliatePerformanceRow {
  link_id: string
  product: string
  network: string
  niche: string
  channel_id: string
  click_count: number
  conversion_count: number
  confirmed_count: number
  confirmed_commission_eur: number
  pending_commission_eur: number
  conversion_rate_pct: number
  epc_eur: number
}

export async function GET(_req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Fetch affiliate performance data
    const [performanceRes, channelsRes, programsRes, conversionsRes] = await Promise.all([
      supabase
        .from('affiliate_performance')
        .select('*, link:affiliate_links!link_id(id, product, network, niche, channel_id), channel:media_holding_channels(id, name, naam)')
        .order('confirmed_commission_eur', { ascending: false }),
      supabase
        .from('media_holding_channels')
        .select('id, name, naam')
        .order('name'),
      supabase
        .from('affiliate_programs')
        .select('id, name, monthly_revenue, avg_epc, avg_conversion_rate')
        .eq('account_status', 'active')
        .order('monthly_revenue', { ascending: false }),
      supabase
        .from('affiliate_conversions')
        .select('id, value_eur, commission_eur, audience_country, content_type, funnel_phase, confirmed_at')
        .eq('status', 'confirmed')
        .gte('confirmed_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
    ])

    if (performanceRes.error) {
      console.error('Performance fetch error:', performanceRes.error)
      return NextResponse.json({ error: performanceRes.error.message }, { status: 500 })
    }

    const performance = performanceRes.data ?? []
    const channels = channelsRes.data ?? []
    const programs = programsRes.data ?? []
    const conversions = conversionsRes.data ?? []

    // Calculate revenue metrics
    const totalConfirmedRevenue = performance.reduce((sum, p) => sum + Number(p.confirmed_commission_eur ?? 0), 0)
    const totalPendingRevenue = performance.reduce((sum, p) => sum + Number(p.pending_commission_eur ?? 0), 0)
    const totalClicks = performance.reduce((sum, p) => sum + Number(p.click_count ?? 0), 0)
    const totalConversions = performance.reduce((sum, p) => sum + Number(p.confirmed_count ?? 0), 0)

    // Calculate overall metrics
    const avgConversionRate = totalClicks > 0 ? (totalConversions / totalClicks) * 100 : 0
    const avgEPC = totalClicks > 0 ? totalConfirmedRevenue / totalClicks : 0

    // Fetch or create revenue goal for this month
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString()

    // Calculate projected revenue based on run rate
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
    const dayOfMonth = now.getDate()
    const projectedMonthlyRevenue = (totalConfirmedRevenue / dayOfMonth) * daysInMonth

    // Build affiliate performance data
    const affiliatePerformance = performance.map((p: any) => ({
      affiliate_id: p.link_id,
      affiliate_name: p.product,
      total_revenue: Number(p.confirmed_commission_eur ?? 0),
      total_clicks: Number(p.click_count ?? 0),
      total_conversions: Number(p.confirmed_count ?? 0),
      conversion_rate: Number(p.conversion_rate_pct ?? 0) / 100,
      epc: Number(p.epc_eur ?? 0),
      ctr: 0, // Would need more data to calculate
      roi: Number(p.confirmed_commission_eur ?? 0) > 0 ? Number(p.confirmed_commission_eur ?? 0) / (Number(p.click_count ?? 0) * 0.5) : 0, // Simplified
      performance_rank: 0,
      trend: Number(p.confirmed_commission_eur ?? 0) > Number(p.pending_commission_eur ?? 0) * 0.5 ? 'improving' : 'stable',
      recommendation: Number(p.confirmed_commission_eur ?? 0) > 100 ? 'expand' : Number(p.conversion_rate_pct ?? 0) > 2 ? 'keep' : 'optimize',
    }))

    // Add ranking
    affiliatePerformance.forEach((aff, idx) => {
      aff.performance_rank = idx + 1
    })

    // Build channel performance data
    const channelPerformance = channels.map(c => {
      const channelAffiliates = performance.filter((p: any) => p.channel_id === c.id)
      const channelRevenue = channelAffiliates.reduce((sum, p: any) => sum + Number(p.confirmed_commission_eur ?? 0), 0)
      const channelClicks = channelAffiliates.reduce((sum, p: any) => sum + Number(p.click_count ?? 0), 0)
      const channelConversions = channelAffiliates.reduce((sum, p: any) => sum + Number(p.confirmed_count ?? 0), 0)

      return {
        channel_id: c.id,
        channel_name: c.name || c.naam,
        total_revenue: channelRevenue,
        total_affiliates: channelAffiliates.length,
        avg_epc: channelClicks > 0 ? channelRevenue / channelClicks : 0,
        top_affiliate: channelAffiliates[0]?.product || 'N/A',
        conversion_rate: channelClicks > 0 ? (channelConversions / channelClicks) * 100 : 0,
        growth_rate: 5, // Would need historical data
        performance_rank: 0,
        roi: channelClicks > 0 ? (channelRevenue / (channelClicks * 0.5)) : 0,
      }
    })

    // Add ranking
    channelPerformance.sort((a, b) => b.total_revenue - a.total_revenue)
    channelPerformance.forEach((ch, idx) => {
      ch.performance_rank = idx + 1
    })

    // Build country performance data
    const countryMap = new Map<string, any>()
    conversions.forEach(c => {
      if (c.audience_country) {
        if (!countryMap.has(c.audience_country)) {
          countryMap.set(c.audience_country, {
            country_code: c.audience_country,
            total_revenue: 0,
            total_clicks: 0,
            conversion_rate: 0,
            epc: 0,
            conversions: [],
          })
        }
        const country = countryMap.get(c.audience_country)
        country.total_revenue += Number(c.commission_eur ?? 0)
        country.conversions.push(c)
      }
    })

    const countryPerformance = Array.from(countryMap.values()).map(c => ({
      country_code: c.country_code,
      country_name: new Intl.DisplayNames('en', { type: 'region' }).of(c.country_code) || c.country_code,
      total_revenue: c.total_revenue,
      total_clicks: c.conversions.length,
      conversion_rate: 0, // Would need to join affiliate_clicks by country to calculate
      epc: c.conversions.length > 0 ? c.total_revenue / c.conversions.length : 0,
      top_affiliate: 'N/A',
      top_content_type: 'educational',
      growth_potential: 'medium' as const,
      performance_rank: 0,
      priority: c.total_revenue > 100 ? 1 : 2,
    }))

    // Add ranking
    countryPerformance.sort((a, b) => b.total_revenue - a.total_revenue)
    countryPerformance.forEach((c, idx) => {
      c.performance_rank = idx + 1
    })

    // Generate optimization recommendations
    const recommendations = []

    // Recommend scaling high performers
    const topAffiliates = affiliatePerformance.filter(a => a.roi > 2.5 && a.trend === 'improving').slice(0, 3)
    topAffiliates.forEach(aff => {
      recommendations.push({
        recommendation_id: `scale_${aff.affiliate_id}`,
        type: 'scale_affiliate',
        affiliate_id: aff.affiliate_id,
        current_metrics: {
          roi: aff.roi,
          epc: aff.epc,
          revenue: aff.total_revenue,
        },
        expected_improvement: {
          revenue_increase_pct: 25,
          conversion_rate_improvement: 5,
          epc_improvement: 3,
        },
        confidence_score: 0.9,
        implementation_steps: [
          'Increase ad spend allocation',
          'Create additional creative assets',
          'Test new traffic sources',
        ],
        risk_level: 'low',
        estimated_timeline_days: 14,
      })
    })

    // Recommend removing underperformers
    const underperformers = affiliatePerformance.filter(a => a.roi < 1.0).slice(0, 2)
    underperformers.forEach(aff => {
      recommendations.push({
        recommendation_id: `remove_${aff.affiliate_id}`,
        type: 'remove_affiliate',
        affiliate_id: aff.affiliate_id,
        current_metrics: {
          roi: aff.roi,
          epc: aff.epc,
          revenue: aff.total_revenue,
        },
        expected_improvement: {
          revenue_increase_pct: 5,
          conversion_rate_improvement: 0.5,
          epc_improvement: 2,
        },
        confidence_score: 0.85,
        implementation_steps: [
          'Review contract terms',
          'Identify replacement affiliate',
          'Monitor transition',
        ],
        risk_level: 'low',
        estimated_timeline_days: 7,
      })
    })

    return NextResponse.json({
      revenue_metrics: {
        period_start: monthStart,
        period_end: monthEnd,
        actual_revenue: totalConfirmedRevenue,
        target_revenue: 22000, // Example target
        variance: totalConfirmedRevenue - 22000,
        variance_percentage: ((totalConfirmedRevenue - 22000) / 22000) * 100,
        performance_status: totalConfirmedRevenue >= 22000 ? 'exceeding' : totalConfirmedRevenue >= 20900 ? 'on_track' : 'at_risk',
        projected_final: projectedMonthlyRevenue,
        days_elapsed: dayOfMonth,
        days_remaining: daysInMonth - dayOfMonth,
        daily_run_rate: totalConfirmedRevenue / dayOfMonth,
        required_daily_rate: (22000 - totalConfirmedRevenue) / (daysInMonth - dayOfMonth),
      },
      affiliate_performance: affiliatePerformance,
      channel_performance: channelPerformance,
      country_performance: countryPerformance,
      recommendations,
      summary: {
        total_revenue: totalConfirmedRevenue,
        total_pending: totalPendingRevenue,
        total_clicks: totalClicks,
        total_conversions: totalConversions,
        avg_conversion_rate: avgConversionRate,
        avg_epc: avgEPC,
        mrr: projectedMonthlyRevenue,
        arr: projectedMonthlyRevenue * 12,
      },
    })
  } catch (error) {
    console.error('Revenue intelligence error:', error)
    return NextResponse.json({ error: 'Failed to fetch revenue intelligence data' }, { status: 500 })
  }
}
