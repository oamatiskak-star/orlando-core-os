import { workerLogger } from '../lib/logger'
import { getSupabase, getActiveSprint, saveDailyPlan, logBottleneck } from '../lib/supabase'
import { notifyDailyPlan, notifyDeadlineRisk } from '../lib/notifications'
import { createTask, updateTask } from '../lib/clickup'

const log = workerLogger('daily-planner')

const SPRINT_BOARD_LIST_ID = process.env.CLICKUP_SPRINT_LIST_ID ?? ''
const DAILY_PLAN_LIST_ID   = process.env.CLICKUP_DAILY_PLAN_LIST_ID ?? ''

const AGENTS = [
  { slug: 'claude-sonnet',    machine: 'mac_mini_1', role: 'architect',  capacity: 8 },
  { slug: 'claude-haiku',     machine: 'mac_mini_2', role: 'executor',   capacity: 12 },
  { slug: 'lmstudio-mistral', machine: 'mac_mini_1', role: 'coder',      capacity: 6 },
  { slug: 'lmstudio-qwen',    machine: 'mac_mini_2', role: 'coder',      capacity: 6 },
  { slug: 'ollama-llama',     machine: 'mac_mini_2', role: 'researcher', capacity: 8 },
]

function calcRoiScore(task: {
  priority: number
  revenue_impact?: number
  estimated_hours?: number
}): number {
  const revImpact = task.revenue_impact ?? 0
  const hours = task.estimated_hours ?? 2
  const priorityBonus = task.priority * 5
  const revenueScore = Math.min(revImpact / 1000, 50)
  const efficiencyScore = Math.min(10 / hours, 20)
  return Math.round(priorityBonus + revenueScore + efficiencyScore)
}

function assignAgentToTask(task: {
  tags?: string[]
  agent_type?: string
  machine?: string
}): typeof AGENTS[0] {
  const agentType = task.agent_type ?? 'any'
  const machine   = task.machine ?? 'any'

  const candidates = AGENTS.filter(a => {
    if (machine !== 'any' && a.machine !== machine) return false
    if (agentType !== 'any' && a.role !== agentType) return false
    return true
  })

  return candidates[0] ?? AGENTS[0]
}

async function detectDeadlineRisks(): Promise<void> {
  const db = getSupabase()
  const threeDaysFromNow = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()

  const { data: atRisk } = await db
    .from('oc_planning_tasks')
    .select('*')
    .not('status', 'in', '("done","cancelled")')
    .not('due_date', 'is', null)
    .lte('due_date', threeDaysFromNow)

  if (!atRisk) return

  for (const task of atRisk) {
    const daysLeft = Math.ceil((new Date(task.due_date).getTime() - Date.now()) / 86400000)

    await logBottleneck({
      bottleneck_type: 'deadline_risk',
      severity: daysLeft <= 0 ? 'critical' : daysLeft <= 1 ? 'high' : 'medium',
      affected_task_id: task.id,
      description: `"${task.naam}" — ${daysLeft <= 0 ? 'OVERDUE' : daysLeft + 'd remaining'}`,
    })

    if (daysLeft <= 1) {
      await notifyDeadlineRisk(task.naam, daysLeft)
    }
  }
}

async function buildBuildSchedule(tasks: Record<string, unknown>[]): Promise<unknown[]> {
  const schedule: unknown[] = []
  let currentHour = 7

  const sorted = [...tasks].sort((a, b) =>
    ((b.roi_score as number) ?? 0) - ((a.roi_score as number) ?? 0)
  )

  for (const task of sorted.slice(0, 10)) {
    const hours = (task.estimated_hours as number) ?? 2
    const agent = assignAgentToTask(task as { tags?: string[]; agent_type?: string; machine?: string })
    schedule.push({
      start: `${currentHour}:00`,
      end: `${currentHour + hours}:00`,
      task: task.naam,
      agent: agent.slug,
      machine: agent.machine,
      roi: task.roi_score,
    })
    currentHour += hours
    if (currentHour >= 22) break
  }

  return schedule
}

function buildAgentMissions(tasks: Record<string, unknown>[]): Record<string, unknown> {
  const missions: Record<string, unknown> = {}

  for (const agent of AGENTS) {
    const agentTasks = tasks
      .filter(t => (t.agent_type === agent.role || t.agent_type === 'any' || !t.agent_type))
      .filter(t => (t.machine === agent.machine || t.machine === 'any' || !t.machine))
      .slice(0, 3)
      .map(t => ({ id: t.id, naam: t.naam, priority: t.priority, roi: t.roi_score }))

    missions[agent.slug] = {
      machine: agent.machine,
      role: agent.role,
      capacity_hours: agent.capacity,
      mission: agentTasks.length > 0
        ? `Execute ${agentTasks.length} tasks — focus on highest ROI`
        : 'Optimization mode — refactor, test, document',
      tasks: agentTasks,
    }
  }

  return missions
}

export async function runDailyPlanner(): Promise<void> {
  const db = getSupabase()
  log.info('Daily planner starting')

  const today = new Date().toISOString().split('T')[0]
  const sprint = await getActiveSprint()

  await detectDeadlineRisks()

  const { data: openTasks } = await db
    .from('oc_planning_tasks')
    .select('*')
    .in('status', ['backlog', 'planned', 'in_progress', 'blocked'])
    .order('priority', { ascending: false })
    .order('roi_score', { ascending: false })
    .limit(50)

  const tasks = (openTasks ?? []) as Record<string, unknown>[]

  const enrichedTasks: Record<string, unknown>[] = tasks.map(t => ({
    ...t,
    roi_score: t.roi_score ?? calcRoiScore({ priority: (t.priority as number) ?? 5 }),
  }))

  const buildSchedule = await buildBuildSchedule(enrichedTasks)
  const agentMissions = buildAgentMissions(enrichedTasks)

  const revenueTasks = enrichedTasks
    .filter(t => (t.tags as string[])?.includes('revenue') || (t.roi_score as number) > 60)
    .slice(0, 5)
    .map(t => ({ naam: t.naam, roi: t.roi_score, agent: (t.assigned_to as string) }))

  const criticalPath = enrichedTasks
    .filter(t => t.due_date && new Date(t.due_date as string) < new Date(Date.now() + 7 * 86400000))
    .slice(0, 5)
    .map(t => ({ naam: t.naam, due: t.due_date, priority: t.priority }))

  const deploySchedule = [
    { time: '06:00', action: 'git pull — all repos', machine: 'both' },
    { time: '10:00', action: 'Vercel deploy if changes', machine: 'mac_mini_1' },
    { time: '14:00', action: 'Render health check', machine: 'mac_mini_1' },
    { time: '20:00', action: 'End-of-day sync + commit', machine: 'both' },
  ]

  await saveDailyPlan({
    plan_date: today,
    status: 'active',
    agent_missions: agentMissions,
    build_schedule: buildSchedule,
    critical_path: criticalPath,
    revenue_tasks: revenueTasks,
    deployment_schedule: deploySchedule,
    completion_pct: 0,
    notes: `Sprint ${sprint?.sprint_number ?? '?'} — ${enrichedTasks.length} open tasks`,
  })

  if (DAILY_PLAN_LIST_ID) {
    try {
      await createTask(DAILY_PLAN_LIST_ID, {
        name: `📅 Daily Plan — ${today}`,
        description: [
          `Sprint: ${sprint?.naam ?? 'N/A'}`,
          `Open taken: ${enrichedTasks.length}`,
          `Agents actief: ${AGENTS.length}`,
          `Build windows: ${buildSchedule.length}`,
          `Revenue taken: ${revenueTasks.length}`,
          `Kritisch pad: ${criticalPath.length} items`,
        ].join('\n'),
        priority: 2,
      })
    } catch {
      log.warn('ClickUp daily plan task creation failed')
    }
  }

  const summary = [
    `Sprint ${sprint?.sprint_number ?? '?'} — ${today}`,
    `📋 ${enrichedTasks.length} open taken`,
    `🤖 ${AGENTS.length} agents beschikbaar`,
    `🔥 Top ROI: ${enrichedTasks[0]?.naam ?? 'N/A'}`,
    `🎯 Revenue taken: ${revenueTasks.length}`,
    `⚠️ Kritisch pad: ${criticalPath.length} items`,
  ].join('\n')

  await notifyDailyPlan(summary)
  log.info('Daily plan generated and dispatched', { tasks: enrichedTasks.length })
}
