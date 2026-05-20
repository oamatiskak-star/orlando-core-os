import type { SupabaseClient } from '@supabase/supabase-js'
import type { AlertKind, AlertSeverity } from './types'

export type DetectedAlert = {
  alert_kind: AlertKind
  severity: AlertSeverity
  target_kind: 'channel' | 'content' | 'niche' | 'competitor' | 'ecosystem'
  target_id: string | null
  title: string
  message: string
  payload: Record<string, unknown>
  dedupe_key: string
}

const FIFTEEN_MIN_MS = 15 * 60 * 1000

export async function detectAllAlerts(admin: SupabaseClient): Promise<DetectedAlert[]> {
  const detectors = [
    detectBreakouts,
    detectUploadFailures,
    detectTrendExplosions,
    detectSaturationWarnings,
    detectVelocitySpikes,
    detectHighRetention,
    detectSubscriberAcceleration,
  ]

  const results = await Promise.all(detectors.map(d => d(admin).catch(() => [] as DetectedAlert[])))
  return results.flat()
}

async function detectBreakouts(admin: SupabaseClient): Promise<DetectedAlert[]> {
  const since = new Date(Date.now() - FIFTEEN_MIN_MS).toISOString()
  const { data } = await admin
    .from('algorithm_gravity_events')
    .select('id,content_item_id,event_type,magnitude,detected_at')
    .eq('event_type', 'breakout')
    .gte('detected_at', since)
    .gte('magnitude', 50)

  return (data ?? []).map(e => ({
    alert_kind: 'breakout' as const,
    severity: e.magnitude >= 80 ? 'critical' : ('warn' as AlertSeverity),
    target_kind: 'content' as const,
    target_id: (e.content_item_id as string) ?? null,
    title: `Breakout detected (magnitude ${e.magnitude})`,
    message: `Algorithm gravity breakout event on content item — magnitude ${e.magnitude}.`,
    payload: { gravity_event_id: e.id, magnitude: e.magnitude, detected_at: e.detected_at },
    dedupe_key: `breakout:${e.id}`,
  }))
}

async function detectUploadFailures(admin: SupabaseClient): Promise<DetectedAlert[]> {
  const since = new Date(Date.now() - FIFTEEN_MIN_MS).toISOString()
  const { data } = await admin
    .from('media_holding_uploads')
    .select('id,content_item_id,platform,status,updated_at')
    .eq('status', 'failed')
    .gte('updated_at', since)
  return (data ?? []).map(u => ({
    alert_kind: 'upload_failure' as const,
    severity: 'warn' as AlertSeverity,
    target_kind: 'content' as const,
    target_id: (u.content_item_id as string) ?? null,
    title: `Upload failed on ${u.platform}`,
    message: `Upload ${u.id} to ${u.platform} failed.`,
    payload: { upload_id: u.id, platform: u.platform },
    dedupe_key: `upload_failure:${u.id}`,
  }))
}

async function detectTrendExplosions(admin: SupabaseClient): Promise<DetectedAlert[]> {
  const since = new Date(Date.now() - FIFTEEN_MIN_MS).toISOString()
  const { data } = await admin
    .from('trend_scanner_signals')
    .select('id,keyword,momentum,source,created_at')
    .gte('created_at', since)
    .gte('momentum', 80)
    .order('momentum', { ascending: false })
    .limit(10)
  return (data ?? []).map(t => ({
    alert_kind: 'trend_explosion' as const,
    severity: t.momentum >= 95 ? 'critical' : ('warn' as AlertSeverity),
    target_kind: 'niche' as const,
    target_id: null,
    title: `Trend explosion: "${t.keyword}"`,
    message: `Trend "${t.keyword}" momentum hit ${t.momentum} on ${t.source}.`,
    payload: { keyword: t.keyword, momentum: t.momentum, source: t.source },
    dedupe_key: `trend_explosion:${t.id}`,
  }))
}

async function detectSaturationWarnings(admin: SupabaseClient): Promise<DetectedAlert[]> {
  const since3d = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
  const { data: metrics } = await admin
    .from('media_holding_metrics')
    .select('content_item_id,views,snapshot_at')
    .gte('snapshot_at', since3d)
    .order('snapshot_at', { ascending: true })

  if (!metrics || metrics.length === 0) return []

  const { data: items } = await admin
    .from('media_holding_content_items')
    .select('id,channel_id')
    .in('id', Array.from(new Set(metrics.map(m => m.content_item_id as string).filter(Boolean))))

  const channelByItem = new Map<string, string>()
  for (const i of items ?? []) {
    if (i.id && i.channel_id) channelByItem.set(i.id as string, i.channel_id as string)
  }

  const byChannelByDay = new Map<string, Map<string, number>>()
  for (const m of metrics) {
    const channelId = channelByItem.get(m.content_item_id as string)
    if (!channelId) continue
    const day = (m.snapshot_at as string).slice(0, 10)
    const dayMap = byChannelByDay.get(channelId) ?? new Map<string, number>()
    dayMap.set(day, (dayMap.get(day) ?? 0) + Number(m.views ?? 0))
    byChannelByDay.set(channelId, dayMap)
  }

  const alerts: DetectedAlert[] = []
  for (const [channelId, dayMap] of byChannelByDay) {
    const sortedDays = Array.from(dayMap.entries()).sort((a, b) => a[0].localeCompare(b[0]))
    if (sortedDays.length < 3) continue
    const last3 = sortedDays.slice(-3)
    const isDecreasing = last3[0][1] > last3[1][1] && last3[1][1] > last3[2][1]
    if (!isDecreasing) continue
    const dropPct = ((last3[0][1] - last3[2][1]) / Math.max(1, last3[0][1])) * 100
    if (dropPct < 20) continue
    alerts.push({
      alert_kind: 'saturation_warning',
      severity: dropPct > 50 ? 'critical' : 'warn',
      target_kind: 'channel',
      target_id: channelId,
      title: `Saturation detected — views down ${dropPct.toFixed(0)}% over 3 days`,
      message: `Channel views declined for 3 consecutive days (${last3.map(d => d[1]).join(' → ')}).`,
      payload: { drop_pct: dropPct, days: last3 },
      dedupe_key: `saturation:${channelId}:${last3[2][0]}`,
    })
  }
  return alerts
}

async function detectVelocitySpikes(admin: SupabaseClient): Promise<DetectedAlert[]> {
  const since = new Date(Date.now() - FIFTEEN_MIN_MS).toISOString()
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const { data: recent } = await admin
    .from('media_holding_metrics')
    .select('content_item_id,views,snapshot_at')
    .gte('snapshot_at', since)
    .order('views', { ascending: false })
    .limit(30)
  if (!recent || recent.length === 0) return []

  const itemIds = Array.from(new Set(recent.map(m => m.content_item_id as string)))
  const { data: items } = await admin
    .from('media_holding_content_items')
    .select('id,channel_id,title')
    .in('id', itemIds)
  const itemMap = new Map<string, { channel_id: string | null; title: string | null }>()
  for (const i of items ?? []) {
    itemMap.set(i.id as string, { channel_id: i.channel_id as string | null, title: i.title as string | null })
  }

  const channelAvg = new Map<string, number>()
  const channelIds = Array.from(new Set((items ?? []).map(i => i.channel_id as string).filter(Boolean)))
  if (channelIds.length === 0) return []

  for (const channelId of channelIds) {
    const { data: histItems } = await admin
      .from('media_holding_content_items')
      .select('id')
      .eq('channel_id', channelId)
      .limit(50)
    const hIds = (histItems ?? []).map(h => h.id as string)
    if (hIds.length === 0) continue
    const { data: hMetrics } = await admin
      .from('media_holding_metrics')
      .select('views')
      .in('content_item_id', hIds)
      .gte('snapshot_at', since24h)
    const total = (hMetrics ?? []).reduce((s, m) => s + Number(m.views ?? 0), 0)
    const avg = (hMetrics?.length ?? 0) > 0 ? total / hMetrics!.length : 0
    channelAvg.set(channelId, avg)
  }

  const alerts: DetectedAlert[] = []
  for (const m of recent) {
    const item = itemMap.get(m.content_item_id as string)
    if (!item || !item.channel_id) continue
    const avg = channelAvg.get(item.channel_id) ?? 0
    if (avg === 0) continue
    const views = Number(m.views ?? 0)
    if (views >= avg * 5) {
      alerts.push({
        alert_kind: 'velocity_spike',
        severity: views >= avg * 10 ? 'critical' : 'warn',
        target_kind: 'content',
        target_id: m.content_item_id as string,
        title: `Velocity spike — ${views.toLocaleString()} views (${(views / avg).toFixed(1)}× baseline)`,
        message: `Content "${item.title ?? 'untitled'}" running at ${(views / avg).toFixed(1)}× channel baseline.`,
        payload: { views, channel_baseline: avg, multiple: views / avg },
        dedupe_key: `velocity_spike:${m.content_item_id}`,
      })
    }
  }
  return alerts
}

async function detectHighRetention(admin: SupabaseClient): Promise<DetectedAlert[]> {
  const since = new Date(Date.now() - FIFTEEN_MIN_MS).toISOString()
  const { data } = await admin
    .from('media_holding_metrics')
    .select('id,content_item_id,retention_pct,views,snapshot_at')
    .gte('snapshot_at', since)
    .gte('retention_pct', 0.9)
    .gte('views', 10_000)
  return (data ?? []).map(m => ({
    alert_kind: 'high_retention' as const,
    severity: 'info' as AlertSeverity,
    target_kind: 'content' as const,
    target_id: m.content_item_id as string,
    title: `High retention — ${(Number(m.retention_pct) * 100).toFixed(0)}% at ${Number(m.views).toLocaleString()} views`,
    message: `Exceptional retention curve — investigate for replicable hook pattern.`,
    payload: { retention_pct: m.retention_pct, views: m.views },
    dedupe_key: `high_retention:${m.id}`,
  }))
}

async function detectSubscriberAcceleration(admin: SupabaseClient): Promise<DetectedAlert[]> {
  const since = new Date(Date.now() - FIFTEEN_MIN_MS).toISOString()
  const { data } = await admin
    .from('algorithm_gravity_events')
    .select('id,content_item_id,event_type,magnitude,detected_at')
    .eq('event_type', 'momentum')
    .gte('detected_at', since)
    .gte('magnitude', 30)
  return (data ?? []).map(e => ({
    alert_kind: 'subscriber_acceleration' as const,
    severity: e.magnitude >= 60 ? ('warn' as AlertSeverity) : ('info' as AlertSeverity),
    target_kind: 'content' as const,
    target_id: e.content_item_id as string,
    title: `Subscriber acceleration — magnitude ${e.magnitude}`,
    message: `Momentum event detected, likely sub-velocity spike.`,
    payload: { magnitude: e.magnitude, event_id: e.id },
    dedupe_key: `subscriber_acceleration:${e.id}`,
  }))
}
