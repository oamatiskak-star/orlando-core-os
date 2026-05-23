import type { AuditorOutput } from '../types'

export type RunContext = {
  run_id: string
  started_at: string
  completed_at: string
  total_scenarios: number
  scenarios_passed: number
  scenarios_failed: number
  scenarios_skipped: number
  model: string
  cost_usd: number
}

const SEVERITY_ORDER = ['critical', 'high', 'medium', 'low', 'info'] as const

export function renderAuditReport(output: AuditorOutput, ctx: RunContext): string {
  const findings = [...output.findings].sort((a, b) => {
    const sa = SEVERITY_ORDER.indexOf(a.severity)
    const sb = SEVERITY_ORDER.indexOf(b.severity)
    if (sa !== sb) return sa - sb
    return b.revenue_impact_eur_estimate - a.revenue_impact_eur_estimate
  })

  const lines: string[] = []
  lines.push(`# CHECKOUT_AUDIT_REPORT — Aquier`)
  lines.push('')
  lines.push(`**Run id:** \`${ctx.run_id}\``)
  lines.push(`**Started:** ${ctx.started_at}`)
  lines.push(`**Completed:** ${ctx.completed_at}`)
  lines.push(`**Scenarios:** ${ctx.total_scenarios} (${ctx.scenarios_passed} passed · ${ctx.scenarios_failed} failed · ${ctx.scenarios_skipped} skipped)`)
  lines.push(`**Model:** ${ctx.model}`)
  lines.push(`**Audit cost:** $${ctx.cost_usd.toFixed(2)}`)
  lines.push(`**Health score:** ${output.summary.overall_health_score}/100`)
  lines.push('')
  lines.push(`## Executive summary`)
  lines.push('')
  lines.push(output.summary.executive_summary)
  lines.push('')

  // By severity table
  lines.push(`## Findings overview`)
  lines.push('')
  lines.push('| Severity | Count |')
  lines.push('|---|---:|')
  for (const sev of SEVERITY_ORDER) {
    const n = output.summary.by_severity[sev] ?? 0
    if (n > 0) lines.push(`| ${sev} | ${n} |`)
  }
  lines.push('')

  // By category
  if (Object.keys(output.summary.by_category).length > 0) {
    lines.push('| Category | Count |')
    lines.push('|---|---:|')
    const cats = Object.entries(output.summary.by_category).sort((a, b) => b[1] - a[1])
    for (const [cat, n] of cats) lines.push(`| ${cat} | ${n} |`)
    lines.push('')
  }

  // Gap analysis
  if (output.summary.countries_with_no_checkout.length > 0) {
    lines.push(`## Gap analysis — countries with no working checkout`)
    lines.push('')
    for (const c of output.summary.countries_with_no_checkout) {
      lines.push(`- \`${c}\``)
    }
    lines.push('')
  }
  if (output.summary.tiers_with_issues.length > 0) {
    lines.push(`## Tiers with issues`)
    lines.push('')
    for (const t of output.summary.tiers_with_issues) lines.push(`- \`${t}\``)
    lines.push('')
  }

  // Detailed findings
  lines.push(`## Detailed findings`)
  lines.push('')
  if (findings.length === 0) {
    lines.push(`*No findings. All scenarios passed.*`)
  } else {
    for (let i = 0; i < findings.length; i++) {
      const f = findings[i]
      lines.push(`### ${i + 1}. [${f.severity.toUpperCase()}] ${f.category} — ${f.affected_tier}/${f.affected_country}/${f.affected_billing_cycle}/${f.affected_device}`)
      lines.push('')
      lines.push(`- **Route:** \`${f.affected_route}\``)
      lines.push(`- **Confidence:** ${(f.confidence_score * 100).toFixed(0)}%`)
      lines.push(`- **Estimated revenue impact:** €${Math.round(f.revenue_impact_eur_estimate).toLocaleString('nl-NL')}/month`)
      lines.push(`  *(${f.revenue_impact_reasoning})*`)
      if (f.stripe_object_ids.length > 0) {
        lines.push(`- **Stripe objects:** ${f.stripe_object_ids.map(id => `\`${id}\``).join(', ')}`)
      }
      lines.push('')
      lines.push(`**Evidence:**`)
      lines.push('')
      lines.push(`> ${f.evidence_summary.replace(/\n/g, '\n> ')}`)
      lines.push('')
      lines.push(`**Recommended fix:**`)
      lines.push('')
      lines.push(f.recommended_fix)
      lines.push('')
      if (f.evidence_artifact_paths.length > 0) {
        lines.push(`**Artifacts:**`)
        for (const p of f.evidence_artifact_paths) lines.push(`- \`${p}\``)
        lines.push('')
      }
      lines.push('---')
      lines.push('')
    }
  }

  return lines.join('\n')
}
