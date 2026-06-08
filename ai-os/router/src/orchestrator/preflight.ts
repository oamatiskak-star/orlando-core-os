import { router } from '../router.js'
import { extractJson, pushTrace, type BoardCandidate, type RoutingContext, type SkillCandidate, type AgentCandidate } from './shared.js'
import type { Escalation } from './confidence.js'
import type { Playbook } from './playbook-engine.js'
import type { ProviderId } from '../types.js'

export interface Advice {
  added_skills: string[]
  added_agents: string[]
  added_boards: string[]
  risks: string[]
  ordering: string[]
}

export interface CouncilResult {
  local?: Advice   // lokaal raadslid (mistral) — altijd, gratis
  gpt?: Advice     // GPT — second opinion
  claude?: Advice  // Claude — alleen indien noodzakelijk
  members: string[] // welke modellen daadwerkelijk meededen
}

const EMPTY: Advice = { added_skills: [], added_agents: [], added_boards: [], risks: [], ordering: [] }

function buildPrompt(
  ctx: RoutingContext,
  project: string,
  skills: SkillCandidate[],
  agents: AgentCandidate[],
  boards: BoardCandidate[],
  playbook: Playbook | null,
): string {
  return (
    `Incident/opdracht ontvangen.\n\n` +
    `Project: ${project}\n` +
    `Bericht: """${ctx.request.raw_message}"""\n\n` +
    (playbook ? `Reeds geladen playbook: "${playbook.title}" (${playbook.slug}). De deterministische checks hieruit zijn al uitgevoerd vóór jou.\n\n` : '') +
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

const SYSTEM =
  'Je bent een AI advisory-laad (council-lid) voor de Hermes-orchestrator. Je voert NIETS uit; je adviseert ' +
  'alleen aanvullingen op de selectie. Wees beknopt en concreet.'

async function ask(
  ctx: RoutingContext,
  provider: ProviderId,
  layer: string,
  prompt: string,
  localOnly: boolean,
): Promise<Advice | undefined> {
  try {
    const resp = await router.complete({
      tier: localOnly ? 'classification' : 'reasoning',
      provider: localOnly ? undefined : provider,
      localOnly,
      jsonMode: true,
      caller: `hermes-orch:${layer}`,
      maxTokens: localOnly ? 400 : 600,
      temperature: 0.2,
      system: SYSTEM,
      messages: [{ role: 'user', content: prompt }],
    })
    pushTrace(ctx, layer, localOnly ? 'classification' : 'reasoning', resp)
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
    return undefined
  }
}

/**
 * FASE 8 — Multi-Model Council, gestuurd door FASE 4 escalatie:
 *   - lokaal raadslid (mistral) draait ALTIJD eerst (gratis, token-besparend)
 *   - 'gpt'     → + GPT
 *   - 'claude'  → + GPT + Claude
 *   - 'council' → + GPT + Claude (P1)
 *   - 'local'   → alleen lokaal raadslid (geen cloud)
 * Degradeert netjes naar {} zonder API-keys.
 */
export async function runCouncil(
  ctx: RoutingContext,
  project: string,
  skills: SkillCandidate[],
  agents: AgentCandidate[],
  boards: BoardCandidate[],
  playbook: Playbook | null,
  escalation: Escalation,
): Promise<CouncilResult> {
  const prompt = buildPrompt(ctx, project, skills, agents, boards, playbook)
  const out: CouncilResult = { members: [] }

  // Lokaal raadslid — altijd, gratis.
  out.local = (await ask(ctx, 'ollama', 'council:local', prompt, true)) ?? undefined
  if (out.local) out.members.push('ollama')

  const wantGpt = escalation === 'gpt' || escalation === 'claude' || escalation === 'council'
  const wantClaude = escalation === 'claude' || escalation === 'council'

  if (wantGpt) {
    out.gpt = (await ask(ctx, 'openai', 'council:gpt', prompt, false)) ?? undefined
    if (out.gpt) out.members.push('openai')
  }
  if (wantClaude) {
    out.claude = (await ask(ctx, 'anthropic', 'council:claude', prompt, false)) ?? undefined
    if (out.claude) out.members.push('anthropic')
  }
  return out
}

/** Consensus: voeg alle raadsleden-adviezen samen in de finale selectie (namen, gededupliceerd). */
export function mergeCouncil(
  skills: SkillCandidate[],
  agents: AgentCandidate[],
  boards: BoardCandidate[],
  council: CouncilResult,
): { skills: string[]; agents: string[]; boards: string[]; risks: string[]; ordering: string[] } {
  const all = [council.local ?? EMPTY, council.gpt ?? EMPTY, council.claude ?? EMPTY]
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
