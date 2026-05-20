import { supabase } from '../lib/supabase'
import { runAgent, persistReport, persistRecommendations } from '../lib/agent-runner'
import { logger } from '../lib/logger'
import type { RecommendationDraft } from '../lib/types'

type RetentionScientistOutput = {
  best_first_frames: Array<{ pattern: string; avg_retention_3s: number; example_channel: string }>
  worst_drop_off_patterns: Array<{ pattern: string; drop_second: number; channels: string[] }>
  replay_triggers: string[]
  optimal_pacing_windows: { intro_seconds: number; first_payoff_seconds: number; cta_seconds: number }
  dopamine_timing_recommendations: string
  hook_library_score_updates?: Array<{ hook_text_match: string; new_success_score: number }>
  recommendations?: RecommendationDraft[]
}

export async function runRetentionScientist(): Promise<{ runId: string; reportId: string }> {
  logger.info('Retention Scientist run starting')

  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const [retentionSummary, recentItems, hookLibrary] = await Promise.all([
    supabase.from('v_retention_intelligence_summary').select('*'),
    supabase
      .from('media_holding_content_items')
      .select('id,channel_id,title,kind,hook,duration_seconds,published_at,retention_analysis')
      .gte('created_at', since30d)
      .not('retention_analysis', 'is', null)
      .limit(50),
    supabase.from('hook_library').select('id,hook_text,hook_kind,success_score').order('success_score', { ascending: false }).limit(30),
  ])

  const snapshot = {
    retention_by_channel: retentionSummary.data ?? [],
    recent_items_with_analysis: recentItems.data ?? [],
    hook_library_top: hookLibrary.data ?? [],
  }

  const userPrompt = `Retention intelligence review (last 30 days).
${JSON.stringify(snapshot, null, 2)}

Return strict JSON:
{
  "best_first_frames": [{ "pattern": "<description>", "avg_retention_3s": <0-100>, "example_channel": "<channel name>" }],
  "worst_drop_off_patterns": [{ "pattern": "<description>", "drop_second": <int>, "channels": ["<name>", ...] }],
  "replay_triggers": ["<trigger 1>", "<trigger 2>"],
  "optimal_pacing_windows": { "intro_seconds": <int>, "first_payoff_seconds": <int>, "cta_seconds": <int> },
  "dopamine_timing_recommendations": "<1-2 paragraphs>",
  "hook_library_score_updates": [{ "hook_text_match": "<exact text>", "new_success_score": <0-100> }],
  "recommendations": [{ "action_kind": "generate_better_hook|clone_retention_pattern|optimize_pacing", "target_kind": "channel|niche|ecosystem", "target_id": "<uuid or null>", "priority": <1-5>, "rationale": "<why>" }]
}

Maximum 5 of each list. Use exact channel names from the snapshot.`

  const result = await runAgent({
    agentKey: 'retention_scientist',
    inputSnapshot: snapshot as unknown as Record<string, unknown>,
    userPrompt,
  })

  const output = result.output as RetentionScientistOutput

  if (output.hook_library_score_updates && hookLibrary.data) {
    for (const upd of output.hook_library_score_updates) {
      if (!upd.hook_text_match || typeof upd.new_success_score !== 'number') continue
      const match = hookLibrary.data.find(h => (h.hook_text as string)?.includes(upd.hook_text_match))
      if (match) {
        const score = Math.max(0, Math.min(100, upd.new_success_score))
        await supabase.from('hook_library').update({ success_score: score }).eq('id', match.id)
      }
    }
  }

  const periodEnd = new Date()
  const periodStart = new Date(periodEnd.getTime() - 30 * 24 * 60 * 60 * 1000)

  const reportId = await persistReport({
    reportKind: 'retention_intelligence',
    periodStart,
    periodEnd,
    title: `Retention Intelligence — ${periodEnd.toISOString().slice(0, 10)}`,
    summaryMd: output.dopamine_timing_recommendations ?? '',
    sections: [
      { kind: 'best_first_frames', items: output.best_first_frames ?? [] },
      { kind: 'worst_drop_off_patterns', items: output.worst_drop_off_patterns ?? [] },
      { kind: 'replay_triggers', items: output.replay_triggers ?? [] },
      { kind: 'optimal_pacing_windows', value: output.optimal_pacing_windows ?? {} },
    ],
    generatedByAgent: 'retention_scientist',
    generatedRunId: result.runId,
  })

  await persistRecommendations(reportId, output.recommendations ?? [])
  return { runId: result.runId, reportId }
}
