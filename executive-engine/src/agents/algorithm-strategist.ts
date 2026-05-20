import { supabase } from '../lib/supabase'
import { runAgent, persistReport, persistRecommendations } from '../lib/agent-runner'
import { logger } from '../lib/logger'
import { fetchTrendSignals, fetchAudioSignals, fetchChannelSnapshots } from '../lib/telemetry-snapshot'
import type { RecommendationDraft } from '../lib/types'

type AlgorithmStrategistOutput = {
  recommended_upload_windows: Array<{ channel_id: string; window_iso: string; rationale: string }>
  swarm_opportunities: Array<{ content_item_id?: string; channel_id?: string; reason: string; variants_to_make: number }>
  pivot_signals: Array<{ niche: string; trend: 'cooling' | 'declining' | 'reversing'; evidence: string }>
  market_summary: string
  recommendations?: RecommendationDraft[]
}

export async function runAlgorithmStrategist(): Promise<{ runId: string; reportId: string }> {
  logger.info('Algorithm Strategist run starting')

  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const [gravity, trends, audio, channels] = await Promise.all([
    supabase
      .from('algorithm_gravity_events')
      .select('content_item_id,event_type,magnitude,detected_at')
      .gte('detected_at', since24h)
      .order('detected_at', { ascending: false })
      .limit(50),
    fetchTrendSignals(15),
    fetchAudioSignals(15),
    fetchChannelSnapshots(),
  ])

  const snapshot = {
    gravity_events_24h: gravity.data ?? [],
    rising_keywords: trends,
    audio_velocity: audio,
    channels: channels,
  }

  const userPrompt = `Algorithm Strategy review. Snapshot last 24h:
${JSON.stringify(snapshot, null, 2)}

Return strict JSON:
{
  "recommended_upload_windows": [{ "channel_id": "<uuid>", "window_iso": "<ISO 8601>", "rationale": "<why>" }],
  "swarm_opportunities": [{ "content_item_id": "<uuid or null>", "channel_id": "<uuid>", "reason": "<why>", "variants_to_make": <1-10> }],
  "pivot_signals": [{ "niche": "<niche>", "trend": "cooling|declining|reversing", "evidence": "<short>" }],
  "market_summary": "<2-3 paragraph state of the algorithm>",
  "recommendations": [{ "action_kind": "activate_swarm_mode|push_variants|increase_upload_frequency|launch_swarm", "target_kind": "channel|niche|ecosystem", "target_id": "<uuid or null>", "priority": <1-5>, "rationale": "<why>" }]
}

Maximum 10 upload_windows (next 48h), 5 swarm_opportunities, 5 pivot_signals, 5 recommendations.`

  const result = await runAgent({
    agentKey: 'algorithm_strategist',
    inputSnapshot: snapshot as unknown as Record<string, unknown>,
    userPrompt,
  })

  const output = result.output as AlgorithmStrategistOutput
  const periodEnd = new Date()
  const periodStart = new Date(periodEnd.getTime() - 24 * 60 * 60 * 1000)

  const reportId = await persistReport({
    reportKind: 'algorithm_strategy',
    periodStart,
    periodEnd,
    title: `Algorithm Strategy — ${periodEnd.toISOString().slice(0, 13)}h`,
    summaryMd: output.market_summary ?? '',
    sections: [
      { kind: 'upload_windows', items: output.recommended_upload_windows ?? [] },
      { kind: 'swarm_opportunities', items: output.swarm_opportunities ?? [] },
      { kind: 'pivot_signals', items: output.pivot_signals ?? [] },
    ],
    generatedByAgent: 'algorithm_strategist',
    generatedRunId: result.runId,
  })

  await persistRecommendations(reportId, output.recommendations ?? [])
  return { runId: result.runId, reportId }
}
