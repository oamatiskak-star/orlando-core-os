import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const revalidate = 0

// Read-only War Room Scoreboard (laag 7). Uitsluitend echte cijfers uit media_holding_*
// + affiliate_*; geen schattingen. Windows: vandaag / deze week (7d) / deze maand (30d).
// "Winnende campagne" volgt condition 9: vereist echte omzet (commercial), niet views alleen.
export async function GET(_req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const now = new Date()
  const dayStart = new Date(now); dayStart.setHours(0, 0, 0, 0)
  const weekStart = new Date(dayStart); weekStart.setDate(weekStart.getDate() - 7)
  const monthStart = new Date(dayStart); monthStart.setDate(monthStart.getDate() - 30)

  const [channels, campaigns, content, uploads, metrics, convs] = await Promise.all([
    supabase.from('media_holding_channels').select('status, current_status'),
    supabase.from('v_war_room_campaigns').select('campaign_key, total_views, revenue_attributed'),
    supabase.from('media_holding_content_items').select('status, failure_reason'),
    supabase.from('media_holding_uploads').select('status, uploaded_at, created_at'),
    supabase.from('media_holding_metrics').select('revenue, snapshot_at'),
    supabase.from('affiliate_conversions').select('commission_eur, status, confirmed_at, occurred_at'),
  ])

  const chRows = channels.data ?? []
  const cmpRows = campaigns.data ?? []
  const ciRows = content.data ?? []
  const upRows = uploads.data ?? []
  const mtRows = metrics.data ?? []
  const cvRows = convs.data ?? []

  const ACTIVE_CH = ['live', 'scaling', 'incubating']
  const channels_active = chRows.filter((c) => ACTIVE_CH.includes((c.status ?? '').toLowerCase()) || ACTIVE_CH.includes((c.current_status ?? '').toLowerCase())).length

  const campaigns_active = cmpRows.length
  // winnend = echte commerciële proof (omzet > 0) én bereik > 0
  const campaigns_winning = cmpRows.filter((c) => Number(c.revenue_attributed) > 0 && Number(c.total_views) > 0).length

  const FAIL = ['failed', 'unrecoverable', 'error', 'blocked', 'manual_review_required', 'rejected']
  const jobs_blocked =
    ciRows.filter((c) => FAIL.includes((c.status ?? '').toLowerCase()) || (c.failure_reason && c.failure_reason.trim() !== '')).length +
    upRows.filter((u) => FAIL.includes((u.status ?? '').toLowerCase())).length

  const uploads_today = upRows.filter((u) => {
    const t = u.uploaded_at ?? u.created_at
    return t ? new Date(t) >= dayStart : false
  }).length

  // revenue in window = media_holding_metrics.revenue (snapshot in window) + confirmed affiliate commissie
  const sumMetrics = (from: Date) => mtRows
    .filter((m) => m.snapshot_at && new Date(m.snapshot_at) >= from)
    .reduce((s, m) => s + (Number(m.revenue) || 0), 0)
  const sumConv = (from: Date) => cvRows
    .filter((c) => (c.status ?? '').toLowerCase() === 'confirmed')
    .filter((c) => { const t = c.confirmed_at ?? c.occurred_at; return t ? new Date(t) >= from : false })
    .reduce((s, c) => s + (Number(c.commission_eur) || 0), 0)

  const hasRevenueData = mtRows.length > 0 || cvRows.length > 0

  return NextResponse.json({
    channels_active,
    campaigns_active,
    campaigns_winning,
    jobs_blocked,
    uploads_today,
    // null = "Geen data" (geen enkele bron-rij), anders echt bedrag (mag 0 zijn)
    revenue_today: hasRevenueData ? sumMetrics(dayStart) + sumConv(dayStart) : null,
    revenue_week: hasRevenueData ? sumMetrics(weekStart) + sumConv(weekStart) : null,
    revenue_month: hasRevenueData ? sumMetrics(monthStart) + sumConv(monthStart) : null,
  })
}
