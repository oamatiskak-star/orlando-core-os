import { getSupabase } from './supabase'
import { logger } from './logger'

export interface ErrorEmissionContext {
  errorCode: string
  taskId: string
  taskType: string
  message: string
  severity?: 'info' | 'warning' | 'error' | 'critical'
  workerId?: string
  metadata?: Record<string, unknown>
  stackTrace?: string
}

export async function emitErrorEvent(context: ErrorEmissionContext): Promise<void> {
  try {
    const db = getSupabase()
    await db.from('hermes.error_events').insert({
      error_code: context.errorCode,
      task_id: context.taskId,
      task_type: context.taskType,
      message: context.message,
      severity: context.severity || 'error',
      worker_id: context.workerId || 'youtube-engine',
      error_metadata: context.metadata || {},
      stack_trace: context.stackTrace || null,
    })
  } catch (err) {
    logger.warn('Failed to emit error event to Hermes', { err })
  }
}
