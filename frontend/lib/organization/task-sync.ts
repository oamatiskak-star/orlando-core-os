/**
 * Task Sync Service
 * Syncs existing orchestrator_tasks and ai_tasks to organization_tasks
 */

import { SupabaseClient } from '@supabase/supabase-js'

/**
 * Sync orchestrator_tasks to organization_tasks
 * Maps existing orchestrator tasks to the new unified view
 */
export async function syncOrchestratorTasks(
  supabase: SupabaseClient
): Promise<{ synced: number; errors: number }> {
  let synced = 0
  let errors = 0

  try {
    const { data: orchestratorTasks } = await supabase
      .from('orchestrator_tasks')
      .select('*')

    if (!orchestratorTasks) return { synced, errors }

    for (const task of orchestratorTasks) {
      try {
        // Check if already synced
        const { data: existing } = await supabase
          .from('organization_tasks')
          .select('id')
          .eq('executor_task_id', task.id)
          .single()

        if (existing) continue

        // Map status
        const statusMap: Record<string, string> = {
          open: 'new',
          running: 'running',
          completed: 'completed',
          failed: 'failed',
          retry: 'queued',
          waiting: 'waiting_for_input',
          paused: 'blocked',
        }

        // Map priority
        const priorityMap: Record<number, string> = {
          1: 'critical',
          2: 'critical',
          3: 'high',
          4: 'high',
          5: 'normal',
          6: 'normal',
          7: 'low',
          8: 'low',
          9: 'backlog',
          10: 'backlog',
        }

        // Insert into organization_tasks
        const { error } = await supabase
          .from('organization_tasks')
          .insert({
            title: task.title || 'Untitled Task',
            description: task.notes?.[0] || null,
            priority: priorityMap[task.priority] || 'normal',
            system: 'Orchestrator',
            source: 'supabase',
            source_task_id: task.id,
            status: statusMap[task.status] || 'new',
            executor_task_id: task.id,
            created_at: task.created_at,
            started_at: task.started_at,
            finished_at: task.finished_at,
            error: task.error,
          })

        if (error) throw error
        synced++
      } catch (err) {
        console.error('Error syncing orchestrator task:', err)
        errors++
      }
    }
  } catch (err) {
    console.error('Error in syncOrchestratorTasks:', err)
  }

  return { synced, errors }
}

/**
 * Sync ai_tasks to organization_tasks
 * Maps existing AI-OS tasks to the new unified view
 */
export async function syncAITasks(
  supabase: SupabaseClient
): Promise<{ synced: number; errors: number }> {
  let synced = 0
  let errors = 0

  try {
    const { data: aiTasks } = await supabase
      .from('ai_tasks')
      .select('*')

    if (!aiTasks) return { synced, errors }

    for (const task of aiTasks) {
      try {
        // Check if already synced
        const { data: existing } = await supabase
          .from('organization_tasks')
          .select('id')
          .eq('ai_task_id', task.id)
          .single()

        if (existing) continue

        // Map status
        const statusMap: Record<string, string> = {
          queued: 'queued',
          claimed: 'assigned',
          completed: 'completed',
          failed: 'failed',
        }

        // Insert into organization_tasks
        const { error } = await supabase
          .from('organization_tasks')
          .insert({
            title: task.kind || 'AI Task',
            description: null,
            priority: 'normal',
            system: 'AI-OS',
            source: 'supabase',
            source_task_id: task.id,
            status: statusMap[task.status] || 'new',
            ai_task_id: task.id,
            created_at: task.created_at,
            started_at: task.claimed_at,
            finished_at: task.completed_at,
            error: task.error,
          })

        if (error) throw error
        synced++
      } catch (err) {
        console.error('Error syncing AI task:', err)
        errors++
      }
    }
  } catch (err) {
    console.error('Error in syncAITasks:', err)
  }

  return { synced, errors }
}
