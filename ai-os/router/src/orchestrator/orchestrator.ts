import { logRouter } from '../db.js'
import { hermesDb, newContext, type RoutingRequestRow } from './shared.js'
import { classifyProject } from './project-engine.js'
import { buildContextBundle } from './memory-engine.js'
import { matchSkills } from './skill-match.js'
import { matchAgents } from './agent-match.js'
import { selectBoards } from './board-engine.js'
import { detectIncident, raiseIncidentAlert } from './incident.js'
import { matchPlaybook } from './playbook-engine.js'
import { computeConfidence, decideEscalation } from './confidence.js'
import { runCouncil, mergeCouncil } from './preflight.js'
import { dispatchPlan } from './dispatch.js'

export interface PlanSummary {
  plan_id: string
  active_project: string
  priority: 'P1' | 'P2' | 'P3'
  status: string
  confidence: number
  escalation: string
  playbook: string | null
  council_members: string[]
  dispatched: number
  gated: number
}

/**
 * De self-routing pipeline (FASE 1-8). Volgorde:
 *   L1 project → L2 memory → L3 skills → L4 agents → L5 boards
 *   → confidence (FASE 4) → playbook (FASE 3, vóór model-escalatie)
 *   → council (FASE 8, lokaal eerst, cloud volgens escalatie)
 *   → plan → dispatch → routing_learning (FASE 5).
 * Lokale lagen draaien localOnly (token-besparing). Cloud alleen waar nodig.
 */
export async function runPlan(request: RoutingRequestRow): Promise<PlanSummary> {
  const ctx = newContext(request)
  request.is_incident = request.is_incident || detectIncident(request.raw_message)
  const priority: 'P1' | 'P2' | 'P3' = request.is_incident ? 'P1' : 'P3'

  try {
    await hermesDb().from('routing_requests').update({ status: 'planning', heartbeat_at: new Date().toISOString() }).eq('id', request.id)

    // LAAG 1-5 (local-first).
    const project = await classifyProject(ctx)
    const contextBundle = await buildContextBundle(ctx, project.active_project)
    const skills = await matchSkills(ctx, project.active_project)
    const agents = await matchAgents(skills)
    const { candidates: boards } = await selectBoards(ctx, skills)

    // FASE 4 — confidence + escalatiebesluit.
    const confidence = computeConfidence({ projectConfidence: project.confidence, skills, agents, boards })
    const escalation = decideEscalation(confidence.combined, request.is_incident)

    // FASE 3 — playbook laden VÓÓR model-escalatie (deterministische checks eerst).
    const playbook = await matchPlaybook(ctx.request.raw_message, skills)

    // FASE 8 — council (lokaal raadslid altijd; GPT/Claude volgens escalatie).
    const council = await runCouncil(ctx, project.active_project, skills, agents, boards, playbook, escalation)
    const finalSel = mergeCouncil(skills, agents, boards, council)

    // Persist plan (draft).
    const { data: planRow, error: planErr } = await hermesDb()
      .from('routing_plans')
      .insert({
        request_id: request.id,
        company_id: request.company_id,
        active_project: project.active_project,
        project_confidence: project.confidence,
        context_bundle: contextBundle,
        candidate_skills: skills,
        candidate_agents: agents,
        candidate_boards: boards,
        preflight_advice: council,
        final_selection: {
          project: project.active_project,
          ...finalSel,
          confidence,
          escalation,
          playbook: playbook?.slug ?? null,
          council_members: council.members,
        },
        priority,
        model_trace: ctx.trace,
        status: 'draft',
      })
      .select('id')
      .single()
    if (planErr || !planRow) throw new Error(`plan insert failed: ${planErr?.message ?? 'no row'}`)
    const planId = planRow.id as string

    // EXECUTION — reversibel → dispatch_queue; onomkeerbaar → approvals (gate).
    const { dispatched, gated } = await dispatchPlan({
      ctx,
      planId,
      activeProject: project.active_project,
      priority,
      skills,
      agents: finalSel.agents,
      boards: finalSel.boards,
    })

    const planStatus = gated.length > 0 ? 'gated' : dispatched.length > 0 ? 'dispatched' : 'done'
    await hermesDb()
      .from('routing_plans')
      .update({ dispatched_actions: dispatched, gated_actions: gated, status: planStatus, model_trace: ctx.trace })
      .eq('id', planId)
    await hermesDb().from('routing_requests').update({ status: 'done' }).eq('id', request.id)

    // FASE 5 — feedback-loop: leg de combinatie vast (success=null tot bekend).
    const modelsUsed = ctx.trace.map(t => ({ layer: t.layer, provider: t.provider, model: t.model }))
    await hermesDb()
      .from('routing_learning')
      .insert({
        plan_id: planId,
        request_id: request.id,
        company_id: request.company_id,
        problem_type: playbook?.slug ?? (request.is_incident ? 'incident' : 'general'),
        active_project: project.active_project,
        chosen_skills: finalSel.skills,
        chosen_agents: finalSel.agents,
        chosen_boards: finalSel.boards,
        models_used: modelsUsed,
        confidence: confidence.combined,
        escalation,
        playbook: playbook?.slug ?? null,
        success: null,
      })
      .then(() => {}, () => {})

    if (request.is_incident) {
      await raiseIncidentAlert({ companyId: request.company_id, message: request.raw_message, activeProject: project.active_project })
    }

    await logRouter('info', 'hermes_routing_plan', {
      request_id: request.id,
      project: project.active_project,
      confidence: confidence.combined,
      escalation,
      playbook: playbook?.slug ?? null,
      council: council.members,
      skills: skills.map(s => s.name),
      dispatched: dispatched.length,
      gated: gated.length,
      priority,
    })

    return {
      plan_id: planId,
      active_project: project.active_project,
      priority,
      status: planStatus,
      confidence: confidence.combined,
      escalation,
      playbook: playbook?.slug ?? null,
      council_members: council.members,
      dispatched: dispatched.length,
      gated: gated.length,
    }
  } catch (e) {
    const msg = (e as Error).message
    await hermesDb().from('routing_requests').update({ status: 'failed', error: msg }).eq('id', request.id).then(
      () => {},
      () => {},
    )
    await logRouter('error', 'hermes_routing_failed', { request_id: request.id, error: msg })
    throw e
  }
}
