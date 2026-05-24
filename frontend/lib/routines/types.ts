// Shared types voor Routines Control Center.
// Mirror van publieke routine_* tabellen (zie migratie 089).

export type RoutineKind = 'agent' | 'workflow' | 'cron' | 'reactive'
export type RoutineStatus = 'active' | 'paused' | 'disabled' | 'draft'

export type RunStatus =
  | 'queued'
  | 'running'
  | 'paused'
  | 'awaiting_approval'
  | 'failed'
  | 'recovered'
  | 'completed'
  | 'cancelled'

export type TriggerKind = 'cron' | 'event' | 'webhook' | 'manual' | 'retry'
export type StepType = 'action' | 'condition' | 'approval' | 'fallback' | 'delay'

export type AgentSource =
  | 'acq'
  | 'executive'
  | 'youtube'
  | 'mail'
  | 'watchdog'
  | 'claude'
  | 'local'
  | 'planning'

export type SystemHealthSource = 'acq' | 'executive' | 'watchdog' | 'orchestrator' | 'routines'

export type RoutineRow = {
  id: string
  company_id: string | null
  slug: string
  name: string
  description: string | null
  kind: RoutineKind
  status: RoutineStatus
  owner_user_id: string | null
  created_at: string
  updated_at: string
}

export type RoutineRunRow = {
  id: string
  routine_id: string
  parent_run_id: string | null
  status: RunStatus
  trigger_kind: TriggerKind
  trigger_payload: Record<string, unknown>
  service_id: string | null
  claimed_by: string | null
  claimed_at: string | null
  started_at: string
  heartbeat_at: string | null
  ended_at: string | null
  error: Record<string, unknown> | null
  cost_cents: number
}

export type SystemHealthRow = {
  source: SystemHealthSource
  id: string
  label: string
  kind: string | null
  status: string
  last_seen: string | null
  ok_count: number
  fail_count: number
  note: string | null
}

export type RoutineAuditLogRow = {
  id: number
  routine_id: string | null
  run_id: string | null
  action: string
  actor: 'ai' | 'user' | 'system'
  actor_id: string | null
  detail: Record<string, unknown>
  created_at: string
}
