import type { AgentCandidate, BoardCandidate, SkillCandidate } from './shared.js'

export type Escalation = 'local' | 'gpt' | 'claude' | 'council'

export interface ConfidenceScore {
  project: number
  skill: number
  agent: number
  board: number
  combined: number
}

/**
 * FASE 4 — Confidence Engine.
 * Bereken deelscores en een gecombineerde score, en leid daaruit de
 * model-escalatie af. Lager = meer cloud-hulp nodig.
 */
export function computeConfidence(opts: {
  projectConfidence: number
  skills: SkillCandidate[]
  agents: AgentCandidate[]
  boards: BoardCandidate[]
}): ConfidenceScore {
  const project = clamp(opts.projectConfidence)
  // Skill: hoogste skill-score (0..1); geen skills → lage zekerheid.
  const skill = opts.skills.length ? clamp(opts.skills[0]!.score) : 0.2
  // Agent: fractie skills die ten minste één agent opleverde.
  const withAgents = opts.skills.filter(s => s.agents.length > 0).length
  const agent = opts.skills.length ? clamp(withAgents / opts.skills.length) : 0.3
  // Board: minstens één board geselecteerd → hoog (deterministisch).
  const board = opts.boards.length > 0 ? 0.95 : 0.4
  // Gewogen: project + skill wegen het zwaarst (bepalen routing).
  const combined = clamp(project * 0.4 + skill * 0.35 + agent * 0.15 + board * 0.1)
  return {
    project: round(project),
    skill: round(skill),
    agent: round(agent),
    board: round(board),
    combined: round(combined),
  }
}

/**
 * Beslisregels (spec FASE 4):
 *   P1 incident        → council (lokaal + GPT + Claude)
 *   combined < 0.70    → claude  (GPT + Claude review)
 *   0.70 .. 0.90       → gpt     (alleen GPT second opinion)
 *   > 0.90             → local   (geen cloud — maximale tokenbesparing)
 */
export function decideEscalation(combined: number, isIncident: boolean): Escalation {
  if (isIncident) return 'council'
  if (combined < 0.7) return 'claude'
  if (combined <= 0.9) return 'gpt'
  return 'local'
}

function clamp(n: number): number {
  if (Number.isNaN(n)) return 0
  return Math.max(0, Math.min(1, n))
}
function round(n: number): number {
  return Math.round(n * 1000) / 1000
}
