import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const revalidate = 0

// GET /api/media-holding/analytics/daily?days=7
// Geeft per dag totalen voor views/likes/comments/shares + per-channel aggregaat.
// Bron: media_holding_metrics (snapshot_at, views/likes/comments/shares/revenue),
// gekoppeld via media_holding_content_items → media_holding_channels.
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const days = Math.max(1, Math.min(90, Number(req.nextUrl.searchParams.get('days') ?? '7')))
  const since = new Date(Date.now() - days * 86_400_000).toISOString()

  // Metrics in venster
  const { data: metricsRaw, error: mErr } = await supabase
    .from('media_holding_metrics')
    .select(`
      snapshot_at, views, likes, comments, shares, saves, retention_pct, ctr_pct, revenue,
      content_item_id,
      content:media_holding_content_items!inner ( channel_id )
    `)
    .gte('snapshot_at', since)

  if (mErr) return NextResponse.json({ error: mErr.message }, { status: 500 })

  type Row = {
    snapshot_at: string
    views: number | null
    likes: number | null
    comments: number | null
    shares: number | null
    saves: number | null
    retention_pct: number | null
    ctr_pct: number | null
    revenue: number | null
    content: { channel_id: string | null } | { channel_id: string | null }[] | null
  }
  const metrics = (metricsRaw ?? []) as Row[]
  const channelIdOf = (m: Row): string | null => {
    if (!m.content) return null
    if (Array.isArray(m.content)) return m.content[0]?.channel_id ?? null
    return m.content.channel_id
  }

  // Channels lookup
  const { data: channelsRaw } = await supabase
    .from('media_holding_channels')
    .select('id, name, niche, language, status')
  const channels = channelsRaw ?? []
  const channelById = new Map(channels.map((c) => [c.id, c]))

  // Per-day totals
  const dayBuckets = new Map<string, {
    date: string; views: number; likes: number; comments: number; shares: number; saves: number; revenue: number; samples: number
  }>()
  // Per-channel totals (full window)
  const chanBuckets = new Map<string, {
    channel_id: string; views: number; likes: number; comments: number; shares: number; saves: number; revenue: number;
    retention_sum: number; retention_n: number; ctr_sum: number; ctr_n: number
  }>()

  for (const m of metrics) {
    const day = m.snapshot_at.slice(0, 10)
    const d = dayBuckets.get(day) ?? { date: day, views: 0, likes: 0, comments: 0, shares: 0, saves: 0, revenue: 0, samples: 0 }
    d.views    += Number(m.views    ?? 0)
    d.likes    += Number(m.likes    ?? 0)
    d.comments += Number(m.comments ?? 0)
    d.shares   += Number(m.shares   ?? 0)
    d.saves    += Number(m.saves    ?? 0)
    d.revenue  += Number(m.revenue  ?? 0)
    d.samples  += 1
    dayBuckets.set(day, d)

    const cid = channelIdOf(m)
    if (cid) {
      const c = chanBuckets.get(cid) ?? {
        channel_id: cid, views: 0, likes: 0, comments: 0, shares: 0, saves: 0, revenue: 0,
        retention_sum: 0, retention_n: 0, ctr_sum: 0, ctr_n: 0,
      }
      c.views    += Number(m.views    ?? 0)
      c.likes    += Number(m.likes    ?? 0)
      c.comments += Number(m.comments ?? 0)
      c.shares   += Number(m.shares   ?? 0)
      c.saves    += Number(m.saves    ?? 0)
      c.revenue  += Number(m.revenue  ?? 0)
      if (m.retention_pct != null) { c.retention_sum += Number(m.retention_pct); c.retention_n++ }
      if (m.ctr_pct       != null) { c.ctr_sum       += Number(m.ctr_pct);       c.ctr_n++       }
      chanBuckets.set(cid, c)
    }
  }

  // Sort days ascending
  const daily = [...dayBuckets.values()].sort((a, b) => a.date.localeCompare(b.date))

  // Compute totals for window + today + yesterday
  const today     = new Date().toISOString().slice(0, 10)
  const yest      = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10)
  const todayRow  = dayBuckets.get(today)
  const yestRow   = dayBuckets.get(yest)

  const totals = daily.reduce(
    (acc, d) => ({
      views:    acc.views    + d.views,
      likes:    acc.likes    + d.likes,
      comments: acc.comments + d.comments,
      shares:   acc.shares   + d.shares,
      saves:    acc.saves    + d.saves,
      revenue:  acc.revenue  + d.revenue,
    }),
    { views: 0, likes: 0, comments: 0, shares: 0, saves: 0, revenue: 0 },
  )

  const perChannel = [...chanBuckets.values()].map((c) => ({
    channel_id:    c.channel_id,
    channel_name:  channelById.get(c.channel_id)?.name  ?? '—',
    niche:         channelById.get(c.channel_id)?.niche ?? null,
    language:      channelById.get(c.channel_id)?.language ?? null,
    status:        channelById.get(c.channel_id)?.status ?? null,
    views:         c.views,
    likes:         c.likes,
    comments:      c.comments,
    shares:        c.shares,
    saves:         c.saves,
    revenue:       c.revenue,
    retention_pct: c.retention_n > 0 ? Number((c.retention_sum / c.retention_n).toFixed(2)) : null,
    ctr_pct:       c.ctr_n       > 0 ? Number((c.ctr_sum       / c.ctr_n).toFixed(2))       : null,
  })).sort((a, b) => b.views - a.views)

  return NextResponse.json({
    window_days: days,
    totals,
    today:     todayRow ? { views: todayRow.views, likes: todayRow.likes, revenue: todayRow.revenue, samples: todayRow.samples } : null,
    yesterday: yestRow  ? { views: yestRow.views,  likes: yestRow.likes,  revenue: yestRow.revenue,  samples: yestRow.samples  } : null,
    daily,
    channels: perChannel,
  })
}
