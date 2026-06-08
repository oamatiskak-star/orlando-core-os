import { hermesDb, type BoardCandidate, type RoutingContext, type SkillCandidate } from './shared.js'

export interface BoardRow {
  key: string
  label: string
  persona_prompt: string
}

/**
 * LAAG 5 — activate candidate_boards[] from hermes.boards. Deterministic:
 * union of the boards hinted by the selected skills, plus Operator (always, for
 * execution) and Contrarian (always on incidents, to surface what breaks).
 */
export async function selectBoards(
  ctx: RoutingContext,
  skills: SkillCandidate[],
): Promise<{ candidates: BoardCandidate[]; rows: Map<string, BoardRow> }> {
  const { data } = await hermesDb().from('boards').select('key, label, persona_prompt').eq('enabled', true)
  const rows = new Map<string, BoardRow>()
  for (const r of (data ?? []) as BoardRow[]) rows.set(r.key, r)

  const keys = new Set<string>()
  for (const s of skills) for (const b of s.boards) keys.add(b)
  keys.add('operator')
  if (ctx.request.is_incident) keys.add('contrarian')

  const candidates: BoardCandidate[] = []
  for (const key of keys) {
    const row = rows.get(key)
    if (row) candidates.push({ key, label: row.label })
  }
  return { candidates, rows }
}
