import { supabase } from '../lib/supabase'
import { runAgent, persistReport, persistRecommendations } from '../lib/agent-runner'
import { logger } from '../lib/logger'
import type { RecommendationDraft } from '../lib/types'

type ContentFundManagerOutput = {
  ecosystem_roi: number
  channel_allocations: Array<{
    channel_id: string
    niche?: string
    allocated_eur: number
    rationale: string
    roi_estimate: number
  }>
  reallocation_summary: string
  recommendations?: RecommendationDraft[]
}

export async function runContentFundManager(): Promise<{ runId: string; reportId: string; allocations: number }> {
  logger.info('Content Fund Manager run starting')

  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const [channels, contentItems, metrics, monetization] = await Promise.all([
    supabase
      .from('media_holding_channels')
      .select('id,name,niche,status,target_views_10d,current_views_10d')
      .in('status', ['live', 'scaling', 'incubating']),
    supabase
      .from('media_holding_content_items')
      .select('id,channel_id,render_cost_eur,revenue_attributed,created_at')
      .gte('created_at', since30d),
    supabase
      .from('media_holding_metrics')
      .select('content_item_id,views,revenue')
      .gte('snapshot_at', since7d),
    supabase
      .from('monetization_metrics')
      .select('channel_id,estimated_revenue,ad_revenue,rpm,period_start,period_end')
      .gte('period_end', since30d),
  ])

  const channelStats = new Map<string, { renderCost: number; revenue: number; views: number; uploadCount: number }>()
  for (const ci of contentItems.data ?? []) {
    const cid = ci.channel_id as string | null
    if (!cid) continue
    const s = channelStats.get(cid) ?? { renderCost: 0, revenue: 0, views: 0, uploadCount: 0 }
    s.renderCost += Number(ci.render_cost_eur ?? 0)
    s.revenue += Number(ci.revenue_attributed ?? 0)
    s.uploadCount += 1
    channelStats.set(cid, s)
  }

  const contentChannelMap = new Map<string, string>()
  for (const ci of contentItems.data ?? []) {
    if (ci.id && ci.channel_id) contentChannelMap.set(ci.id as string, ci.channel_id as string)
  }
  for (const m of metrics.data ?? []) {
    const cid = contentChannelMap.get(m.content_item_id as string)
    if (!cid) continue
    const s = channelStats.get(cid) ?? { renderCost: 0, revenue: 0, views: 0, uploadCount: 0 }
    s.views += Number(m.views ?? 0)
    s.revenue += Number(m.revenue ?? 0)
    channelStats.set(cid, s)
  }
  for (const m of monetization.data ?? []) {
    const cid = m.channel_id as string | null
    if (!cid) continue
    const s = channelStats.get(cid) ?? { renderCost: 0, revenue: 0, views: 0, uploadCount: 0 }
    s.revenue += Number(m.estimated_revenue ?? 0)
    channelStats.set(cid, s)
  }

  const channelRows = (channels.data ?? []).map(c => {
    const s = channelStats.get(c.id as string) ?? { renderCost: 0, revenue: 0, views: 0, uploadCount: 0 }
    const roi = s.renderCost > 0 ? (s.revenue - s.renderCost) / s.renderCost : 0
    return {
      ...c,
      render_cost_30d: s.renderCost,
      revenue_30d: s.revenue,
      views_7d: s.views,
      uploads_30d: s.uploadCount,
      roi_30d: Number(roi.toFixed(3)),
    }
  })

  const snapshot = { channels: channelRows }

  const userPrompt = `Content Fund weekly allocation review.
${JSON.stringify(snapshot, null, 2)}

Return strict JSON:
{
  "ecosystem_roi": <number>,
  "channel_allocations": [{
    "channel_id": "<uuid>",
    "niche": "<niche>",
    "allocated_eur": <number>,
    "rationale": "<why this allocation>",
    "roi_estimate": <number>
  }],
  "reallocation_summary": "<2-3 paragraphs explaining shifts>",
  "recommendations": [{ "action_kind": "increase_budget|reduce_spend|shift_resources", "target_kind": "channel|niche|allocation", "target_id": "<uuid or null>", "priority": <1-5>, "rationale": "<why>" }]
}

Allocate for the NEXT 7 days. Only use channel_ids that appear in the snapshot.`

  const result = await runAgent({
    agentKey: 'content_fund_manager',
    inputSnapshot: snapshot as unknown as Record<string, unknown>,
    userPrompt,
  })

  const output = result.output as ContentFundManagerOutput
  const periodEnd = new Date()
  const periodStart = new Date()
  const periodEndNext = new Date(periodEnd.getTime() + 7 * 24 * 60 * 60 * 1000)

  const reportId = await persistReport({
    reportKind: 'fund_allocation',
    periodStart: periodEnd,
    periodEnd: periodEndNext,
    title: `Content Fund Allocation — week of ${periodStart.toISOString().slice(0, 10)}`,
    summaryMd: output.reallocation_summary ?? '',
    sections: [{ kind: 'allocations', items: output.channel_allocations ?? [] }],
    generatedByAgent: 'content_fund_manager',
    generatedRunId: result.runId,
  })

  let allocations = 0
  if (output.channel_allocations && output.channel_allocations.length > 0) {
    const rows = output.channel_allocations
      .filter(a => a.channel_id)
      .map(a => ({
        period_start: periodStart.toISOString().slice(0, 10),
        period_end: periodEndNext.toISOString().slice(0, 10),
        channel_id: a.channel_id,
        niche: a.niche ?? null,
        allocated_eur: Math.max(0, Number(a.allocated_eur ?? 0)),
        rationale: a.rationale ?? '',
        roi_estimate: Number(a.roi_estimate ?? 0),
        status: 'proposed' as const,
        generated_run_id: result.runId,
      }))
    if (rows.length > 0) {
      const { error } = await supabase.from('content_fund_allocations').insert(rows)
      if (error) logger.warn('Fund allocation insert failed', { error: error.message })
      else allocations = rows.length
    }
  }

  await persistRecommendations(reportId, output.recommendations ?? [])
  return { runId: result.runId, reportId, allocations }
}
