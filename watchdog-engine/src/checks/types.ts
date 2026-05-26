export type CheckType =
  | 'http_ping'
  | 'heartbeat'
  | 'queue_depth'
  | 'data_freshness'
  | 'cron_lateness'

export type CheckSeverity = 'warning' | 'error' | 'critical'

export interface CheckRow {
  id: string
  slug: string
  display_name: string
  check_type: CheckType
  layer: string
  category: string | null
  config: Record<string, unknown>
  threshold: Record<string, unknown>
  interval_seconds: number
  consecutive_failures_to_escalate: number
  enabled: boolean
  severity: CheckSeverity
  notes: string | null
}

export interface CheckResult {
  ok: boolean
  latency_ms?: number
  value?: number
  message?: string
  metadata?: Record<string, unknown>
}

export type CheckRunner = (check: CheckRow, supabaseUrl: string, supabaseKey: string) => Promise<CheckResult>
