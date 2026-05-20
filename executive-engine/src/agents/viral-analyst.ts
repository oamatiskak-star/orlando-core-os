import { supabase } from '../lib/supabase'
import { runAgent, persistReport, persistRecommendations } from '../lib/agent-runner'
import { logger } from '../lib/logger'
import type { RecommendationDraft } from '../lib/types'

type ViralAnalystOutput = {
  hook_effectiveness: { score: number; analysis: string }
  retention_breakpoints: Array<{ second: number; drop_pct: number; reason: string }>
  algorithm_lift_explanation: string
  replicable_patterns: Array<{ pattern: string; confidence: number; suggestion: string }>
  audience_signals: string
  hook_library_additions?: Array<{ hook_text: string; hook_kind: string; success_score: number; rationale: string }>
  recommendations?: RecommendationDraft[]
}

export async function runViralAnalystForContent(contentItemId: string): Promise<{ runId: string; reportId: string }> {
  logger.info('Viral Analyst run starting', { contentItemId })

  const [contentRes, retentionRes, gravityRes, hooksRes] = await Promise.all([
    supabase
      .from('media_holding_content_items')
      .select('id,channel_id,title,kind,hook,prompt,duration_seconds,language,status,published_at,output_url,retention_analysis')
      .eq('id', contentItemId)
      .single(),
    supabase
      .from('retention_lab_samples')
      .select('second_index,retention_pct,drop_off_marker')
      .eq('content_item_id', contentItemId)
      .order('second_index'),
    supabase
      .from('algorithm_gravity_events')
      .select('event_type,magnitude,detected_at')
      .eq('content_item_id', contentItemId),
    supabase
      .from('hook_library')
      .select('hook_text,hook_kind,success_score,pacing,replay_friendly')
      .order('success_score', { ascending: false })
      .limit(10),
  ])

  if (contentRes.error || !contentRes.data) {
    throw new Error(`Content item ${contentItemId} not found: ${contentRes.error?.message}`)
  }

  const { data: metricsAgg } = await supabase
    .from('media_holding_metrics')
    .select('views,retention_pct,ctr_pct,likes,comments,shares,snapshot_at')
    .eq('content_item_id', contentItemId)
    .order('snapshot_at', { ascending: false })
    .limit(1)

  const snapshot = {
    content_item: contentRes.data,
    latest_metrics: metricsAgg?.[0] ?? null,
    retention_curve: retentionRes.data ?? [],
    gravity_events: gravityRes.data ?? [],
    top_hook_library_patterns: hooksRes.data ?? [],
  }

  const userPrompt = `Forensic post-publish analysis. Content item:
${JSON.stringify(snapshot, null, 2)}

Return strict JSON:
{
  "hook_effectiveness": { "score": <0-100>, "analysis": "<3-5 sentences>" },
  "retention_breakpoints": [{ "second": <int>, "drop_pct": <0-100>, "reason": "<short>" }],
  "algorithm_lift_explanation": "<why algorithm pushed or didn't, 50-150 words>",
  "replicable_patterns": [{ "pattern": "<short>", "confidence": <0-1>, "suggestion": "<what to do>" }],
  "audience_signals": "<who watched, when they dropped, comments theme>",
  "hook_library_additions": [{ "hook_text": "<exact hook>", "hook_kind": "question|stat|callout|pattern_interrupt|reveal|story", "success_score": <0-100>, "rationale": "<why add this>" }],
  "recommendations": [{ "action_kind": "clone_winner|amplify_variant|generate_better_hook|optimize_pacing", "target_kind": "content", "target_id": "${contentItemId}", "priority": <1-5>, "rationale": "<why>" }]
}`

  const result = await runAgent({
    agentKey: 'viral_analyst',
    scope: { content_id: contentItemId },
    inputSnapshot: snapshot as unknown as Record<string, unknown>,
    userPrompt,
  })

  const output = result.output as ViralAnalystOutput
  const periodEnd = new Date()
  const periodStart = new Date(periodEnd.getTime() - 7 * 24 * 60 * 60 * 1000)

  const reportId = await persistReport({
    reportKind: 'viral_post_mortem',
    periodStart,
    periodEnd,
    title: `Viral Post-Mortem — ${contentRes.data.title ?? contentItemId.slice(0, 8)}`,
    summaryMd: output.algorithm_lift_explanation ?? '',
    sections: [
      { kind: 'hook_effectiveness', value: output.hook_effectiveness ?? {} },
      { kind: 'retention_breakpoints', items: output.retention_breakpoints ?? [] },
      { kind: 'replicable_patterns', items: output.replicable_patterns ?? [] },
      { kind: 'audience_signals', value: output.audience_signals ?? '' },
    ],
    generatedByAgent: 'viral_analyst',
    generatedRunId: result.runId,
    scope: { content_id: contentItemId, channel_id: contentRes.data.channel_id },
  })

  if (output.hook_library_additions && output.hook_library_additions.length > 0) {
    const hookRows = output.hook_library_additions
      .filter(h => h.hook_text && h.hook_text.length > 5)
      .map(h => ({
        hook_text: h.hook_text,
        hook_kind: h.hook_kind || 'pattern_interrupt',
        success_score: Math.max(0, Math.min(100, h.success_score ?? 50)),
        source_content_id: contentItemId,
      }))
    if (hookRows.length > 0) {
      const { error } = await supabase.from('hook_library').insert(hookRows)
      if (error) logger.warn('Hook library insert failed', { error: error.message })
    }
  }

  await persistRecommendations(reportId, output.recommendations ?? [])
  return { runId: result.runId, reportId }
}

export async function runViralAnalystSweep(): Promise<{ analysed: number }> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { data: breakouts } = await supabase
    .from('algorithm_gravity_events')
    .select('content_item_id,detected_at,magnitude')
    .eq('event_type', 'breakout')
    .gte('detected_at', since)
    .gte('magnitude', 50)
    .order('magnitude', { ascending: false })
    .limit(10)

  if (!breakouts || breakouts.length === 0) {
    logger.info('Viral Analyst sweep: no breakout events to analyse')
    return { analysed: 0 }
  }

  const contentIds = Array.from(new Set(breakouts.map(b => b.content_item_id as string).filter(Boolean)))
  const { data: existingRuns } = await supabase
    .from('executive_agent_runs')
    .select('scope')
    .eq('agent_key', 'viral_analyst')
    .gte('started_at', since)
  const alreadyDone = new Set<string>()
  for (const r of existingRuns ?? []) {
    const cid = (r.scope as { content_id?: string } | null)?.content_id
    if (cid) alreadyDone.add(cid)
  }

  const todo = contentIds.filter(id => !alreadyDone.has(id))
  let analysed = 0
  for (const id of todo) {
    try {
      await runViralAnalystForContent(id)
      analysed += 1
    } catch (err) {
      logger.error('Viral Analyst per-item failed', { contentItemId: id, err })
    }
  }
  return { analysed }
}
