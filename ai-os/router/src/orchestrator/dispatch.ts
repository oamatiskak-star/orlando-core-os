import { hermesDb, type RoutingContext, type SkillCandidate } from './shared.js'

export interface DispatchedAction {
  dispatch_queue_id: string
  title: string
  target_host: string
  skill: string
}

export interface GatedAction {
  approval_id: string
  kind: string
  reason: string
}

// Irreversible-intent detection → HARD GATE (Orlando approval required).
const DANGER_KINDS: Array<{ kind: 'stripe_live' | 'prod_db_migration' | 'git_push' | 'vercel_deploy'; re: RegExp }> = [
  { kind: 'stripe_live', re: /\bstripe\b.*\b(live|productie|echte? betaling)|\b(live|prod).*stripe\b/i },
  { kind: 'prod_db_migration', re: /\b(migrat\w*|alter table|drop table)\b.*\b(prod|productie)\b|\bprod(uctie)?\b.*\bmigrat/i },
  { kind: 'git_push', re: /\bgit push\b|\bpush.*\b(main|productie|prod)\b|\bmerge.*\b(main|prod)\b/i },
  { kind: 'vercel_deploy', re: /\b(vercel|deploy|promote).*\b(prod|productie|live)\b|\bdeploy(en)? naar (prod|productie|live)\b/i },
]

function detectIrreversible(message: string): GatedAction['kind'][] {
  const out: GatedAction['kind'][] = []
  for (const d of DANGER_KINDS) if (d.re.test(message) && !out.includes(d.kind)) out.push(d.kind)
  return out
}

/**
 * EXECUTION — auto-dispatch REVERSIBLE skill work to hermes.dispatch_queue;
 * route IRREVERSIBLE intent to hermes.approvals (pending) instead of executing.
 */
export async function dispatchPlan(opts: {
  ctx: RoutingContext
  planId: string
  activeProject: string
  priority: 'P1' | 'P2' | 'P3'
  skills: SkillCandidate[]
  agents: string[]
  boards: string[]
}): Promise<{ dispatched: DispatchedAction[]; gated: GatedAction[] }> {
  const { ctx, planId, activeProject, priority, skills, agents, boards } = opts
  const dispatched: DispatchedAction[] = []
  const gated: GatedAction[] = []
  const msg = ctx.request.raw_message

  // 1. Reversible skill work → dispatch_queue.
  for (const s of skills) {
    if (!s.reversible) continue
    const targetHost = s.target_host === 'cli-r' ? 'cli-r' : 'cli-l'
    const title = `${s.name}: ${msg.slice(0, 80)}`
    try {
      const { data, error } = await hermesDb()
        .from('dispatch_queue')
        .insert({
          title,
          workstream: priority,
          target_host: targetHost,
          priority: priority === 'P1' ? 1 : priority === 'P2' ? 3 : 5,
          payload: {
            source: 'hermes-orchestrator',
            request_id: ctx.request.id,
            plan_id: planId,
            project: activeProject,
            skill: s.name,
            agents,
            boards,
            raw_message: msg,
          },
        })
        .select('id')
        .single()
      if (!error && data) {
        dispatched.push({ dispatch_queue_id: data.id as string, title, target_host: targetHost, skill: s.name })
      }
    } catch {
      /* one failed insert must not abort the whole plan */
    }
  }

  // 2. Irreversible intent → approvals (HARD GATE). Never dispatched here.
  for (const kind of detectIrreversible(msg)) {
    const reason = `Onomkeerbare actie gedetecteerd (${kind}). Vereist expliciete goedkeuring van Orlando.`
    try {
      const { data, error } = await hermesDb()
        .from('approvals')
        .insert({
          plan_id: planId,
          company_id: ctx.request.company_id,
          action_kind: kind,
          title: `${kind} — ${activeProject}`,
          reason,
          payload: { request_id: ctx.request.id, raw_message: msg },
        })
        .select('id')
        .single()
      if (!error && data) gated.push({ approval_id: data.id as string, kind, reason })
    } catch {
      /* gate insert best-effort */
    }
  }

  return { dispatched, gated }
}
