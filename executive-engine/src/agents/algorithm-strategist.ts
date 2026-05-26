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

  // ─────────────────────────────────────────────────────────────────────
  // Fan-out hook: zet swarm_opportunities met >=3 variants direct als
  // orchestrator_task uit naar de content_factory. Hiermee gaat de
  // Algorithm Intelligence Center loop onmiddellijk in beweging zonder
  // dat Orlando per breakout handmatig een task hoeft te dispatchen.
  // ─────────────────────────────────────────────────────────────────────
  const swarmOps = output.swarm_opportunities ?? []
  const autoSwarm = swarmOps.filter(op => (op.variants_to_make ?? 0) >= 3)
  if (autoSwarm.length > 0) {
    const breakoutInWindow = (snapshot.gravity_events_24h as Array<{ event_type: string }>).some(e => e.event_type === 'breakout')
    const tasks = autoSwarm.map(op => ({
      company_id: 'modiwerijo',
      title: `Algorithm Swarm — ${op.variants_to_make} variants (${op.reason.slice(0, 60)})`,
      task_type: 'algorithm_swarm',
      project: 'media-holding',
      executor: 'content_factory',
      priority: breakoutInWindow ? 2 : 4,
      payload: {
        source: 'algorithm-strategist-autofan',
        report_id: reportId,
        run_id: result.runId,
        content_item_id: op.content_item_id ?? null,
        channel_id: op.channel_id ?? null,
        variants_to_make: op.variants_to_make,
        reason: op.reason,
        issued_at: new Date().toISOString(),
      },
      objective: [`Genereer ${op.variants_to_make} variants voor swarm: ${op.reason}`],
      success_condition: [`${op.variants_to_make} content_items in status pending|rendering|ready`],
    }))
    const { error: fanErr } = await supabase.from('orchestrator_tasks').insert(tasks)
    if (fanErr) {
      logger.warn('Algorithm Strategist fan-out swarm dispatch failed', { err: fanErr.message })
    } else {
      logger.info('Algorithm Strategist auto-dispatched swarm tasks', { count: tasks.length, breakoutInWindow })
    }
  }

  return { runId: result.runId, reportId }
}
