import { logger } from '../core/logger'
import { CONFIG } from '../core/config'
import { getSupabase, ErrorEvent, ErrorType, RecoveryStatus } from '../connectors/supabase'
import { detectAndEscalatePattern } from './pattern-detector'
import { executeRecoveryStrategy } from './recovery-executor'

const log = logger.child({ agent: 'recovery-orchestrator' })

export async function startRecoveryOrchestrator(subagentId: string) {
  const db = getSupabase()

  log.info('Setting up Realtime subscription to error_events')

  // Subscribe to new error events
  const channel = db
    .channel('hermes:error_events')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'hermes',
        table: 'error_events',
      },
      async (payload) => {
        const errorEvent = payload.new as unknown as ErrorEvent
        log.info({ errorCode: errorEvent.error_code, taskId: errorEvent.task_id }, 'New error event')

        try {
          // Get error type definition
          const { data: errorType, error: typeError } = await db
            .from('hermes.error_types')
            .select('*')
            .eq('error_code', errorEvent.error_code)
            .single()

          if (typeError) {
            log.warn(
              { errorCode: errorEvent.error_code, typeError },
              'Error type not found, treating as transient'
            )
          }

          const category = errorType?.category || 'transient'

          // Update or create recovery status
          const { data: existingStatus } = await db
            .from('hermes.recovery_status')
            .select('*')
            .eq('task_id', errorEvent.task_id)
            .single()

          let currentStatus: RecoveryStatus
          if (existingStatus) {
            const { data: updated } = await db
              .from('hermes.recovery_status')
              .update({
                error_count: (existingStatus.error_count || 0) + 1,
                last_error_at: new Date().toISOString(),
                status: 'detecting',
              })
              .eq('task_id', errorEvent.task_id)
              .select()
              .single()
            currentStatus = updated as RecoveryStatus
          } else {
            const { data: created } = await db
              .from('hermes.recovery_status')
              .insert({
                task_id: errorEvent.task_id,
                status: 'detecting',
                error_count: 1,
                recovery_count: 0,
                last_error_at: new Date().toISOString(),
                is_escalated: false,
              })
              .select()
              .single()
            currentStatus = created as RecoveryStatus
          }

          // Check for patterns
          const patternResult = await detectAndEscalatePattern(
            errorEvent.error_code,
            CONFIG.PATTERN_WINDOW_HOURS,
            CONFIG.PATTERN_THRESHOLD
          )

          if (patternResult.isSystemic) {
            log.warn(
              { errorCode: errorEvent.error_code, occurrences: patternResult.occurrences },
              'SYSTEMIC ISSUE DETECTED: pattern threshold exceeded'
            )

            // Escalate
            await db
              .from('hermes.recovery_status')
              .update({
                status: 'escalated',
                is_escalated: true,
              })
              .eq('task_id', errorEvent.task_id)

            // Send escalation alert
            const msg = `🔴 SYSTEMIC ISSUE: ${errorEvent.error_code}\n` +
              `Occurred ${patternResult.occurrences}x in ${CONFIG.PATTERN_WINDOW_HOURS}h\n` +
              `Task: ${errorEvent.task_id}\n` +
              `Recovery escalated to manual review`

            try {
              await sendTelegram(msg, 'critical')
            } catch (err) {
              log.warn({ err }, 'Failed to send escalation alert')
            }

            return
          }

          // Check if already escalated
          if (currentStatus.is_escalated) {
            log.info({ taskId: errorEvent.task_id }, 'Task already escalated, skipping recovery')
            return
          }

          // Check retry limit
          if ((currentStatus.recovery_count || 0) >= CONFIG.MAX_RETRY_ATTEMPTS) {
            log.warn(
              { taskId: errorEvent.task_id, attempts: currentStatus.recovery_count },
              'Max recovery attempts reached, escalating'
            )

            await db
              .from('hermes.recovery_status')
              .update({
                status: 'escalated',
                is_escalated: true,
              })
              .eq('task_id', errorEvent.task_id)

            const msg = `❌ RECOVERY EXHAUSTED: ${errorEvent.error_code}\n` +
              `Task: ${errorEvent.task_id}\n` +
              `Attempts: ${currentStatus.recovery_count}/${CONFIG.MAX_RETRY_ATTEMPTS}\n` +
              `Escalating to manual review`

            try {
              await sendTelegram(msg, 'error')
            } catch (err) {
              log.warn({ err }, 'Failed to send exhaustion alert')
            }

            return
          }

          // Determine recovery strategy based on category
          let strategyId: string | null = null

          if (category === 'permanent') {
            log.info({ errorCode: errorEvent.error_code }, 'Permanent error, escalating')
            await db
              .from('hermes.recovery_status')
              .update({ status: 'escalated', is_escalated: true })
              .eq('task_id', errorEvent.task_id)

            const msg = `⚠️ PERMANENT ERROR: ${errorEvent.error_code}\n` +
              `Task: ${errorEvent.task_id}\n` +
              `Manual review required`
            try {
              await sendTelegram(msg, 'warning')
            } catch (err) {
              log.warn({ err }, 'Failed to send permanent error alert')
            }
            return
          }

          if (category === 'systemic') {
            log.warn({ errorCode: errorEvent.error_code }, 'Systemic error detected')
            await db
              .from('hermes.recovery_status')
              .update({ status: 'escalated', is_escalated: true })
              .eq('task_id', errorEvent.task_id)

            const msg = `🔴 SYSTEMIC ERROR: ${errorEvent.error_code}\n` +
              `Task: ${errorEvent.task_id}\n` +
              `Immediate intervention required`
            try {
              await sendTelegram(msg, 'critical')
            } catch (err) {
              log.warn({ err }, 'Failed to send systemic error alert')
            }
            return
          }

          // For transient and resource errors, execute recovery
          if (category === 'transient' || category === 'resource') {
            log.info({ taskId: errorEvent.task_id, category }, 'Executing recovery strategy')

            await db
              .from('hermes.recovery_status')
              .update({ status: 'recovering' })
              .eq('task_id', errorEvent.task_id)

            const strategy = errorType?.default_strategy || 'retry_exponential'
            const success = await executeRecoveryStrategy(
              errorEvent,
              strategy,
              currentStatus.recovery_count || 0
            )

            if (success) {
              await db
                .from('hermes.recovery_status')
                .update({
                  status: 'resolved',
                  recovery_count: (currentStatus.recovery_count || 0) + 1,
                  last_recovery_at: new Date().toISOString(),
                })
                .eq('task_id', errorEvent.task_id)

              log.info({ taskId: errorEvent.task_id }, 'Recovery successful')
              const msg = `✅ RECOVERY SUCCESSFUL: ${errorEvent.error_code}\nTask: ${errorEvent.task_id}`
              try {
                await sendTelegram(msg, 'info')
              } catch (err) {
                log.warn({ err }, 'Failed to send success alert')
              }
            } else {
              await db
                .from('hermes.recovery_status')
                .update({
                  recovery_count: (currentStatus.recovery_count || 0) + 1,
                })
                .eq('task_id', errorEvent.task_id)

              log.warn({ taskId: errorEvent.task_id }, 'Recovery attempt failed')
            }
          }
        } catch (err) {
          log.error({ err }, 'Recovery orchestrator error')
        }
      }
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        log.info('Subscribed to error_events')
      }
    })

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    log.info('Shutting down recovery orchestrator')
    await db.removeChannel(channel)
  })
}

async function sendTelegram(message: string, severity: 'info' | 'warning' | 'error' | 'critical') {
  const SEVERITY_RANK: Record<string, number> = { info: 10, warning: 20, error: 30, critical: 40 }
  const minSeverity = (SEVERITY_RANK[CONFIG.TELEGRAM_MIN_SEVERITY] ?? 20) as number
  const msgSeverity = SEVERITY_RANK[severity] ?? 40

  if (msgSeverity < minSeverity) {
    log.info({ severity }, 'Telegram notification suppressed by severity filter')
    return
  }

  if (!CONFIG.TELEGRAM_BOT_TOKEN || !CONFIG.TELEGRAM_CHAT_ID) {
    log.warn('Telegram config missing')
    return
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${CONFIG.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: CONFIG.TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: 'HTML',
      }),
    })

    if (!response.ok) {
      log.warn({ status: response.status }, 'Telegram send failed')
    }
  } catch (err) {
    log.warn({ err }, 'Telegram notification error')
  }
}
