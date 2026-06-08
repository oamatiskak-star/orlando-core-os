import { logRouter } from '../db.js'
import { hermesDb, newContext, type RoutingRequestRow } from './shared.js'
import { classifyProject } from './project-engine.js'
import { buildContextBundle } from './memory-engine.js'
import { matchSkills } from './skill-match.js'
import { matchAgents } from './agent-match.js'
import { selectBoards } from './board-engine.js'
import { detectIncident, raiseIncidentAlert } from './incident.js'
import { runPreflight, mergeAdvice } from './preflight.js'
import { dispatchPlan } from './dispatch.js'

export interface PlanSummary {
  plan_id: string
  active_project: string
  priority: 'P1' | 'P2' | 'P3'
  status: string
  dispatched: number
  gated: number
}

/**
 * The self-routing pipeline. Runs all 6 layers locally, preflight (cloud,
 * advisory), then auto-dispatches reversible work / gates irreversible work.
 * Writes hermes.routing_plans and advances hermes.routing_requests.status.
 */
export async function runPlan(request: RoutingRequestRow): Promise<PlanSummary> {
  const ctx = newContext(request)
  // Incident flag = frontend pre-flag OR local re-detection (defensive).
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

    // PREFLIGHT (cloud advisory, degrades to {} without keys).
    const advice = await runPreflight(ctx, project.active_project, skills, agents, boards)
    const finalSel = mergeAdvice(skills, agents, boards, advice)

    // Persist the plan (draft) so dispatch/approvals can reference plan_id.
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
        preflight_advice: advice,
        final_selection: { project: project.active_project, ...finalSel },
        priority,
        model_trace: ctx.trace,
        status: 'draft',
      })
      .select('id')
      .single()
    if (planErr || !planRow) throw new Error(`plan insert failed: ${planErr?.message ?? 'no row'}`)
    const planId = planRow.id as string

    // EXECUTION — reversible → dispatch_queue; irreversible → approvals (gate).
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

    if (request.is_incident) {
      await raiseIncidentAlert({ companyId: request.company_id, message: request.raw_message, activeProject: project.active_project })
    }

    await logRouter('info', 'hermes_routing_plan', {
      request_id: request.id,
      project: project.active_project,
      skills: skills.map(s => s.name),
      dispatched: dispatched.length,
      gated: gated.length,
      priority,
    })

    return { plan_id: planId, active_project: project.active_project, priority, status: planStatus, dispatched: dispatched.length, gated: gated.length }
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
