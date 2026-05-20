import { supabase } from '../lib/supabase'
import { runAgent, persistReport, persistRecommendations } from '../lib/agent-runner'
import { logger } from '../lib/logger'
import { fetchChannelSnapshots } from '../lib/telemetry-snapshot'
import type { RecommendationDraft } from '../lib/types'

type ChannelManagerOutput = {
  weekly_outlook: string
  recommended_uploads: Array<{ format: string; angle: string; expected_views: number }>
  weak_uploads_to_archive: Array<{ content_item_id?: string; reason: string }>
  format_suggestions: string[]
  recommendations?: RecommendationDraft[]
}

export async function runChannelManager(channelId: string): Promise<{ runId: string; reportId: string }> {
  logger.info('Channel Manager run', { channelId })

  const [channelRes, uploadsRes, retentionViewRes] = await Promise.all([
    supabase
      .from('media_holding_channels')
      .select('id,name,niche,language,status,current_status,target_views_10d,current_views_10d,kpi_targets,upload_strategy,posting_schedule,branding')
      .eq('id', channelId)
      .single(),
    supabase
      .from('media_holding_content_items')
      .select('id,title,kind,status,published_at,created_at,hook,duration_seconds,revenue_attributed,render_cost_eur')
      .eq('channel_id', channelId)
      .gte('created_at', new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('v_retention_intelligence_summary')
      .select('avg_first_3s,avg_first_10s,avg_overall,samples_total')
      .eq('channel_id', channelId)
      .maybeSingle(),
  ])

  if (channelRes.error || !channelRes.data) {
    throw new Error(`Channel ${channelId} not found: ${channelRes.error?.message}`)
  }

  const channels = await fetchChannelSnapshots()
  const channelSnapshot = channels.find(c => c.id === channelId)

  const snapshot = {
    channel: channelRes.data,
    last_14d_uploads: uploadsRes.data ?? [],
    retention_summary: retentionViewRes.data ?? null,
    runtime_metrics: channelSnapshot ?? null,
  }

  const userPrompt = `Channel Manager weekly review for channel "${channelRes.data.name}".

Snapshot:
${JSON.stringify(snapshot, null, 2)}

Return strict JSON:
{
  "weekly_outlook": "<2-3 paragraphs assessing health, momentum, KPI progress>",
  "recommended_uploads": [{ "format": "short|long|reel|loop", "angle": "<short angle description>", "expected_views": <int> }],
  "weak_uploads_to_archive": [{ "content_item_id": "<uuid from snapshot>", "reason": "<why>" }],
  "format_suggestions": ["<format 1>", "<format 2>"],
  "recommendations": [{ "action_kind": "scale_channel|pause_channel|increase_upload_frequency|create_variant_wave|amplify_variant", "target_kind": "channel", "target_id": "${channelId}", "priority": <1-5>, "rationale": "<why>" }]
}

Maximum 5 recommended_uploads, 5 weak_uploads_to_archive, 5 recommendations.`

  const result = await runAgent({
    agentKey: 'channel_manager',
    scope: { channel_id: channelId },
    inputSnapshot: snapshot as unknown as Record<string, unknown>,
    userPrompt,
  })

  const output = result.output as ChannelManagerOutput
  const periodEnd = new Date()
  const periodStart = new Date(periodEnd.getTime() - 7 * 24 * 60 * 60 * 1000)

  const reportId = await persistReport({
    reportKind: 'channel_deep_dive',
    periodStart,
    periodEnd,
    title: `Channel Deep Dive — ${channelRes.data.name}`,
    summaryMd: output.weekly_outlook ?? '',
    sections: [
      { kind: 'recommended_uploads', items: output.recommended_uploads ?? [] },
      { kind: 'weak_uploads_to_archive', items: output.weak_uploads_to_archive ?? [] },
      { kind: 'format_suggestions', items: output.format_suggestions ?? [] },
    ],
    generatedByAgent: 'channel_manager',
    generatedRunId: result.runId,
    scope: { channel_id: channelId },
  })

  await persistRecommendations(reportId, output.recommendations ?? [])
  return { runId: result.runId, reportId }
}

export async function runChannelManagersSweep(): Promise<{ analysed: number }> {
  const { data: channels } = await supabase
    .from('media_holding_channels')
    .select('id')
    .in('status', ['live', 'scaling', 'incubating'])

  if (!channels || channels.length === 0) return { analysed: 0 }

  let analysed = 0
  for (const c of channels) {
    try {
      await runChannelManager(c.id as string)
      analysed += 1
    } catch (err) {
      logger.error('Channel Manager per-channel failed', { channelId: c.id, err })
    }
  }
  return { analysed }
}
