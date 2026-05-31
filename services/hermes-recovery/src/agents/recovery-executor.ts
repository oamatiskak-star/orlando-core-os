import { getSupabase, ErrorEvent } from '../connectors/supabase'
import { logger } from '../core/logger'
import { CONFIG } from '../core/config'

const log = logger.child({ agent: 'recovery-executor' })

export async function executeRecoveryStrategy(
  errorEvent: ErrorEvent,
  strategy: string,
  attemptNumber: number
): Promise<boolean> {
  const db = getSupabase()

  try {
    // Create recovery attempt record
    const { data: attempt, error: insertError } = await db
      .from('hermes.recovery_attempts')
      .insert({
        task_id: errorEvent.task_id,
        error_id: errorEvent.id,
        status: 'in_progress',
        triggered_at: new Date().toISOString(),
        started_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (insertError) {
      log.error({ insertError }, 'Failed to create recovery attempt')
      throw insertError
    }

    const attemptId = attempt!.id

    // Execute strategy based on type
    let success = false
    let resultMessage = ''

    switch (strategy) {
      case 'retry_exponential': {
        // Exponential backoff retry
        const delayMs = Math.min(
          (CONFIG.RECOVERY_TIMEOUT_MS / CONFIG.MAX_RETRY_ATTEMPTS) * Math.pow(2, attemptNumber),
          CONFIG.RECOVERY_TIMEOUT_MS
        )
        log.info({ taskId: errorEvent.task_id, delayMs, attemptNumber }, 'Scheduling exponential retry')
        resultMessage = `Scheduled retry attempt ${attemptNumber + 1} after ${delayMs}ms delay`
        success = true
        break
      }

      case 'wait_quota_reset': {
        // For quota errors, wait until reset (typically 07:00 UTC)
        const now = new Date()
        const tomorrow = new Date(now)
        tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
        tomorrow.setUTCHours(7, 0, 0, 0)

        const waitMs = tomorrow.getTime() - now.getTime()
        log.info({ taskId: errorEvent.task_id, waitMs }, 'Scheduling quota reset retry')
        resultMessage = `Waiting for quota reset (${waitMs}ms), will retry at 07:00 UTC`
        success = true
        break
      }

      case 'retry_with_backoff': {
        const delayMs = 30_000 * (attemptNumber + 1) // 30s, 60s, 90s
        log.info({ taskId: errorEvent.task_id, delayMs }, 'Scheduling backoff retry')
        resultMessage = `Scheduled retry with ${delayMs}ms backoff`
        success = true
        break
      }

      case 'escalate_manual': {
        log.warn({ taskId: errorEvent.task_id }, 'Escalating to manual review')
        resultMessage = 'Escalated to manual review due to permanent error'
        // Don't set success=true; this counts as a failed recovery attempt
        break
      }

      default: {
        log.warn({ strategy }, 'Unknown recovery strategy')
        resultMessage = `Unknown strategy: ${strategy}`
      }
    }

    // Update recovery attempt
    const { error: updateError } = await db
      .from('hermes.recovery_attempts')
      .update({
        status: success ? 'success' : 'failed',
        completed_at: new Date().toISOString(),
        result_message: resultMessage,
        next_action: success ? 'pending' : 'requires_manual_review',
      })
      .eq('id', attemptId)

    if (updateError) {
      log.error({ updateError }, 'Failed to update recovery attempt')
    }

    return success
  } catch (err) {
    log.error({ err }, 'Recovery execution error')
    return false
  }
}
