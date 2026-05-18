// Herbruikbare Supabase queries voor /api/orchestrator/* en server components.
// Pure functies — geen state, geen mock data.

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  CreateTaskInput,
  OrchestratorEvent,
  OrchestratorTask,
  SystemStateRow,
  TaskError,
  TaskLog,
  TaskPriorityBand,
  TaskStatus,
  Worker,
  priorityFromInput,
} from './types'

const TASKS = 'orchestrator_tasks'
const LOGS = 'orchestrator_task_logs'
const ERRS = 'orchestrator_task_errors'
const WORK = 'orchestrator_workers'
const EVTS = 'orchestrator_events'

export type ListTasksFilter = {
  status?: TaskStatus | TaskStatus[]
  priority_band?: TaskPriorityBand
  company_id?: string
  limit?: number
  offset?: number
}

export async function listTasks(
  supabase: SupabaseClient,
  filter: ListTasksFilter = {},
): Promise<OrchestratorTask[]> {
  let q = supabase
    .from(TASKS)
    .select('*')
    .order('priority', { ascending: true })
    .order('run_at', { ascending: true })

  if (filter.status) {
    q = Array.isArray(filter.status)
      ? q.in('status', filter.status)
      : q.eq('status', filter.status)
  }
  if (filter.priority_band) q = q.eq('priority_band', filter.priority_band)
  if (filter.company_id)    q = q.eq('company_id',    filter.company_id)
  if (filter.limit)         q = q.limit(filter.limit)
  if (filter.offset)        q = q.range(filter.offset, (filter.offset ?? 0) + (filter.limit ?? 50) - 1)

  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as OrchestratorTask[]
}

export async function getTask(
  supabase: SupabaseClient,
  id: string,
): Promise<OrchestratorTask | null> {
  const { data, error } = await supabase
    .from(TASKS)
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data as OrchestratorTask | null
}

export async function getTaskLogs(
  supabase: SupabaseClient,
  taskId: string,
  limit = 200,
): Promise<TaskLog[]> {
  const { data, error } = await supabase
    .from(LOGS)
    .select('*')
    .eq('task_id', taskId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []) as TaskLog[]
}

export async function getTaskErrors(
  supabase: SupabaseClient,
  taskId: string,
  limit = 50,
): Promise<TaskError[]> {
  const { data, error } = await supabase
    .from(ERRS)
    .select('*')
    .eq('task_id', taskId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []) as TaskError[]
}

export async function recentErrors(
  supabase: SupabaseClient,
  limit = 10,
): Promise<TaskError[]> {
  const { data, error } = await supabase
    .from(ERRS)
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []) as TaskError[]
}

export async function createTask(
  supabase: SupabaseClient,
  input: CreateTaskInput,
  userId: string | null,
): Promise<OrchestratorTask> {
  if (!input.company_id) throw new Error('company_id is verplicht')
  if (!input.title?.trim()) throw new Error('title is verplicht')
  if (!Array.isArray(input.objective) || input.objective.length === 0) {
    throw new Error('objective is verplicht (minstens één regel)')
  }
  if (!Array.isArray(input.success_condition) || input.success_condition.length === 0) {
    throw new Error('success_condition is verplicht (minstens één regel)')
  }

  const priority = priorityFromInput(input.priority)

  const row = {
    company_id:            input.company_id,
    title:                 input.title,
    task_type:             input.task_type ?? null,
    project:               input.project ?? null,
    executor:              input.executor ?? 'anthropic',
    allowed_actions:       input.allowed_actions ?? [],
    priority,
    status:                'open' as TaskStatus,
    interruptible:         input.interruptible ?? true,
    requires_confirmation: input.requires_confirmation ?? false,
    safe_mode:             input.safe_mode ?? true,
    background_task:       input.background_task ?? false,
    system_critical:       input.system_critical ?? false,
    estimated_runtime:     input.estimated_runtime ?? 'medium',
    objective:             input.objective,
    success_condition:     input.success_condition,
    notes:                 input.notes ?? [],
    payload:               input.payload ?? {},
    parent_task_id:        input.parent_task_id ?? null,
    run_at:                input.run_at ?? new Date().toISOString(),
    max_attempts:          input.max_attempts ?? 3,
    created_by:            userId,
  }

  const { data, error } = await supabase
    .from(TASKS)
    .insert(row)
    .select('*')
    .single()
  if (error) throw error
  return data as OrchestratorTask
}

export async function updateTaskStatus(
  supabase: SupabaseClient,
  id: string,
  status: TaskStatus,
  patch: Partial<OrchestratorTask> = {},
): Promise<OrchestratorTask> {
  const { data, error } = await supabase
    .from(TASKS)
    .update({ status, ...patch })
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  return data as OrchestratorTask
}

export async function submitEscalationResponse(
  supabase: SupabaseClient,
  id: string,
  response: Record<string, unknown>,
): Promise<OrchestratorTask> {
  const { data, error } = await supabase
    .from(TASKS)
    .update({
      escalation_response: response,
      status: 'open',
      run_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('status', 'waiting')
    .select('*')
    .single()
  if (error) throw error
  return data as OrchestratorTask
}

export async function pauseTask(
  supabase: SupabaseClient,
  id: string,
  pausedState: Record<string, unknown>,
): Promise<OrchestratorTask> {
  const { data, error } = await supabase
    .from(TASKS)
    .update({ status: 'paused', paused_state: pausedState })
    .eq('id', id)
    .in('status', ['running', 'open'])
    .select('*')
    .single()
  if (error) throw error
  return data as OrchestratorTask
}

export async function listWorkers(supabase: SupabaseClient): Promise<Worker[]> {
  const { data, error } = await supabase
    .from(WORK)
    .select('*')
    .order('last_seen', { ascending: false })
  if (error) throw error
  return (data ?? []) as Worker[]
}

export async function systemState(
  supabase: SupabaseClient,
  companyId?: string,
): Promise<SystemStateRow[]> {
  const { data, error } = await supabase.rpc('orchestrator_system_state', {
    p_company_id: companyId ?? null,
  })
  if (error) throw error
  return (data ?? []) as SystemStateRow[]
}

export async function listUnresolvedEvents(
  supabase: SupabaseClient,
  limit = 10,
): Promise<OrchestratorEvent[]> {
  const { data, error } = await supabase
    .from(EVTS)
    .select('*')
    .eq('resolved', false)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []) as OrchestratorEvent[]
}

export async function listMemory(
  supabase: SupabaseClient,
  scope?: string,
) {
  let q = supabase.from('orchestrator_memory').select('*').order('updated_at', { ascending: false })
  if (scope) q = q.eq('scope', scope)
  const { data, error } = await q
  if (error) throw error
  return data ?? []
}

export async function upsertMemory(
  supabase: SupabaseClient,
  scope: string,
  key: string,
  value: unknown,
  updatedBy: string | null,
) {
  const { data, error } = await supabase
    .from('orchestrator_memory')
    .upsert(
      { scope, key, value, updated_by: updatedBy },
      { onConflict: 'scope,key' },
    )
    .select('*')
    .single()
  if (error) throw error
  return data
}
