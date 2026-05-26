import { anthropic, estimateCostUsd, extractJson } from '../lib/anthropic'
import { env } from '../lib/secrets'
import { logger } from '../lib/logger'
import { AUDITOR_SYSTEM_PROMPT } from './system-prompt'
import { buildUserPrompt, type ScenarioWithObservations } from './user-prompt-builder'
import { AuditorOutputSchema, type AuditorOutput } from '../types'

const MAX_SCENARIOS_PER_BATCH = 12
const MAX_OUTPUT_TOKENS = 8000

export type AuditorRunResult = {
  output: AuditorOutput
  tokens_in: number
  tokens_out: number
  cost_usd: number
  model: string
  batches: number
}

/**
 * Run the Claude auditor over a set of scenario observations.
 * Batches across multiple Claude calls if input exceeds ~150k tokens.
 */
export async function runAuditor(
  items: ScenarioWithObservations[],
  runMeta: { run_id: string },
): Promise<AuditorRunResult> {
  const totalScenarios = items.length
  const batches: ScenarioWithObservations[][] = []
  for (let i = 0; i < items.length; i += MAX_SCENARIOS_PER_BATCH) {
    batches.push(items.slice(i, i + MAX_SCENARIOS_PER_BATCH))
  }

  const allFindings: AuditorOutput['findings'] = []
  const countriesNoCheckout = new Set<string>()
  const tiersWithIssues = new Set<string>()
  let totalTokensIn = 0
  let totalTokensOut = 0
  const model = batches.length === 1 ? env.ANTHROPIC_MODEL_PRIMARY : env.ANTHROPIC_MODEL_BATCH

  logger.info({ batches: batches.length, totalScenarios: items.length, model, primary_model: env.ANTHROPIC_MODEL_PRIMARY, batch_model: env.ANTHROPIC_MODEL_BATCH }, 'AI auditor starting')

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i]
    const userPrompt = buildUserPrompt(batch, { run_id: runMeta.run_id, total: totalScenarios, subset_offset: i * MAX_SCENARIOS_PER_BATCH })

    logger.info({ batch: i + 1, model, prompt_chars: userPrompt.length, scenarios_in_batch: batch.length }, 'AI auditor calling Anthropic...')

    try {
      const response = await anthropic.messages.create({
        model,
        max_tokens: MAX_OUTPUT_TOKENS,
        system: AUDITOR_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userPrompt }],
      })

      logger.info({ batch: i + 1, content_blocks: response.content.length, stop_reason: response.stop_reason, usage: response.usage }, 'Anthropic response received')

      const text = response.content.map(c => (c.type === 'text' ? c.text : '')).join('')
      logger.info({ batch: i + 1, response_chars: text.length, first_200: text.slice(0, 200) }, 'Claude response text')

      const json = extractJson<unknown>(text)
      const parsed = AuditorOutputSchema.parse(json)

      allFindings.push(...parsed.findings)
      parsed.summary.countries_with_no_checkout.forEach(c => countriesNoCheckout.add(c))
      parsed.summary.tiers_with_issues.forEach(t => tiersWithIssues.add(t))

      totalTokensIn += response.usage.input_tokens
      totalTokensOut += response.usage.output_tokens

      logger.info({
        batch: i + 1,
        of: batches.length,
        findings_in_batch: parsed.findings.length,
        tokens_in: response.usage.input_tokens,
        tokens_out: response.usage.output_tokens,
        model,
      }, 'auditor batch completed')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      const stack = err instanceof Error ? err.stack : undefined
      logger.error({
        err: msg,
        stack,
        batch: i + 1,
        of: batches.length,
        model,
        prompt_chars: userPrompt.length,
      }, 'auditor batch FAILED — skipping (run will show 0 findings)')
    }
  }

  if (batches.length > 0 && totalTokensIn === 0) {
    logger.error({ batches: batches.length, totalScenarios: items.length, model }, 'AI AUDITOR ALL BATCHES FAILED — check ANTHROPIC_API_KEY and model availability')
  }

  // Compute aggregates
  const bySeverity: Record<string, number> = {}
  const byCategory: Record<string, number> = {}
  for (const f of allFindings) {
    bySeverity[f.severity] = (bySeverity[f.severity] ?? 0) + 1
    byCategory[f.category] = (byCategory[f.category] ?? 0) + 1
  }

  const overallScore = computeHealthScore(allFindings, totalScenarios)

  const finalOutput: AuditorOutput = {
    findings: allFindings,
    summary: {
      total_findings: allFindings.length,
      by_severity: bySeverity,
      by_category: byCategory,
      countries_with_no_checkout: Array.from(countriesNoCheckout),
      tiers_with_issues: Array.from(tiersWithIssues),
      overall_health_score: overallScore,
      executive_summary: buildExecutiveSummary(allFindings, totalScenarios, overallScore),
    },
  }

  return {
    output: finalOutput,
    tokens_in: totalTokensIn,
    tokens_out: totalTokensOut,
    cost_usd: estimateCostUsd(model, totalTokensIn, totalTokensOut),
    model,
    batches: batches.length,
  }
}

function computeHealthScore(findings: AuditorOutput['findings'], totalScenarios: number): number {
  if (totalScenarios === 0) return 0
  let penalty = 0
  for (const f of findings) {
    const weight =
      f.severity === 'critical' ? 25 :
      f.severity === 'high' ? 10 :
      f.severity === 'medium' ? 3 :
      f.severity === 'low' ? 1 : 0
    penalty += weight * f.confidence_score
  }
  const raw = 100 - penalty
  return Math.max(0, Math.min(100, Math.round(raw)))
}

function buildExecutiveSummary(findings: AuditorOutput['findings'], total: number, score: number): string {
  const critical = findings.filter(f => f.severity === 'critical').length
  const high = findings.filter(f => f.severity === 'high').length
  if (findings.length === 0) {
    return `All ${total} scenarios passed audit with no findings. Health score ${score}/100.`
  }
  const revAtRisk = findings.reduce((sum, f) => sum + f.revenue_impact_eur_estimate, 0)
  return `${findings.length} findings across ${total} scenarios. ${critical} critical, ${high} high. Estimated combined monthly revenue at risk: €${Math.round(revAtRisk).toLocaleString('nl-NL')}. Health score ${score}/100.`
}
