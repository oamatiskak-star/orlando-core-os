/**
 * ClickUp Sync Service
 * Handles importing and syncing ClickUp tasks to internal organization_tasks
 */

import { SupabaseClient } from '@supabase/supabase-js'
import { ClickUpClient } from './client'
import { mapClickUpTask } from './mapper'

export interface SyncResult {
  success: boolean
  imported_count: number
  skipped_count: number
  error_count: number
  errors: Array<{ task_id: string; error: string }>
}

interface SyncProgress {
  current: number
  total: number
  status: string
}

/**
 * Fetch all ClickUp tasks and import into organization
 */
export async function syncClickUpTasks(
  supabase: SupabaseClient,
  clickupClient: ClickUpClient,
  onProgress?: (progress: SyncProgress) => void
): Promise<SyncResult> {
  const result: SyncResult = {
    success: false,
    imported_count: 0,
    skipped_count: 0,
    error_count: 0,
    errors: [],
  }

  try {
    // Get all spaces
    const spaces = await clickupClient.getSpaces()
    let totalTasks = 0
    const allTasks: Array<{ task: any; spaceId: string; spaceName: string }> = []

    // Collect all tasks from all spaces/folders/lists
    for (let i = 0; i < spaces.length; i++) {
      const space = spaces[i]
      onProgress?.({
        current: i,
        total: spaces.length,
        status: `Fetching tasks from space: ${space.name}`,
      })

      try {
        // Try to get space-level lists first
        const spaceLists = await clickupClient.getSpaceLists(space.id)

        for (const list of spaceLists) {
          const tasks = await clickupClient.getListTasks(list.id)
          for (const task of tasks) {
            allTasks.push({
              task,
              spaceId: space.id,
              spaceName: space.name,
            })
          }
        }

        // Also try folders
        try {
          const folders = await clickupClient.getFolders(space.id)

          for (const folder of folders) {
            const lists = await clickupClient.getLists(folder.id)

            for (const list of lists) {
              const tasks = await clickupClient.getListTasks(list.id)
              for (const task of tasks) {
                // Avoid duplicates
                const exists = allTasks.some(t => t.task.id === task.id)
                if (!exists) {
                  allTasks.push({
                    task,
                    spaceId: space.id,
                    spaceName: space.name,
                  })
                }
              }
            }
          }
        } catch (e) {
          // Some spaces might not have folders, that's okay
        }
      } catch (error) {
        console.error(`Error fetching tasks from space ${space.name}:`, error)
        result.errors.push({
          task_id: space.id,
          error: `Failed to fetch space: ${error}`,
        })
      }
    }

    // Import collected tasks
    totalTasks = allTasks.length
    for (let i = 0; i < allTasks.length; i++) {
      const { task, spaceId, spaceName } = allTasks[i]

      onProgress?.({
        current: i + 1,
        total: totalTasks,
        status: `Importing task: ${task.name}`,
      })

      try {
        // Check if task already imported
        const { data: existing } = await supabase
          .from('organization_clickup_imports')
          .select('id')
          .eq('clickup_task_id', task.id)
          .single()

        if (existing) {
          result.skipped_count++
          continue
        }

        // Map ClickUp task to internal format
        const internalTask = mapClickUpTask(task, spaceName)

        // Insert task
        const { data: insertedTask, error: insertError } = await supabase
          .from('organization_tasks')
          .insert({
            ...internalTask,
            system: spaceName,
          })
          .select('id')
          .single()

        if (insertError) throw insertError
        if (!insertedTask) throw new Error('Task insertion failed')

        // Track import
        const { error: trackError } = await supabase
          .from('organization_clickup_imports')
          .insert({
            clickup_workspace_id: spaceId,
            clickup_space_id: spaceId,
            clickup_task_id: task.id,
            internal_task_id: insertedTask.id,
            sync_status: 'synced',
          })

        if (trackError) throw trackError

        result.imported_count++
      } catch (error) {
        result.error_count++
        result.errors.push({
          task_id: task.id,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }

    result.success = result.error_count === 0
    return result
  } catch (error) {
    result.success = false
    result.errors.push({
      task_id: 'sync',
      error: error instanceof Error ? error.message : String(error),
    })
    return result
  }
}

/**
 * Incremental sync - only fetch recent changes
 */
export async function syncClickUpTasksIncremental(
  supabase: SupabaseClient,
  clickupClient: ClickUpClient,
  since?: Date
): Promise<SyncResult> {
  // For now, do full sync. ClickUp API doesn't have good incremental support
  // This is a placeholder for future optimization
  return syncClickUpTasks(supabase, clickupClient)
}
