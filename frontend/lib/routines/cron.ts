/**
 * Minimale cron-evaluator zonder externe dependencies.
 *
 * Ondersteunt: minute (0-59 of *), hour (0-23 of *), dom/mon/dow als *.
 * Voor complexere expressies (lijst, range, step) moet je een echte
 * cron-parser gebruiken — komt in een latere fase met `cron-parser` npm dep.
 *
 * Apart bestand omdat actions.ts ('use server') alleen async exports mag hebben.
 */
export function computeNextCron(expr: string): string | null {
  const parts = expr.trim().split(/\s+/)
  if (parts.length !== 5) return null

  const [m, h, dom, mon, dow] = parts
  if (dom !== '*' || mon !== '*' || dow !== '*') {
    // v1: alleen wildcard op DOM/MON/DOW
    return null
  }

  const now = new Date()
  const candidate = new Date(now)
  candidate.setSeconds(0, 0)

  const matchM = m === '*' ? null : Number(m)
  const matchH = h === '*' ? null : Number(h)

  if (matchM !== null && (matchM < 0 || matchM > 59 || isNaN(matchM))) return null
  if (matchH !== null && (matchH < 0 || matchH > 23 || isNaN(matchH))) return null

  // Zoek volgende geldige minuut binnen 25 uur
  for (let i = 0; i < 60 * 25; i++) {
    candidate.setTime(candidate.getTime() + 60_000)
    if (matchH !== null && candidate.getHours() !== matchH) continue
    if (matchM !== null && candidate.getMinutes() !== matchM) continue
    return candidate.toISOString()
  }

  if (m === '*' && h === '*') {
    candidate.setTime(now.getTime() + 60_000)
    return candidate.toISOString()
  }

  return null
}
