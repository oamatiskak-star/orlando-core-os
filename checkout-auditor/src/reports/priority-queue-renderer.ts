import type { AuditorOutput, Finding } from '../types'

const SEVERITY_WEIGHT: Record<string, number> = {
  critical: 1000,
  high: 200,
  medium: 50,
  low: 10,
  info: 1,
}

export type RankedFinding = Finding & {
  rank: number
  priority_score: number
}

/**
 * Sorts findings by priority_score = severity_weight × revenue_impact × confidence.
 * Returns top N findings ranked.
 */
export function rankFindings(findings: Finding[], top = 50): RankedFinding[] {
  const scored = findings.map(f => ({
    ...f,
    priority_score: (SEVERITY_WEIGHT[f.severity] ?? 1) * (1 + f.revenue_impact_eur_estimate / 1000) * f.confidence_score,
  }))
  scored.sort((a, b) => b.priority_score - a.priority_score)
  return scored.slice(0, top).map((f, i) => ({ ...f, rank: i + 1 }))
}

export function renderPriorityQueue(findings: Finding[], runId: string, top = 50): { markdown: string; ranked: RankedFinding[] } {
  const ranked = rankFindings(findings, top)
  const lines: string[] = []
  lines.push(`# PRIORITY_FIX_QUEUE — Aquier checkout audit`)
  lines.push('')
  lines.push(`**Run id:** \`${runId}\``)
  lines.push(`**Top ${ranked.length} of ${findings.length} findings ranked by severity × revenue × confidence**`)
  lines.push('')
  lines.push(`| Rank | Score | Severity | Category | Tier | Country | Cycle | Device | Est. €/mo | Conf | Fix summary |`)
  lines.push(`|---:|---:|---|---|---|---|---|---|---:|---:|---|`)
  for (const r of ranked) {
    const fixSummary = r.recommended_fix.replace(/\n/g, ' ').slice(0, 80) + (r.recommended_fix.length > 80 ? '…' : '')
    lines.push(
      `| ${r.rank} | ${Math.round(r.priority_score)} | ${r.severity} | ${r.category} | ${r.affected_tier} | ${r.affected_country} | ${r.affected_billing_cycle} | ${r.affected_device} | ${Math.round(r.revenue_impact_eur_estimate).toLocaleString('nl-NL')} | ${(r.confidence_score * 100).toFixed(0)}% | ${fixSummary} |`,
    )
  }
  return { markdown: lines.join('\n'), ranked }
}
