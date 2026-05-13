import { workerLogger } from '../lib/logger'
import { getSupabase, logBottleneck, recordWorkload } from '../lib/supabase'
import { notifyAgentIdle } from '../lib/notifications'
import { createTask, updateTask } from '../lib/clickup'
import os from 'os'

const log = workerLogger('agent-monitor')

const AI_WORKFORCE_LIST_ID = process.env.CLICKUP_AI_WORKFORCE_LIST_ID ?? ''

const AGENTS = [
  { slug: 'claude-sonnet',    machine: 'mac_mini_1', type: 'claude' },
  { slug: 'claude-haiku',     machine: 'mac_mini_2', type: 'claude' },
  { slug: 'lmstudio-mistral', machine: 'mac_mini_1', type: 'lmstudio' },
  { slug: 'lmstudio-qwen',    machine: 'mac_mini_2', type: 'lmstudio' },
  { slug: 'ollama-llama',     machine: 'mac_mini_2', type: 'ollama' },
]

function getCpuUsage(): number {
  const cpus = os.cpus()
  const total = cpus.reduce((acc, cpu) => {
    const times = cpu.times
    return acc + times.user + times.nice + times.sys + times.irq + times.idle
  }, 0)
  const idle = cpus.reduce((acc, cpu) => acc + cpu.times.idle, 0)
  return Math.round((1 - idle / total) * 100)
}

function getRamUsage(): number {
  const total = os.totalmem()
  const free = os.freemem()
  return Math.round(((total - free) / total) * 100)
}

async function detectIdleAgents(): Promise<void> {
  const db = getSupabase()
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()

  const { data: idleAssignments } = await db
    .from('oc_agent_assignments')
    .select('*, oc_planning_tasks(naam)')
    .eq('status', 'idle')
    .lt('assigned_at', fiveMinutesAgo)

  if (!idleAssignments || idleAssignments.length === 0) return

  for (const assignment of idleAssignments) {
    log.warn('Idle agent detected', { agent: assignment.agent_slug, machine: assignment.machine })

    const { data: nextTask } = await db
      .from('oc_planning_tasks')
      .select('*')
      .eq('status', 'planned')
      .is('assigned_to', null)
      .order('priority', { ascending: false })
      .order('roi_score', { ascending: false })
      .limit(1)
      .single()

    if (nextTask) {
      await db.from('oc_agent_assignments').insert({
        task_id: nextTask.id,
        agent_slug: assignment.agent_slug,
        agent_type: assignment.type ?? 'claude',
        machine: assignment.machine,
        status: 'assigned',
        assigned_at: new Date().toISOString(),
        context_snapshot: { auto_assigned: true, reason: 'idle_agent_detection' },
      })

      await db.from('oc_planning_tasks').update({
        assigned_to: assignment.agent_slug,
        status: 'in_progress',
        start_date: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('id', nextTask.id)

      await logBottleneck({
        bottleneck_type: 'agent_idle',
        severity: 'low',
        affected_task_id: nextTask.id,
        description: `${assignment.agent_slug} was idle — auto-assigned: "${nextTask.naam}"`,
      })

      await notifyAgentIdle(assignment.agent_slug, assignment.machine)
      log.info('Idle agent assigned new task', { agent: assignment.agent_slug, task: nextTask.naam })
    } else {
      await db.from('oc_agent_assignments').update({
        status: 'idle',
      }).eq('id', assignment.id)

      const optimizationTasks = [
        'Refactor en code cleanup',
        'Technische documentatie bijwerken',
        'Dependency updates controleren',
        'Performance profiling uitvoeren',
        'Test coverage verbeteren',
      ]
      const randomTask = optimizationTasks[Math.floor(Math.random() * optimizationTasks.length)]
      log.info(`No tasks available — agent self-optimizing: ${randomTask}`, { agent: assignment.agent_slug })
    }
  }
}

async function detectOverloadedAgents(): Promise<void> {
  const db = getSupabase()

  const { data: runningAssignments } = await db
    .from('oc_agent_assignments')
    .select('agent_slug, machine')
    .eq('status', 'running')

  if (!runningAssignments) return

  const agentLoad: Record<string, number> = {}
  for (const a of runningAssignments) {
    agentLoad[a.agent_slug] = (agentLoad[a.agent_slug] ?? 0) + 1
  }

  for (const [slug, load] of Object.entries(agentLoad)) {
    if (load > 3) {
      log.warn('Agent overloaded', { agent: slug, tasks: load })
      await logBottleneck({
        bottleneck_type: 'agent_overloaded',
        severity: load > 5 ? 'high' : 'medium',
        description: `${slug} heeft ${load} gelijktijdige taken — herbalancering nodig`,
      })
    }
  }
}

export async function runAgentMonitor(): Promise<void> {
  const machine = process.env.MACHINE_ID ?? 'mac_mini_1'
  const cpu = getCpuUsage()
  const ram = getRamUsage()

  log.info('Agent monitor pulse', { machine, cpu: `${cpu}%`, ram: `${ram}%` })

  for (const agent of AGENTS.filter(a => a.machine === machine)) {
    const db = getSupabase()
    const { count: activeTasks } = await db
      .from('oc_agent_assignments')
      .select('*', { count: 'exact', head: true })
      .eq('agent_slug', agent.slug)
      .in('status', ['assigned', 'running'])

    const { count: queueDepth } = await db
      .from('oc_planning_tasks')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'planned')
      .or(`agent_type.eq.${agent.type},agent_type.is.null`)

    const status = (activeTasks ?? 0) > 3 ? 'overloaded' :
                   (activeTasks ?? 0) > 0 ? 'active' :
                   cpu > 80 ? 'active' : 'idle'

    await recordWorkload({
      machine,
      agent_slug: agent.slug,
      cpu_pct: cpu,
      ram_pct: ram,
      active_tasks: activeTasks ?? 0,
      queue_depth: queueDepth ?? 0,
      status,
    })
  }

  await detectIdleAgents()
  await detectOverloadedAgents()
}
