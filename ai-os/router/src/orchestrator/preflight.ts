import { router } from '../router.js'
import { extractJson, pushTrace, type BoardCandidate, type RoutingContext, type SkillCandidate, type AgentCandidate } from './shared.js'
import type { ProviderId } from '../types.js'

export interface Advice {
  added_skills: string[]
  added_agents: string[]
  added_boards: string[]
  risks: string[]
  ordering: string[]
}

export interface PreflightResult {
  gpt?: Advice
  claude?: Advice
}

const EMPTY: Advice = { added_skills: [], added_agents: [], added_boards: [], risks: [], ordering: [] }

// Skills that imply code / architecture / audit work → worth a Claude opinion.
const CLAUDE_SKILLS = new Set(['frontend_review', 'backend_review', 'scaling_review', 'checkout_review', 'risk_review'])

function needsClaude(skills: SkillCandidate[], isIncident: boolean, message: string): boolean {
  if (isIncident) return true
  if (skills.some(s => CLAUDE_SKILLS.has(s.name))) return true
  return /\b(architect|code|audit|migrat|security|schaal|scaling|refactor)/i.test(message)
}

function buildPrompt(
  ctx: RoutingContext,
  project: string,
  skills: SkillCandidate[],
  agents: AgentCandidate[],
  boards: BoardCandidate[],
): string {
  return (
    `Incident ontvangen.\n\n` +
    `Project: ${project}\n` +
    `Bericht: """${ctx.request.raw_message}"""\n\n` +
    `Mijn voorlopige selectie:\n` +
    `- skills: ${skills.map(s => s.name).join(', ') || '(geen)'}\n` +
    `- agents: ${agents.map(a => a.name).join(', ') || '(geen)'}\n` +
    `- boards: ${boards.map(b => b.key).join(', ') || '(geen)'}\n\n` +
    `Controleer: (1) welke skills ontbreken, (2) welke agents ontbreken, (3) welke boards ontbreken, ` +
    `(4) welke oorzaken/risico's ontbreken, (5) welke volgorde adviseer je? ` +
    `Voeg alleen toe, voer niets uit.\n\n` +
    `Antwoord UITSLUITEND met JSON: {"added_skills":[],"added_agents":[],"added_boards":[],"risks":[],"ordering":[]}.`
  )
}

async function ask(ctx: RoutingContext, provider: ProviderId, layer: string, prompt: string): Promise<Advice | undefined> {
  try {
    const resp = await router.complete({
      tier: 'reasoning',
      provider,
      jsonMode: true,
      caller: `hermes-orch:${layer}`,
      maxTokens: 600,
      temperature: 0.2,
      system:
        'Je bent een AI advisory-laag voor de Hermes-orchestrator. Je voert NIETS uit; je adviseert alleen ' +
        'aanvullingen op de selectie. Wees beknopt en concreet.',
      messages: [{ role: 'user', content: prompt }],
    })
    pushTrace(ctx, layer, 'reasoning', resp)
    const parsed = extractJson<Partial<Advice>>(resp.text)
    if (!parsed) return undefined
    return {
      added_skills: parsed.added_skills ?? [],
      added_agents: parsed.added_agents ?? [],
      added_boards: parsed.added_boards ?? [],
      risks: parsed.risks ?? [],
      ordering: parsed.ordering ?? [],
    }
  } catch {
    // Provider key missing / unreachable → degrade gracefully (no advice).
    return undefined
  }
}

/**
 * PREFLIGHT REVIEW LOOP — GPT (always, second opinion) + Claude (only for
 * code/architecture/audit/complex). Advisory only. Degrades to {} without keys.
 */
export async function runPreflight(
  ctx: RoutingContext,
  project: string,
  skills: SkillCandidate[],
  agents: AgentCandidate[],
  boards: BoardCandidate[],
): Promise<PreflightResult> {
  const prompt = buildPrompt(ctx, project, skills, agents, boards)
  const out: PreflightResult = {}

  out.gpt = (await ask(ctx, 'openai', 'preflight:gpt', prompt)) ?? undefined
  if (needsClaude(skills, ctx.request.is_incident, ctx.request.raw_message)) {
    out.claude = (await ask(ctx, 'anthropic', 'preflight:claude', prompt)) ?? undefined
  }
  return out
}

/** Merge advisory additions into the final selection (names only, de-duplicated). */
export function mergeAdvice(
  skills: SkillCandidate[],
  agents: AgentCandidate[],
  boards: BoardCandidate[],
  advice: PreflightResult,
): {
  skills: string[]
  agents: string[]
  boards: string[]
  risks: string[]
  ordering: string[]
} {
  const all = [advice.gpt ?? EMPTY, advice.claude ?? EMPTY]
  const skillNames = new Set(skills.map(s => s.name))
  const agentNames = new Set(agents.map(a => a.name))
  const boardKeys = new Set(boards.map(b => b.key))
  const risks = new Set<string>()
  const ordering: string[] = []

  for (const a of all) {
    a.added_skills.forEach(s => skillNames.add(s))
    a.added_agents.forEach(x => agentNames.add(x))
    a.added_boards.forEach(b => boardKeys.add(b))
    a.risks.forEach(r => risks.add(r))
    a.ordering.forEach(o => {
      if (!ordering.includes(o)) ordering.push(o)
    })
  }

  return {
    skills: [...skillNames],
    agents: [...agentNames],
    boards: [...boardKeys],
    risks: [...risks],
    ordering,
  }
}
