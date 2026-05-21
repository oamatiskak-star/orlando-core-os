/**
 * ClickUp Mapper
 * Converts ClickUp tasks to internal organization_tasks format
 */

interface ClickUpTaskInput {
  id: string
  custom_id: string | null
  name: string
  description: string
  priority: { id: string; priority: string } | null
  due_date: string | null
  start_date: string | null
  status: { status: string }
  assigned: Array<{ id: string; username: string }>
  subtasks: Array<any>
  attachments: Array<any>
  custom_fields: Array<any>
}

interface InternalTaskInput {
  title: string
  description: string | null
  priority: 'critical' | 'high' | 'normal' | 'low' | 'backlog'
  system: string
  source: 'clickup'
  source_task_id: string
  status: 'new' | 'queued'
  dependencies: string[] | null
  metadata: Record<string, any>
}

const CLICKUP_PRIORITY_MAP: Record<string, 'critical' | 'high' | 'normal' | 'low' | 'backlog'> = {
  'urgent': 'critical',
  '1': 'critical',
  '2': 'high',
  '3': 'normal',
  '4': 'low',
  'none': 'normal',
}

const CLICKUP_STATUS_MAP: Record<string, 'new' | 'queued' | 'completed' | 'failed'> = {
  'open': 'new',
  'to do': 'new',
  'todo': 'new',
  'in progress': 'queued',
  'in_progress': 'queued',
  'inprogress': 'queued',
  'done': 'completed',
  'completed': 'completed',
  'cancelled': 'failed',
}

/**
 * Map ClickUp priority to internal priority
 */
export function mapClickUpPriority(
  clickupPriority: { id: string; priority: string } | null
): 'critical' | 'high' | 'normal' | 'low' | 'backlog' {
  if (!clickupPriority) return 'normal'

  const priorityStr = clickupPriority.priority.toLowerCase()
  return CLICKUP_PRIORITY_MAP[priorityStr] || 'normal'
}

/**
 * Map ClickUp status to internal status
 */
export function mapClickUpStatus(
  clickupStatus: { status: string }
): 'new' | 'queued' {
  if (!clickupStatus?.status) return 'new'

  const statusStr = clickupStatus.status.toLowerCase()
  const mapped = CLICKUP_STATUS_MAP[statusStr]
  return (mapped === 'completed' || mapped === 'failed') ? 'new' : (mapped || 'new')
}

/**
 * Convert single ClickUp task to internal format
 */
export function mapClickUpTask(
  clickupTask: ClickUpTaskInput,
  system: string = 'ClickUp'
): InternalTaskInput {
  return {
    title: clickupTask.name || 'Untitled Task',
    description: clickupTask.description || null,
    priority: mapClickUpPriority(clickupTask.priority),
    system,
    source: 'clickup',
    source_task_id: clickupTask.id,
    status: mapClickUpStatus(clickupTask.status),
    dependencies: clickupTask.subtasks?.length ? clickupTask.subtasks.map((s: any) => s.id) : null,
    metadata: {
      clickup_custom_id: clickupTask.custom_id,
      clickup_due_date: clickupTask.due_date,
      clickup_start_date: clickupTask.start_date,
      clickup_original_status: clickupTask.status?.status,
      clickup_original_priority: clickupTask.priority?.priority,
      clickup_assigned_users: clickupTask.assigned?.map(a => a.username) || [],
      clickup_attachments_count: clickupTask.attachments?.length || 0,
      clickup_custom_fields: clickupTask.custom_fields?.reduce((acc: Record<string, any>, field: any) => {
        if (field.name && field.value !== null) {
          acc[field.name] = field.value
        }
        return acc
      }, {}),
      migrated_from_clickup: true,
    },
  }
}

/**
 * Map multiple ClickUp tasks
 */
export function mapClickUpTasks(
  clickupTasks: ClickUpTaskInput[],
  system: string = 'ClickUp'
): InternalTaskInput[] {
  return clickupTasks.map(task => mapClickUpTask(task, system))
}
