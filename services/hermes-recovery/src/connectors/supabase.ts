import { createClient } from '@supabase/supabase-js'
import { CONFIG } from '../core/config'
import { logger } from '../core/logger'

let supabaseClient: ReturnType<typeof createClient> | null = null

export function getSupabase() {
  if (!supabaseClient) {
    supabaseClient = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_SERVICE_ROLE_KEY)
  }
  return supabaseClient
}

export async function initSupabase() {
  const db = getSupabase()

  // Test connection
  const { data, error } = await db.from('hermes.subagents').select('id').limit(1)
  if (error) {
    logger.error({ error }, 'Failed to connect to Supabase')
    throw error
  }

  logger.info('Supabase connected')
  return db
}

export interface ErrorEvent {
  id: string
  error_code: string
  task_id: string
  task_type: string
  message: string
  severity: 'info' | 'warning' | 'error' | 'critical'
  worker_id: string
  error_metadata: Record<string, unknown>
  stack_trace: string | null
  pattern_cluster_id: string | null
  created_at: string
}

export interface ErrorType {
  id: string
  error_code: string
  description: string
  category: 'transient' | 'permanent' | 'resource' | 'systemic'
  default_strategy: string
  max_retries: number
  retry_delay_ms: number
  backoff_multiplier: number
}

export interface RecoveryAttempt {
  id: string
  task_id: string
  error_id: string
  strategy_id: string
  status: 'pending' | 'in_progress' | 'success' | 'failed'
  triggered_at: string
  started_at: string | null
  completed_at: string | null
  result_message: string | null
  next_action: string | null
}

export interface RecoveryStatus {
  task_id: string
  status: 'detecting' | 'recovering' | 'escalated' | 'resolved' | 'failed'
  error_count: number
  recovery_count: number
  last_error_at: string | null
  last_recovery_at: string | null
  is_escalated: boolean
}
