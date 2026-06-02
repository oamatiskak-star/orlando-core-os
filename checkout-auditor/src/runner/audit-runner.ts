import { supabase } from '../lib/supabase'
import { env } from '../lib/secrets'
import { logger } from '../lib/logger'
import { closeBrowsers } from '../playwright/browser-pool'
import { sendTelegram } from '../lib/telegram'
import { buildScenarioMatrix } from '../matrix'
import { runDiscovery } from '../discovery'
import { runScenario } from './scenario-runner'
import { runAuditor } from '../ai/auditor'
import { renderAuditReport } from '../reports/report-renderer'
import { renderPriorityQueue, rankFindings } from '../reports/priority-queue-renderer'
import { bridgeFindingsToApprovals } from '../approvals/approval-bridge'
import { evaluateLaunchGate, renderLaunchGate, mapObservationsToGate } from '../launch/launch-gate'
import { uploadArtifact } from '../lib/storage'
import { loadTiers, loadCountries } from '../specs'
import type { ScopeFilter, AuditorOutput, Finding } from '../types'
import type { ScenarioWithObservations } from '../ai/user-prompt-builder'

const DEDUP_WINDOW_MS = 30 * 60 * 1000 // 30 min

export type AuditOutcome = {
  run_id: string
  status: 'completed' | 'failed' | 'aborted'
  scenarios_total: number
  scenarios_passed: number
  scenarios_failed: number
  findings: AuditorOutput | null
  report_path: string | null
  priority_queue_path: string | null
  duration_ms: number
}

export async function runAudit(scope: Partial<ScopeFilter> = {}, triggeredBy: string = 'cron'): Promise<AuditOutcome> {
  // Dedup check
  const { data: recent } = await supabase
    .from('aquier_audit_runs')
    .select('id, started_at, status')
    .gte('started_at', new Date(Date.now() - DEDUP_WINDOW_MS).toISOString())
    .in('status', ['running', 'completed'])
    .order('started_at', { ascending: false })
    .limit(1)
  if (recent && recent.length > 0 && recent[0].status === 'running') {
    throw new Error(`Run ${recent[0].id} still in progress (started ${recent[0].started_at})`)
  }

  // Create run row
  const { data: runRow, error: runErr } = await supabase
    .from('aquier_audit_runs')
    .insert({
      status: 'running',
      triggered_by: triggeredBy,
      scope_filter: scope,
      totals: {},
    })
    .select('id, started_at')
    .single()
  if (runErr || !runRow) throw new Error(`run insert failed: ${runErr?.message}`)
  const runId = runRow.id as string
  const startedAt = runRow.started_at as string
  const start = Date.now()

  logger.info({ runId, scope }, 'audit run started')

  let scenariosPassed = 0
  let scenariosFailed = 0
  let auditorOutput: AuditorOutput | null = null
  let reportPath: string | null = null
  let priorityQueuePath: string | null = null

  try {
    // 1. Discovery
    const targetCountries = scope.country_codes
    await runDiscovery(runId, targetCountries)

    // 2. Build matrix (respects max scenarios)
    const cap = scope.max_scenarios ?? env.CHECKOUT_AUDITOR_MAX_SCENARIOS_PER_RUN
    const scenarios = buildScenarioMatrix({ ...scope, max_scenarios: cap })
    logger.info({ count: scenarios.length, cap }, 'matrix built')

    // 3. Run scenarios (sequential — Playwright already manages concurrency in batches inside)
    const scenarioOutcomes: ScenarioWithObservations[] = []
    for (const scenario of scenarios) {
      const tierSpec = loadTiers().find(t => t.code === scenario.tier_code)!
      const countrySpec = loadCountries().find(c => c.code === scenario.country_code)!
      try {
        const outcome = await runScenario(runId, scenario)
        scenarioOutcomes.push({
          scenario,
          observations: outcome.observations,
          tier_spec: tierSpec,
          country_spec: countrySpec,
          scenario_db_id: outcome.scenario_db_id,
          scenario_status: outcome.status,
          error_message: outcome.error_message,
        })
        if (outcome.status === 'passed') scenariosPassed++
        else scenariosFailed++
      } catch (err) {
        scenariosFailed++
        logger.error({ err: String(err), scenario: scenario.scenario_code }, 'scenario unhandled error')
      }
    }

    // 4. AI auditor
    const auditorResult = await runAuditor(scenarioOutcomes, { run_id: runId })
    auditorOutput = auditorResult.output

    // 5. Persist findings
    const findingsWithDbIds: Array<Finding & { db_finding_id: string }> = []
    for (const f of auditorOutput.findings) {
      const { data, error } = await supabase
        .from('aquier_audit_findings')
        .insert({
          run_id: runId,
          severity: f.severity,
          category: f.category,
          affected_route: f.affected_route,
          affected_country: f.affected_country,
          affected_tier: f.affected_tier,
          affected_billing_cycle: f.affected_billing_cycle,
          affected_device: f.affected_device,
          stripe_object_ids: f.stripe_object_ids,
          evidence_summary: f.evidence_summary,
          recommended_fix: f.recommended_fix,
          confidence_score: f.confidence_score,
          revenue_impact_eur_estimate: f.revenue_impact_eur_estimate,
          revenue_impact_reasoning: f.revenue_impact_reasoning,
          detail: { evidence_artifact_paths: f.evidence_artifact_paths },
        })
        .select('id')
        .single()
      if (data?.id) findingsWithDbIds.push({ ...f, db_finding_id: data.id as string })
      else if (error) logger.warn({ err: error.message }, 'finding insert failed')
    }

    // 6. Priority queue
    const ranked = rankFindings(auditorOutput.findings, 50)
    const pqPersist = ranked.map(r => {
      const dbFinding = findingsWithDbIds.find(
        f => f.severity === r.severity && f.affected_route === r.affected_route && f.affected_country === r.affected_country && f.category === r.category,
      )
      return dbFinding ? { finding_id: dbFinding.db_finding_id, rank: r.rank, priority_score: r.priority_score } : null
    }).filter((x): x is { finding_id: string; rank: number; priority_score: number } => x !== null)

    if (pqPersist.length > 0) {
      await supabase.from('aquier_audit_priority_queue').insert(pqPersist).select()
    }

    // 7. Render reports + persist to storage
    const completedAt = new Date().toISOString()
    const reportMd = renderAuditReport(auditorOutput, {
      run_id: runId,
      started_at: startedAt,
      completed_at: completedAt,
      total_scenarios: scenarios.length,
      scenarios_passed: scenariosPassed,
      scenarios_failed: scenariosFailed,
      scenarios_skipped: 0,
      model: auditorResult.model,
      cost_usd: auditorResult.cost_usd,
    })
    const pq = renderPriorityQueue(auditorOutput.findings, runId, 50)

    // Launch Gate (additief) — per-product PASS/WARNING/FAIL over de volledige keten:
    // checkout → coupon → success/cancel → webhook → membership → dashboard → e-mail → analytics.
    // Volledig defensief: faalt dit, dan blijft de bestaande audit-flow intact.
    let launchGateMd = ''
    try {
      const gateInputs = scenarioOutcomes
        .map(o => mapObservationsToGate(o.scenario, o.observations))
        .filter((x): x is NonNullable<typeof x> => x !== null)
      if (gateInputs.length > 0) {
        const gateResults = gateInputs.map(gi => evaluateLaunchGate(gi))
        launchGateMd = '\n\n---\n\n' + renderLaunchGate(gateResults)
        const blocked = gateResults.filter(r => r.verdict === 'FAIL').length
        logger.info({ products: gateResults.length, blocked }, 'launch gate evaluated')
      }
    } catch (e) {
      logger.warn({ err: String(e) }, 'launch gate skipped (non-fatal)')
    }

    const reportStoragePath = `${new Date().toISOString().slice(0, 10)}/${runId}/CHECKOUT_AUDIT_REPORT.md`
    const pqStoragePath = `${new Date().toISOString().slice(0, 10)}/${runId}/PRIORITY_FIX_QUEUE.md`
    await uploadArtifact(reportStoragePath, reportMd + launchGateMd, 'text/markdown')
    await uploadArtifact(pqStoragePath, pq.markdown, 'text/markdown')
    reportPath = reportStoragePath
    priorityQueuePath = pqStoragePath

    // 8. Bridge critical/high findings to approvals
    const approvalMap = await bridgeFindingsToApprovals(findingsWithDbIds, runId)

    // 9. Update run row
    await supabase
      .from('aquier_audit_runs')
      .update({
        status: 'completed',
        completed_at: completedAt,
        totals: {
          scenarios_total: scenarios.length,
          scenarios_passed: scenariosPassed,
          scenarios_failed: scenariosFailed,
          findings_total: auditorOutput.findings.length,
          findings_critical: auditorOutput.summary.by_severity['critical'] ?? 0,
          findings_high: auditorOutput.summary.by_severity['high'] ?? 0,
          approvals_opened: Object.keys(approvalMap).length,
          health_score: auditorOutput.summary.overall_health_score,
        },
        report_path: reportPath,
        priority_queue_path: priorityQueuePath,
        summary: auditorOutput.summary.executive_summary,
        ai_tokens_in: auditorResult.tokens_in,
        ai_tokens_out: auditorResult.tokens_out,
        ai_cost_usd: auditorResult.cost_usd,
      })
      .eq('id', runId)

    // 10. Telegram alert
    const critical = auditorOutput.summary.by_severity['critical'] ?? 0
    const high = auditorOutput.summary.by_severity['high'] ?? 0
    if (critical > 0 || high > 0) {
      await sendTelegram(
        critical > 0 ? 'critical' : 'warning',
        `Aquier audit ${runId.slice(0, 8)}: ${critical}× critical, ${high}× high`,
        `Health ${auditorOutput.summary.overall_health_score}/100\n${auditorOutput.summary.executive_summary}\n\nReport: ${reportPath}\nApprovals opened: ${Object.keys(approvalMap).length}`,
      )
    } else {
      await sendTelegram(
        'info',
        `Aquier audit ${runId.slice(0, 8)}: ${auditorOutput.findings.length} findings`,
        `Health ${auditorOutput.summary.overall_health_score}/100 — no critical/high issues. Report: ${reportPath}`,
      )
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    await supabase
      .from('aquier_audit_runs')
      .update({ status: 'failed', completed_at: new Date().toISOString(), error: msg })
      .eq('id', runId)
    logger.error({ err: msg, runId }, 'audit run failed')
    await sendTelegram('error', `Aquier audit FAILED ${runId.slice(0, 8)}`, msg)
    return {
      run_id: runId,
      status: 'failed',
      scenarios_total: 0,
      scenarios_passed: scenariosPassed,
      scenarios_failed: scenariosFailed,
      findings: null,
      report_path: null,
      priority_queue_path: null,
      duration_ms: Date.now() - start,
    }
  } finally {
    await closeBrowsers().catch(() => {})
  }

  return {
    run_id: runId,
    status: 'completed',
    scenarios_total: scenariosPassed + scenariosFailed,
    scenarios_passed: scenariosPassed,
    scenarios_failed: scenariosFailed,
    findings: auditorOutput,
    report_path: reportPath,
    priority_queue_path: priorityQueuePath,
    duration_ms: Date.now() - start,
  }
}
