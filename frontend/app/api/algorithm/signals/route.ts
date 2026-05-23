import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const revalidate = 0
export const dynamic = 'force-dynamic'

type ChannelLite = { id: string; name: string; niche: string | null }
type ContentLite = { id: string; title: string | null; channel_id: string | null }
type GravityRow = {
  id: string
  event_type: string
  magnitude: number
  detected_at: string
  notes: string | null
  content_item_id: string | null
  upload_id: string | null
}

const ISO_24H_AGO = () => new Date(Date.now() - 24 * 3600 * 1000).toISOString()
const ISO_7D_AGO  = () => new Date(Date.now() -  7 * 24 * 3600 * 1000).toISOString()

export async function GET() {
  const admin = createAdminClient()

  const [
    gravity24h,
    gravityRecent,
    viralRecent,
    trendRecent,
    autopilot,
    latestStrategy,
    channels,
    contentItems,
  ] = await Promise.all([
    admin.from('algorithm_gravity_events')
      .select('id,event_type,magnitude,detected_at')
      .gte('detected_at', ISO_24H_AGO())
      .limit(500),

    admin.from('algorithm_gravity_events')
      .select('id,event_type,magnitude,detected_at,notes,content_item_id,upload_id')
      .order('detected_at', { ascending: false })
      .limit(30),

    admin.from('viral_opportunities')
      .select('id,title,virality_score,view_velocity,retention_score,saturation_score,niche,channel_name,captured_at')
      .gte('captured_at', ISO_7D_AGO())
      .order('virality_score', { ascending: false })
      .limit(50),

    admin.from('trend_scanner_signals')
      .select('id,source,keyword,momentum,region,captured_at')
      .gte('captured_at', ISO_7D_AGO())
      .order('momentum', { ascending: false })
      .limit(200),

    admin.from('autopilot_config')
      .select('link_key,description,enabled,threshold,trigger_count,last_triggered_at')
      .in('link_key', ['gravity_to_winner','gravity_to_language','viral_to_factory','upload_to_crossplatform'])
      .order('link_key', { ascending: true }),

    admin.from('executive_reports')
      .select('id,title,summary_md,sections,generated_at,scope')
      .eq('report_kind', 'algorithm_strategy')
      .order('generated_at', { ascending: false })
      .limit(1),

    admin.from('media_holding_channels')
      .select('id,name,niche'),

    admin.from('media_holding_content_items')
      .select('id,title,channel_id')
      .order('created_at', { ascending: false })
      .limit(500),
  ])

  // Aggregate KPI's
  const gravityRows: { event_type: string; magnitude: number }[] = gravity24h.data ?? []
  const breakouts24h = gravityRows.filter(r => r.event_type === 'breakout').length
  const momentumAvg = gravityRows
    .filter(r => ['momentum', 'breakout', 'algo_boost'].includes(r.event_type))
    .reduce((sum, r, _i, arr) => sum + (r.magnitude / Math.max(arr.length, 1)), 0)
  const replays24h = gravityRows.filter(r => r.event_type === 'replay_spike').length
  const decay24h = gravityRows.filter(r => r.event_type === 'decay').length

  // Recommendation acceleration: count distinct content_items met >=2 gravity events laatste 24h.
  const seen = new Map<string, number>()
  for (const r of (gravity24h.data ?? []) as GravityRow[]) {
    if (!r.content_item_id) continue
    seen.set(r.content_item_id, (seen.get(r.content_item_id) ?? 0) + 1)
  }
  const accelCount = Array.from(seen.values()).filter(c => c >= 2).length

  // Swarm readiness: aandeel breakout+momentum events tov totaal 24h, op 0-100 schaal.
  const positive = gravityRows.filter(r => ['breakout', 'momentum', 'algo_boost'].includes(r.event_type)).length
  const swarmReadiness = gravityRows.length === 0 ? 0 : Math.round((positive / gravityRows.length) * 100)

  // Verrijking van recente gravity events met content+channel info.
  const channelMap = new Map<string, ChannelLite>(((channels.data ?? []) as ChannelLite[]).map(c => [c.id, c]))
  const contentMap = new Map<string, ContentLite>(((contentItems.data ?? []) as ContentLite[]).map(c => [c.id, c]))
  const enrichedGravity = ((gravityRecent.data ?? []) as GravityRow[]).map(g => {
    const ci = g.content_item_id ? contentMap.get(g.content_item_id) : null
    const ch = ci?.channel_id ? channelMap.get(ci.channel_id) : null
    return {
      ...g,
      content_title: ci?.title ?? null,
      channel_name: ch?.name ?? null,
      niche: ch?.niche ?? null,
    }
  })

  // Aggregate trend signals: keep highest momentum per keyword (dedupe).
  const trendMap = new Map<string, { keyword: string; momentum: number; source: string; region: string | null }>()
  for (const t of (trendRecent.data ?? [])) {
    const existing = trendMap.get(t.keyword)
    const numeric = Number(t.momentum) || 0
    if (!existing || numeric > existing.momentum) {
      trendMap.set(t.keyword, {
        keyword: t.keyword,
        momentum: numeric,
        source: t.source,
        region: t.region,
      })
    }
  }
  const trends = Array.from(trendMap.values()).sort((a, b) => b.momentum - a.momentum).slice(0, 36)

  return NextResponse.json({
    kpis: {
      breakouts_24h: breakouts24h,
      momentum_avg: Math.round(momentumAvg),
      replay_intensity_24h: replays24h,
      recommendation_acceleration: accelCount,
      swarm_readiness: swarmReadiness,
      decay_24h: decay24h,
    },
    gravity_events: enrichedGravity,
    viral_opportunities: viralRecent.data ?? [],
    trend_signals: trends,
    autopilot: autopilot.data ?? [],
    latest_strategy: (latestStrategy.data ?? [])[0] ?? null,
    generated_at: new Date().toISOString(),
  })
}
