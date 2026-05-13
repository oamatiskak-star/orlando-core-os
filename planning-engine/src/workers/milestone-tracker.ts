import { workerLogger } from '../lib/logger'
import { getSupabase, logBottleneck } from '../lib/supabase'
import { notifyMilestoneAchieved, notifyDeadlineRisk } from '../lib/notifications'
import { updateTask } from '../lib/clickup'

const log = workerLogger('milestone-tracker')

export async function runMilestoneTracker(): Promise<void> {
  const db = getSupabase()
  log.info('Milestone tracker running')

  const { data: milestones } = await db
    .from('oc_planning_milestones')
    .select('*')
    .not('status', 'in', '("achieved","missed")')
    .order('target_date', { ascending: true })

  if (!milestones) return

  const today = new Date()

  for (const milestone of milestones) {
    const targetDate = new Date(milestone.target_date)
    const daysLeft = Math.ceil((targetDate.getTime() - today.getTime()) / 86400000)

    const { data: tasks } = await db
      .from('oc_planning_tasks')
      .select('status')
      .eq('milestone_id', milestone.id)

    const totalTasks = tasks?.length ?? 0
    const doneTasks = tasks?.filter(t => t.status === 'done').length ?? 0
    const completionPct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0

    if (totalTasks > 0 && completionPct === 100) {
      await db.from('oc_planning_milestones').update({
        status: 'achieved',
        achieved_date: today.toISOString().split('T')[0],
        updated_at: new Date().toISOString(),
      }).eq('id', milestone.id)

      log.info('Milestone achieved!', { naam: milestone.naam })
      await notifyMilestoneAchieved(milestone.naam, milestone.revenue_impact ?? 0)

      if (milestone.clickup_task_id) {
        try {
          await updateTask(milestone.clickup_task_id, { status: 'complete' })
        } catch {
          log.warn('Failed to update ClickUp milestone task')
        }
      }
      continue
    }

    if (daysLeft < 0) {
      await db.from('oc_planning_milestones').update({
        status: 'missed',
        updated_at: new Date().toISOString(),
      }).eq('id', milestone.id)

      await logBottleneck({
        bottleneck_type: 'deadline_risk',
        severity: 'critical',
        description: `Milestone GEMIST: "${milestone.naam}" — ${Math.abs(daysLeft)} dagen te laat`,
      })
      log.error('Milestone missed!', { naam: milestone.naam, daysOverdue: Math.abs(daysLeft) })
      continue
    }

    if (daysLeft <= 7 && completionPct < 50) {
      await db.from('oc_planning_milestones').update({
        status: 'at_risk',
        updated_at: new Date().toISOString(),
      }).eq('id', milestone.id)

      await logBottleneck({
        bottleneck_type: 'deadline_risk',
        severity: daysLeft <= 3 ? 'critical' : 'high',
        description: `Milestone at risk: "${milestone.naam}" — ${daysLeft}d over, ${completionPct}% klaar`,
      })

      if (daysLeft <= 3) {
        await notifyDeadlineRisk(milestone.naam, daysLeft)
      }
    }

    log.debug('Milestone checked', {
      naam: milestone.naam,
      daysLeft,
      completionPct: `${completionPct}%`,
      status: milestone.status,
    })
  }

  const { data: activeSprint } = await db
    .from('oc_planning_sprints')
    .select('*')
    .eq('status', 'active')
    .single()

  if (activeSprint) {
    const sprintEnd = new Date(activeSprint.end_date)
    const sprintDaysLeft = Math.ceil((sprintEnd.getTime() - today.getTime()) / 86400000)

    const { data: sprintTasks } = await db
      .from('oc_planning_tasks')
      .select('status')
      .eq('sprint_id', activeSprint.id)

    const total = sprintTasks?.length ?? 0
    const done = sprintTasks?.filter(t => t.status === 'done').length ?? 0
    const pct = total > 0 ? Math.round((done / total) * 100) : 0

    await db.from('oc_planning_sprints').update({
      completion_pct: pct,
      velocity_actual: done,
      updated_at: new Date().toISOString(),
    }).eq('id', activeSprint.id)

    if (sprintEnd < today) {
      await db.from('oc_planning_sprints').update({
        status: 'completed',
        updated_at: new Date().toISOString(),
      }).eq('id', activeSprint.id)

      log.info('Sprint completed', { sprint: activeSprint.naam, completion: `${pct}%` })

      const { data: nextSprint } = await db
        .from('oc_planning_sprints')
        .select('*')
        .eq('status', 'planned')
        .order('sprint_number', { ascending: true })
        .limit(1)
        .single()

      if (nextSprint) {
        await db.from('oc_planning_sprints').update({
          status: 'active',
          updated_at: new Date().toISOString(),
        }).eq('id', nextSprint.id)
        log.info('Next sprint activated', { sprint: nextSprint.naam })
      }
    }
  }
}
