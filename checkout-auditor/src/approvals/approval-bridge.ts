import { supabase } from '../lib/supabase'
import { logger } from '../lib/logger'
import type { Finding } from '../types'

/**
 * For each critical or high finding, create an aquier_approvals row so Orlando
 * sees it in the dashboard /dashboard/aquier/approvals page.
 *
 * Returns the mapping finding_id → approval_id for back-reference.
 */
export async function bridgeFindingsToApprovals(
  findings: Array<Finding & { db_finding_id: string }>,
  runId: string,
): Promise<Record<string, string>> {
  const mapping: Record<string, string> = {}

  const relevant = findings.filter(f => f.severity === 'critical' || f.severity === 'high')
  if (relevant.length === 0) return mapping

  for (const f of relevant) {
    const title = `[${f.severity.toUpperCase()}] ${f.category} — ${f.affected_tier}/${f.affected_country}`
    const rationale = `Checkout Auditor (run ${runId}) detected this issue with ${(f.confidence_score * 100).toFixed(0)}% confidence. Estimated monthly revenue at risk: €${Math.round(f.revenue_impact_eur_estimate).toLocaleString('nl-NL')}.

Evidence:
${f.evidence_summary}`

    const { data, error } = await supabase
      .from('aquier_approvals')
      .insert({
        category: 'storing',
        title,
        rationale,
        proposed_action: f.recommended_fix,
        impact: `${f.severity} · €${Math.round(f.revenue_impact_eur_estimate).toLocaleString('nl-NL')}/mo · ${f.revenue_impact_reasoning}`,
        estimated_cost_eur: 0,
        proposed_by_agent: 'CHECKOUT-AUDITOR',
        evidence: {
          run_id: runId,
          finding_id: f.db_finding_id,
          stripe_object_ids: f.stripe_object_ids,
          confidence: f.confidence_score,
          affected: {
            route: f.affected_route,
            country: f.affected_country,
            tier: f.affected_tier,
            billing_cycle: f.affected_billing_cycle,
            device: f.affected_device,
          },
        },
      })
      .select('id')
      .single()

    if (error) {
      logger.warn({ err: error.message, finding: f.db_finding_id }, 'approval insert failed')
      continue
    }
    if (data?.id) {
      mapping[f.db_finding_id] = data.id as string
      // Back-reference the approval on the finding row
      await supabase
        .from('aquier_audit_findings')
        .update({ approval_id: data.id })
        .eq('id', f.db_finding_id)
    }
  }

  return mapping
}
