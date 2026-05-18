// Shared types voor /api/orchestrator/* en dashboard widgets.
// Spiegelt 1-op-1 de DB-kolommen uit migration 035_orchestrator.sql.

export type TaskExecutor = 'claude-code' | 'anthropic' | 'shell'

export type TaskStatus =
  | 'open'
  | 'running'
  | 'completed'
  | 'failed'
  | 'retry'
  | 'waiting'
  | 'paused'

export type TaskPriorityBand = 'hoog' | 'normaal' | 'laag'

export type TaskRuntime = 'fast' | 'medium' | 'long'

export type WorkerStatus = 'idle' | 'busy' | 'paused' | 'offline'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export type EventSeverity = 'info' | 'warn' | 'error' | 'critical'

export interface OrchestratorTask {
  id:                    string
  company_id:            string
  title:                 string
  task_type:             string | null
  project:               string | null

  executor:              TaskExecutor
  allowed_actions:       string[]

  priority:              number
  priority_band:         TaskPriorityBand
  status:                TaskStatus

  interruptible:         boolean
  requires_confirmation: boolean
  safe_mode:             boolean
  background_task:       boolean
  system_critical:       boolean
  estimated_runtime:     TaskRuntime

  objective:             string[]
  success_condition:     string[]
  notes:                 string[]
  payload:               Record<string, unknown>

  escalation_question:   string | null
  escalation_response:   Record<string, unknown> | null
  parent_task_id:        string | null
  paused_state:          Record<string, unknown> | null

  worker_id:             string | null
  attempts:              number
  max_attempts:          number
  run_at:                string
  started_at:            string | null
  finished_at:           string | null
  error:                 string | null

  created_at:            string
  updated_at:            string
  created_by:            string | null
}

export interface TaskLog {
  id:         string
  task_id:    string
  level:      LogLevel
  message:    string
  payload:    Record<string, unknown>
  created_at: string
}

export interface TaskError {
  id:                 string
  task_id:            string
  error_class:        string | null
  message:            string
  stack_trace:        string | null
  recovery_attempted: boolean
  recovered:          boolean
  created_at:         string
}

export interface Worker {
  worker_id:       string
  hostname:        string | null
  last_seen:       string
  status:          WorkerStatus
  current_task_id: string | null
  cpu_pct:         number | null
  ram_mb:          number | null
  meta:            Record<string, unknown>
}

export interface OrchestratorEvent {
  id:         string
  type:       string
  severity:   EventSeverity
  task_id:    string | null
  worker_id:  string | null
  payload:    Record<string, unknown>
  resolved:   boolean
  created_at: string
}

export interface MemoryEntry {
  scope:      string
  key:        string
  value:      unknown
  updated_at: string
  updated_by: string | null
}

// Request payload voor POST /api/orchestrator/tasks — mirror van user-spec JSON
export interface CreateTaskInput {
  company_id:             string
  title:                  string
  priority:               TaskPriorityBand | number
  project?:               string
  task_type?:             string
  executor?:              TaskExecutor
  allowed_actions?:       string[]
  interruptible?:         boolean
  requires_confirmation?: boolean
  safe_mode?:             boolean
  background_task?:       boolean
  system_critical?:       boolean
  estimated_runtime?:     TaskRuntime
  objective:              string[]
  success_condition:      string[]
  notes?:                 string[]
  payload?:               Record<string, unknown>
  parent_task_id?:        string
  run_at?:                string
  max_attempts?:          number
}

export interface SystemStateRow {
  band:   TaskPriorityBand
  status: TaskStatus
  count:  number
}

export const PRIORITY_BAND_BY_NAME: Record<TaskPriorityBand, number> = {
  hoog:    2,
  normaal: 5,
  laag:    8,
}

export function bandFromPriority(p: number): TaskPriorityBand {
  if (p <= 3) return 'hoog'
  if (p <= 6) return 'normaal'
  return 'laag'
}

export function priorityFromInput(p: TaskPriorityBand | number): number {
  if (typeof p === 'number') {
    if (!Number.isInteger(p) || p < 1 || p > 10) {
      throw new Error(`priority moet integer tussen 1 en 10 zijn (kreeg ${p})`)
    }
    return p
  }
  const n = PRIORITY_BAND_BY_NAME[p]
  if (n === undefined) throw new Error(`onbekende priority band: ${p}`)
  return n
}
