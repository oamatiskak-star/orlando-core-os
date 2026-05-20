import type { SupabaseClient } from '@supabase/supabase-js'
import {
  ChannelMetricsForDecision,
  DecisionResult,
  DecisionStatus,
  DECISION_THRESHOLDS as T,
} from './types'

export function classifyChannel(m: ChannelMetricsForDecision): DecisionResult {
  if (m.manual_terminated || (m.roi_30d < 0 && m.underperforming_weeks * 7 >= T.TERMINATED_NEGATIVE_ROI_DAYS)) {
    return {
      status: 'terminated',
      confidence: 0.95,
      rationale: {
        manual_terminated: m.manual_terminated,
        underperforming_weeks: m.underperforming_weeks,
        roi_30d: m.roi_30d,
      },
    }
  }

  if (m.views_14d >= T.BREAKOUT_VIEWS_14D && m.viral_uploads_14d >= T.BREAKOUT_VIRAL_UPLOADS) {
    return {
      status: 'breakout',
      confidence: 0.9,
      rationale: { views_14d: m.views_14d, viral_uploads_14d: m.viral_uploads_14d },
    }
  }

  if (
    m.view_velocity_variance < T.SCALE_READY_VARIANCE_MAX &&
    m.roi_30d >= T.SCALE_READY_ROI_MIN &&
    m.saturation_index < T.SCALE_READY_SATURATION_MAX &&
    m.views_7d > T.PROMISING_VIEWS_7D / 2
  ) {
    return {
      status: 'scale_ready',
      confidence: 0.85,
      rationale: {
        variance: m.view_velocity_variance,
        roi_30d: m.roi_30d,
        saturation: m.saturation_index,
      },
    }
  }

  if (m.views_7d >= T.PROMISING_VIEWS_7D && m.retention_avg_7d >= T.PROMISING_RETENTION_MIN) {
    return {
      status: 'promising',
      confidence: 0.8,
      rationale: { views_7d: m.views_7d, retention_avg_7d: m.retention_avg_7d },
    }
  }

  if (m.saturation_index >= T.SATURATED_INDEX_MIN) {
    return {
      status: 'saturated',
      confidence: 0.75,
      rationale: { saturation_index: m.saturation_index },
    }
  }

  if (m.views_7d < T.UNDERPERFORMING_VIEWS_7D_MAX && m.retention_avg_7d < T.UNDERPERFORMING_RETENTION_MAX) {
    return {
      status: 'underperforming',
      confidence: 0.7,
      rationale: { views_7d: m.views_7d, retention_avg_7d: m.retention_avg_7d },
    }
  }

  return {
    status: 'promising',
    confidence: 0.5,
    rationale: { reason: 'default — insufficient signal for stronger classification' },
  }
}

export async function gatherChannelMetrics(admin: SupabaseClient): Promise<ChannelMetricsForDecision[]> {
  const since14d = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()
  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const { data: channels } = await admin
    .from('media_holding_channels')
    .select('id,name,niche,status,current_status,current_status_at')
    .in('status', ['live', 'scaling', 'incubating', 'killed', 'paused'])

  if (!channels) return []

  const channelIds = channels.map(c => c.id as string)
  if (channelIds.length === 0) return []

  const [contentItemsRes, metricsRes, gravityRes, statusHistoryRes] = await Promise.all([
    admin
      .from('media_holding_content_items')
      .select('id,channel_id,created_at,render_cost_eur,revenue_attributed,published_at')
      .gte('created_at', since30d)
      .in('channel_id', channelIds),
    admin
      .from('media_holding_metrics')
      .select('content_item_id,views,retention_pct,snapshot_at')
      .gte('snapshot_at', since14d),
    admin
      .from('algorithm_gravity_events')
      .select('content_item_id,event_type,magnitude,detected_at')
      .gte('detected_at', since14d)
      .eq('event_type', 'breakout'),
    admin
      .from('channel_status_history')
      .select('channel_id,to_status,changed_at')
      .gte('changed_at', new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString())
      .in('channel_id', channelIds),
  ])

  const contentByChannel = new Map<string, Array<{ id: string; renderCost: number; revenue: number; createdAt: string }>>()
  const contentChannelMap = new Map<string, string>()
  for (const ci of contentItemsRes.data ?? []) {
    const cid = ci.channel_id as string
    if (!cid) continue
    const arr = contentByChannel.get(cid) ?? []
    arr.push({
      id: ci.id as string,
      renderCost: Number(ci.render_cost_eur ?? 0),
      revenue: Number(ci.revenue_attributed ?? 0),
      createdAt: ci.created_at as string,
    })
    contentByChannel.set(cid, arr)
    contentChannelMap.set(ci.id as string, cid)
  }

  const aggByChannel = new Map<string, {
    views_7d: number
    views_14d: number
    retention_sum_7d: number
    retention_n_7d: number
    retention_sum_14d: number
    retention_n_14d: number
    velocity_samples: number[]
  }>()

  for (const m of metricsRes.data ?? []) {
    const channelId = contentChannelMap.get(m.content_item_id as string)
    if (!channelId) continue
    const agg = aggByChannel.get(channelId) ?? {
      views_7d: 0, views_14d: 0,
      retention_sum_7d: 0, retention_n_7d: 0,
      retention_sum_14d: 0, retention_n_14d: 0,
      velocity_samples: [],
    }
    const views = Number(m.views ?? 0)
    const retention = Number(m.retention_pct ?? 0)
    agg.views_14d += views
    if (new Date(m.snapshot_at as string) >= new Date(since7d)) {
      agg.views_7d += views
      if (retention > 0) {
        agg.retention_sum_7d += retention
        agg.retention_n_7d += 1
      }
    }
    if (retention > 0) {
      agg.retention_sum_14d += retention
      agg.retention_n_14d += 1
    }
    if (views > 0) agg.velocity_samples.push(views)
    aggByChannel.set(channelId, agg)
  }

  const viralUploadsByChannel = new Map<string, number>()
  for (const ge of gravityRes.data ?? []) {
    const cid = contentChannelMap.get(ge.content_item_id as string)
    if (!cid) continue
    viralUploadsByChannel.set(cid, (viralUploadsByChannel.get(cid) ?? 0) + 1)
  }

  const underperfWeeksByChannel = new Map<string, number>()
  const transitionsByChannel = new Map<string, Array<{ to: string; at: Date }>>()
  for (const t of statusHistoryRes.data ?? []) {
    const cid = t.channel_id as string
    const arr = transitionsByChannel.get(cid) ?? []
    arr.push({ to: t.to_status as string, at: new Date(t.changed_at as string) })
    transitionsByChannel.set(cid, arr)
  }
  for (const [cid, arr] of transitionsByChannel) {
    arr.sort((a, b) => b.at.getTime() - a.at.getTime())
    let weeks = 0
    for (const t of arr) {
      if (t.to === 'underperforming') {
        const weekDiff = Math.floor((Date.now() - t.at.getTime()) / (7 * 24 * 60 * 60 * 1000))
        weeks = Math.max(weeks, weekDiff + 1)
      } else if (t.to !== 'underperforming') {
        break
      }
    }
    underperfWeeksByChannel.set(cid, weeks)
  }

  return channels.map(c => {
    const cid = c.id as string
    const agg = aggByChannel.get(cid)
    const content = contentByChannel.get(cid) ?? []
    const renderCost30d = content.reduce((s, x) => s + x.renderCost, 0)
    const revenue30d = content.reduce((s, x) => s + x.revenue, 0)
    const roi = renderCost30d > 0 ? (revenue30d - renderCost30d) / renderCost30d : 0

    const variance = computeVariance(agg?.velocity_samples ?? [])
    const retention7d = (agg?.retention_n_7d ?? 0) > 0 ? agg!.retention_sum_7d / agg!.retention_n_7d : 0
    const retention14d = (agg?.retention_n_14d ?? 0) > 0 ? agg!.retention_sum_14d / agg!.retention_n_14d : 0

    return {
      channel_id: cid,
      views_7d: agg?.views_7d ?? 0,
      views_14d: agg?.views_14d ?? 0,
      retention_avg_7d: retention7d,
      retention_avg_14d: retention14d,
      viral_uploads_14d: viralUploadsByChannel.get(cid) ?? 0,
      upload_count_7d: content.filter(x => new Date(x.createdAt) >= new Date(since7d)).length,
      view_velocity_variance: variance,
      saturation_index: computeSaturationIndex(content.length, agg?.views_14d ?? 0),
      roi_30d: roi,
      underperforming_weeks: underperfWeeksByChannel.get(cid) ?? 0,
      manual_terminated: c.status === 'killed',
    }
  })
}

function computeVariance(samples: number[]): number {
  if (samples.length < 2) return 0
  const mean = samples.reduce((s, x) => s + x, 0) / samples.length
  if (mean === 0) return 0
  const variance = samples.reduce((s, x) => s + (x - mean) ** 2, 0) / samples.length
  return Math.sqrt(variance) / mean
}

function computeSaturationIndex(uploadCount: number, totalViews: number): number {
  if (uploadCount === 0) return 0
  const viewsPerUpload = totalViews / uploadCount
  if (viewsPerUpload < 1_000) return 0.9
  if (viewsPerUpload < 5_000) return 0.7
  if (viewsPerUpload < 20_000) return 0.4
  return 0.2
}

export type ClassifyOutcome = {
  channel_id: string
  status: DecisionStatus
  confidence: number
  rationale: Record<string, unknown>
  metrics: ChannelMetricsForDecision
}

export async function classifyAllChannels(admin: SupabaseClient): Promise<ClassifyOutcome[]> {
  const metricsList = await gatherChannelMetrics(admin)
  return metricsList.map(m => {
    const { status, confidence, rationale } = classifyChannel(m)
    return { channel_id: m.channel_id, status, confidence, rationale, metrics: m }
  })
}
