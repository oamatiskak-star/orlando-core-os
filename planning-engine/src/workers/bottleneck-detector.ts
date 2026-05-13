import { workerLogger } from '../lib/logger'
import { getSupabase, logBottleneck } from '../lib/supabase'
import { sendTelegram } from '../lib/notifications'

const log = workerLogger('bottleneck-detector')

export async function runBottleneckDetector(): Promise<void> {
  const db = getSupabase()
  log.info('Bottleneck detector running')

  // 1 — Detect queue backed up
  const { count: queuedCount } = await db
    .from('oc_planning_tasks')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'planned')

  if ((queuedCount ?? 0) > 20) {
    await logBottleneck({
      bottleneck_type: 'queue_backed_up',
      severity: (queuedCount ?? 0) > 40 ? 'high' : 'medium',
      description: `${queuedCount} taken in queue — capaciteit mogelijk onvoldoende`,
    })
    log.warn('Queue backed up', { count: queuedCount })
  }

  // 2 — Detect dependency blockers
  const { data: blockedTasks } = await db
    .from('oc_planning_tasks')
    .select('id, naam, dependencies')
    .eq('status', 'blocked')

  for (const task of blockedTasks ?? []) {
    if (!task.dependencies || task.dependencies.length === 0) {
      await logBottleneck({
        bottleneck_type: 'dependency_blocked',
        severity: 'medium',
        affected_task_id: task.id,
        description: `"${task.naam}" staat op blocked maar heeft geen dependencies — fout in status`,
      })
    } else {
      const { data: depStatuses } = await db
        .from('oc_planning_tasks')
        .select('id, naam, status')
        .in('id', task.dependencies)

      const stillOpen = depStatuses?.filter(d => d.status !== 'done') ?? []
      if (stillOpen.length > 0) {
        log.debug('Task blocked by dependencies', {
          task: task.naam,
          blocking: stillOpen.map(d => d.naam),
        })
      }
    }
  }

  // 3 — Detect budget risk (tasks with no ROI score)
  const { count: noRoiCount } = await db
    .from('oc_planning_tasks')
    .select('*', { count: 'exact', head: true })
    .in('status', ['planned', 'in_progress'])
    .is('roi_score', null)

  if ((noRoiCount ?? 0) > 5) {
    await logBottleneck({
      bottleneck_type: 'budget_risk',
      severity: 'low',
      description: `${noRoiCount} taken zonder ROI score — prioritering suboptimaal`,
    })
  }

  // 4 — Resolve old bottlenecks automatically
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
  const { data: oldBottlenecks } = await db
    .from('oc_planning_bottlenecks')
    .select('id, bottleneck_type, affected_task_id')
    .is('resolved_at', null)
    .lt('detected_at', threeDaysAgo)

  for (const b of oldBottlenecks ?? []) {
    if (b.affected_task_id) {
      const { data: task } = await db
        .from('oc_planning_tasks')
        .select('status')
        .eq('id', b.affected_task_id)
        .single()

      if (task?.status === 'done') {
        await db.from('oc_planning_bottlenecks').update({
          resolved_at: new Date().toISOString(),
          resolution: 'Auto-resolved — taak is done',
          auto_resolved: true,
        }).eq('id', b.id)
        log.info('Auto-resolved bottleneck', { id: b.id, type: b.bottleneck_type })
      }
    }
  }

  // 5 — Critical bottleneck escalation
  const { data: criticalOpen } = await db
    .from('oc_planning_bottlenecks')
    .select('*')
    .eq('severity', 'critical')
    .is('resolved_at', null)
    .gte('detected_at', new Date(Date.now() - 60 * 60 * 1000).toISOString())

  if (criticalOpen && criticalOpen.length > 0) {
    await sendTelegram(
      `🚨 <b>CRITICAL Bottlenecks: ${criticalOpen.length}</b>\n\n` +
      criticalOpen.slice(0, 3).map(b => `• ${b.bottleneck_type}: ${b.description}`).join('\n')
    )
  }

  log.info('Bottleneck scan complete', { blocked: blockedTasks?.length ?? 0, queue: queuedCount ?? 0 })
}
