import { workerLogger } from '../lib/logger'
import { getSupabase } from '../lib/supabase'
import { getTasks, updateTask, createComment } from '../lib/clickup'

const log = workerLogger('clickup-sync')

const LIST_IDS = {
  SPRINT:       process.env.CLICKUP_SPRINT_LIST_ID       ?? '901217923675',
  MILESTONES:   process.env.CLICKUP_MILESTONES_LIST_ID   ?? '901217923626',
  AI_WORKFORCE: process.env.CLICKUP_AI_WORKFORCE_LIST_ID ?? '901217923675',
}

const STATUS_MAP: Record<string, string> = {
  backlog:     'Open',
  planned:     'Open',
  in_progress: 'In Progress',
  blocked:     'Blocked',
  review:      'In Review',
  done:        'Complete',
  cancelled:   'Cancelled',
}

const CLICKUP_TO_LOCAL: Record<string, string> = {
  'open':        'planned',
  'in progress': 'in_progress',
  'complete':    'done',
  'blocked':     'blocked',
}

export async function syncClickUpToSupabase(): Promise<void> {
  const db = getSupabase()
  log.info('Syncing ClickUp → Supabase')

  for (const [listName, listId] of Object.entries(LIST_IDS)) {
    try {
      const tasks = await getTasks(listId)

      for (const task of tasks) {
        const localStatus = CLICKUP_TO_LOCAL[task.status.status.toLowerCase()] ?? 'planned'

        const { data: existing } = await db
          .from('oc_planning_tasks')
          .select('id, status')
          .eq('clickup_task_id', task.id)
          .single()

        if (existing && existing.status !== localStatus) {
          await db.from('oc_planning_tasks').update({
            status: localStatus,
            updated_at: new Date().toISOString(),
          }).eq('clickup_task_id', task.id)

          log.info('Status synced from ClickUp', {
            task: task.name,
            from: existing.status,
            to: localStatus,
          })
        }
      }
    } catch (err) {
      log.warn(`Failed to sync list ${listName}`, { error: (err as Error).message })
    }
  }
}

export async function syncSupabaseToClickUp(): Promise<void> {
  const db = getSupabase()
  log.info('Syncing Supabase → ClickUp')

  const { data: recentlyCompleted } = await db
    .from('oc_planning_tasks')
    .select('*')
    .eq('status', 'done')
    .not('clickup_task_id', 'is', null)
    .gte('completed_at', new Date(Date.now() - 60 * 60 * 1000).toISOString())

  for (const task of recentlyCompleted ?? []) {
    if (!task.clickup_task_id) continue
    try {
      await updateTask(task.clickup_task_id, { status: 'complete' })
      await createComment(
        task.clickup_task_id,
        `✅ Voltooid door AI Engine\n` +
        `Duur: ${task.actual_hours ?? '?'}u\n` +
        `Agent: ${task.assigned_to ?? 'unknown'}\n` +
        `Machine: ${task.machine ?? 'unknown'}`
      )
      log.info('Task completed synced to ClickUp', { task: task.naam })
    } catch (err) {
      log.warn('Failed to sync completion to ClickUp', { error: (err as Error).message })
    }
  }
}

export async function runClickUpSync(): Promise<void> {
  await syncClickUpToSupabase()
  await syncSupabaseToClickUp()
}
