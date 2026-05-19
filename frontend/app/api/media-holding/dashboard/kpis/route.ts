import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const revalidate = 0

// GET /api/media-holding/dashboard/kpis
// Aggregaten voor Media Holding hub-dashboard. Geeft 0 als geen data.
export async function GET(_req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [
    channels,
    viralOps,
    content,
    uploads,
    metrics,
    workers,
    sponsorTargets,
    affiliates,
    monetization,
  ] = await Promise.all([
    supabase.from('media_holding_channels').select('id, status', { count: 'exact', head: false }),
    supabase.from('viral_opportunities').select('id, virality_score', { count: 'exact', head: false }),
    supabase.from('media_holding_content_items').select('id, status', { count: 'exact', head: false }),
    supabase.from('media_holding_uploads').select('id, status', { count: 'exact', head: false }),
    supabase.from('media_holding_metrics').select('views, revenue').limit(1000),
    supabase.from('media_holding_workers').select('id, status, last_seen, name, kind', { count: 'exact', head: false }),
    supabase.from('sponsor_engine_targets').select('id, status', { count: 'exact', head: false }),
    supabase.from('affiliate_links').select('id, active', { count: 'exact', head: false }),
    supabase.from('monetization_streams').select('monthly_revenue, active'),
  ])

  const channelsByStatus: Record<string, number> = {}
  for (const c of channels.data ?? []) {
    channelsByStatus[c.status] = (channelsByStatus[c.status] ?? 0) + 1
  }

  const contentByStatus: Record<string, number> = {}
  for (const c of content.data ?? []) {
    contentByStatus[c.status] = (contentByStatus[c.status] ?? 0) + 1
  }

  const uploadsByStatus: Record<string, number> = {}
  for (const u of uploads.data ?? []) {
    uploadsByStatus[u.status] = (uploadsByStatus[u.status] ?? 0) + 1
  }

  const totalViews = (metrics.data ?? []).reduce<number>((sum, m) => sum + Number(m.views ?? 0), 0)
  const totalRevenue = (metrics.data ?? []).reduce<number>((sum, m) => sum + Number(m.revenue ?? 0), 0)

  const workersByStatus: Record<string, number> = {}
  for (const w of workers.data ?? []) {
    workersByStatus[w.status] = (workersByStatus[w.status] ?? 0) + 1
  }

  const monetizationActive = (monetization.data ?? []).filter((m) => m.active).reduce<number>((sum, m) => sum + Number(m.monthly_revenue ?? 0), 0)

  const topOpportunities = (viralOps.data ?? [])
    .sort((a, b) => (b.virality_score ?? 0) - (a.virality_score ?? 0))
    .slice(0, 5)

  return NextResponse.json({
    channels: {
      total: channels.count ?? 0,
      by_status: channelsByStatus,
    },
    viral_opportunities: {
      total: viralOps.count ?? 0,
      top: topOpportunities,
    },
    content: {
      total: content.count ?? 0,
      by_status: contentByStatus,
    },
    uploads: {
      total: uploads.count ?? 0,
      by_status: uploadsByStatus,
    },
    metrics: {
      total_views: totalViews,
      total_revenue: totalRevenue,
    },
    workers: {
      total: workers.count ?? 0,
      by_status: workersByStatus,
      list: workers.data ?? [],
    },
    sponsors: {
      total: sponsorTargets.count ?? 0,
    },
    affiliates: {
      total: affiliates.count ?? 0,
    },
    monetization: {
      monthly_revenue_active: monetizationActive,
    },
  })
}
