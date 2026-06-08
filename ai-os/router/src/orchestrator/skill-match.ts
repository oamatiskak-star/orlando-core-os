import { hermesDb, localJson, tokenize, type RoutingContext, type SkillCandidate } from './shared.js'
import type { ProjectName } from './shared.js'

interface SkillRow {
  id: string
  name: string
  description: string | null
  metadata: {
    hint?: string
    target_host?: string
    reversible?: boolean
    boards?: string[]
    agents?: string[]
  } | null
}

/**
 * LAAG 3 — select candidate_skills[] from the seeded hermes.skills.
 * Hybrid: cheap local keyword overlap to pre-score, then a single local mistral
 * call to confirm/rank. Falls back to pure keyword scoring if the LLM is down.
 */
export async function matchSkills(ctx: RoutingContext, activeProject: ProjectName): Promise<SkillCandidate[]> {
  const { data } = await hermesDb()
    .from('skills')
    .select('id, name, description, metadata')
    .eq('enabled', true)
  const rows = (data ?? []) as SkillRow[]
  if (rows.length === 0) return []

  const msgTokens = tokenize(ctx.request.raw_message)

  // Deterministic keyword score per skill (0..1-ish).
  const scored = rows.map(r => {
    const hintTokens = tokenize(`${r.metadata?.hint ?? ''} ${r.description ?? ''}`)
    let overlap = 0
    for (const t of msgTokens) if (hintTokens.has(t)) overlap += 1
    return { row: r, base: overlap }
  })

  // Local LLM refine — ask mistral which skill names are relevant.
  const llm = await localJson<{ skills: string[] }>({
    layer: 'L3',
    ctx,
    system:
      'Je selecteert relevante skills. Antwoord UITSLUITEND met JSON: {"skills": ["naam", ...]} ' +
      '(alleen namen uit de lijst, maximaal 4, meest relevante eerst).',
    prompt:
      `Project: ${activeProject}\n` +
      `Bericht: """${ctx.request.raw_message}"""\n` +
      `Beschikbare skills:\n${rows.map(r => `- ${r.name}: ${r.metadata?.hint ?? r.description ?? ''}`).join('\n')}\n` +
      'Welke skills zijn relevant?',
    maxTokens: 200,
  })
  const llmPicked = new Set((llm?.skills ?? []).map(s => s.toLowerCase()))

  const candidates: SkillCandidate[] = scored
    .map(({ row, base }) => {
      const llmBoost = llmPicked.has(row.name.toLowerCase()) ? 1 : 0
      const score = Math.min(1, base * 0.15 + llmBoost * 0.7)
      return {
        skill_id: row.id,
        name: row.name,
        score,
        target_host: row.metadata?.target_host ?? 'cli-l',
        reversible: row.metadata?.reversible ?? true,
        boards: row.metadata?.boards ?? [],
        agents: row.metadata?.agents ?? [],
      }
    })
    .filter(c => c.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)

  return candidates
}
