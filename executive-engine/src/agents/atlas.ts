import { runAgent, persistReport, persistRecommendations } from '../lib/agent-runner'
import { buildEcosystemSnapshot } from '../lib/telemetry-snapshot'
import { logger } from '../lib/logger'
import type { RecommendationDraft } from '../lib/types'

type AtlasOutput = {
  executive_summary_md: string
  strategic_priorities?: Array<{
    priority: number
    channel_id?: string
    niche?: string
    headline: string
    rationale: string
  }>
  recommendations?: RecommendationDraft[]
  ecosystem_state?: Record<string, unknown>
}

export async function runAtlasBriefing(): Promise<{ runId: string; reportId: string; recsCount: number }> {
  logger.info('ATLAS daily briefing starting')

  const snapshot = await buildEcosystemSnapshot()

  const userPrompt = `It is ${new Date().toISOString()}. Produce today's Media Holding daily briefing.

Ecosystem snapshot (last 7 days unless noted):
${JSON.stringify(snapshot, null, 2)}

Return strictly valid JSON in this shape:
{
  "executive_summary_md": "<markdown briefing, 200-500 words, with clear sections>",
  "strategic_priorities": [
    { "priority": 1, "channel_id": "<uuid or omit>", "niche": "<niche or omit>", "headline": "<10 words>", "rationale": "<50-100 words>" }
  ],
  "recommendations": [
    { "action_kind": "<one of: scale_channel|kill_niche|clone_winner|amplify_variant|launch_swarm|pause_channel|launch_new_channel|increase_production|increase_upload_frequency|launch_expansion>",
      "target_kind": "<channel|niche|ecosystem>",
      "target_id": "<uuid or null>",
      "priority": <1-5>,
      "rationale": "<why this action, 30-80 words>",
      "payload": { "key": "value" }
    }
  ],
  "ecosystem_state": { "verdict": "healthy|cautious|critical", "momentum": "rising|flat|declining" }
}

Rules:
- Only reference channel_ids that appear in the snapshot. If you can't find a uuid, omit target_id (null) and put the channel name in rationale.
- Maximum 5 strategic_priorities and 8 recommendations.
- Be decisive. Kill weak niches, scale winners. Think like a CEO.
- All text in Dutch is acceptable, but JSON keys must be exact as above.`

  const result = await runAgent({
    agentKey: 'atlas',
    inputSnapshot: snapshot as unknown as Record<string, unknown>,
    userPrompt,
  })

  const output = result.output as AtlasOutput
  const periodEnd = new Date()
  const periodStart = new Date(periodEnd.getTime() - 24 * 60 * 60 * 1000)

  const reportId = await persistReport({
    reportKind: 'daily_briefing',
    periodStart,
    periodEnd,
    title: `ATLAS Daily Briefing — ${periodEnd.toISOString().slice(0, 10)}`,
    summaryMd: output.executive_summary_md ?? '',
    sections: [
      { kind: 'strategic_priorities', items: output.strategic_priorities ?? [] },
      { kind: 'ecosystem_state', value: output.ecosystem_state ?? {} },
    ],
    generatedByAgent: 'atlas',
    generatedRunId: result.runId,
  })

  const recsCount = await persistRecommendations(reportId, output.recommendations ?? [])

  logger.info('ATLAS daily briefing complete', { runId: result.runId, reportId, recsCount })
  return { runId: result.runId, reportId, recsCount }
}
