import type { createAdminClient } from '@/lib/supabase/admin'

type AdminClient = ReturnType<typeof createAdminClient>

export interface RoutingPlanRow {
  id: string
  request_id: string
  active_project: string | null
  project_confidence: number | null
  candidate_skills: Array<{ name: string; score: number }>
  candidate_agents: Array<{ name: string; source: string }>
  candidate_boards: Array<{ key: string; label: string }>
  preflight_advice: { gpt?: { risks?: string[] }; claude?: { risks?: string[] } }
  final_selection: { project?: string; skills?: string[]; agents?: string[]; boards?: string[]; risks?: string[]; ordering?: string[] }
  priority: 'P1' | 'P2' | 'P3'
  dispatched_actions: Array<{ title: string; target_host: string; skill: string }>
  gated_actions: Array<{ kind: string; reason: string }>
  status: string
}

/** Schrijf een routing-request in hermes.routing_requests (de lokale orchestrator pakt op). */
export async function submitRoutingRequest(
  db: AdminClient,
  opts: { company_id: string; raw_message: string; is_incident: boolean },
): Promise<string | null> {
  const { data, error } = await db
    .schema('hermes')
    .from('routing_requests')
    .insert({
      company_id: opts.company_id,
      raw_message: opts.raw_message,
      source: 'command-center',
      requested_by: 'orlando',
      is_incident: opts.is_incident,
      status: 'queued',
    })
    .select('id')
    .single()
  if (error || !data) return null
  return data.id as string
}

/** Poll hermes.routing_plans tot er een plan is of het budget op is. */
export async function pollRoutingPlan(
  db: AdminClient,
  requestId: string,
  budgetMs = 30_000,
  intervalMs = 800,
): Promise<RoutingPlanRow | null> {
  const deadline = Date.now() + budgetMs
  while (Date.now() < deadline) {
    const { data } = await db
      .schema('hermes')
      .from('routing_plans')
      .select('*')
      .eq('request_id', requestId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (data && (data as RoutingPlanRow).status !== 'draft') return data as RoutingPlanRow
    await new Promise((r) => setTimeout(r, intervalMs))
  }
  return null
}

/** Bouw een leesbare Hermes-reply uit een routing-plan. */
export function formatPlanReply(plan: RoutingPlanRow): {
  reply: string
  actions: Array<{ label: string; detail?: string }>
  suggestions: string[]
} {
  const sel = plan.final_selection ?? {}
  const lines: string[] = []
  lines.push(`🧠 **Hermes routing-plan** — project: **${plan.active_project ?? 'onbekend'}** (${plan.priority})`)
  if (sel.skills?.length) lines.push(`• Skills: ${sel.skills.join(', ')}`)
  if (sel.agents?.length) lines.push(`• Agents: ${sel.agents.join(', ')}`)
  if (sel.boards?.length) lines.push(`• Boards: ${sel.boards.join(', ')}`)
  if (sel.risks?.length) lines.push(`• Risico's: ${sel.risks.slice(0, 4).join('; ')}`)

  const actions = plan.dispatched_actions.map((a) => ({
    label: `Gestart: ${a.skill}`,
    detail: `→ ${a.target_host}`,
  }))

  if (plan.dispatched_actions.length) {
    lines.push(`✅ ${plan.dispatched_actions.length} taak/taken gedispatcht naar de queue.`)
  }
  if (plan.gated_actions.length) {
    lines.push(
      `⛔ ${plan.gated_actions.length} onomkeerbare actie(s) wachten op jouw goedkeuring: ` +
        plan.gated_actions.map((g) => g.kind).join(', ') +
        ` — keur goed in /dashboard/operations/hermes.`,
    )
  }
  if (!plan.dispatched_actions.length && !plan.gated_actions.length) {
    lines.push('Geen uitvoerbare acties — alleen een routing-advies.')
  }

  const suggestions = plan.gated_actions.length
    ? ['Open goedkeuringen in /dashboard/operations/hermes']
    : []

  return { reply: lines.join('\n'), actions, suggestions }
}
