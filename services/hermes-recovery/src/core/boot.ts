import { CONFIG, validateConfig } from './config'
import { logger } from './logger'
import { initSupabase, getSupabase } from '../connectors/supabase'
import { startRecoveryOrchestrator } from '../agents/recovery-orchestrator'
import { startMutualHealthMonitor } from '../agents/mutual-health-monitor'

export async function boot() {
  logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  logger.info('  Hermes Recovery Agent v1.0')
  logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  // Validate config
  const configErrors = validateConfig()
  if (configErrors.length > 0) {
    logger.error({ errors: configErrors }, 'Configuration validation failed')
    throw new Error(`Invalid config: ${configErrors.join(', ')}`)
  }

  // Initialize database
  await initSupabase()
  const db = getSupabase()

  // Register as subagent
  logger.info('Registering as subagent')
  const { data: existingAgent, error: selectError } = await db
    .from('hermes.subagents')
    .select('id')
    .eq('name', CONFIG.SERVICE_NAME)
    .single()

  let subagentId: string
  if (selectError && selectError.code !== 'PGRST116') {
    throw selectError
  }

  if (existingAgent) {
    subagentId = existingAgent.id
    logger.info({ subagentId }, 'Subagent already registered')
  } else {
    const { data: newAgent, error: insertError } = await db
      .from('hermes.subagents')
      .insert({
        name: CONFIG.SERVICE_NAME,
        kind: 'recovery',
        description: 'Automatic error detection, pattern analysis, and intelligent recovery',
        schedule: 'event-driven',
        enabled: true,
        config: {
          maxRetries: CONFIG.MAX_RETRY_ATTEMPTS,
          recoveryTimeoutMs: CONFIG.RECOVERY_TIMEOUT_MS,
          patternWindowHours: CONFIG.PATTERN_WINDOW_HOURS,
          patternThreshold: CONFIG.PATTERN_THRESHOLD,
        },
      })
      .select('id')
      .single()

    if (insertError) throw insertError
    subagentId = newAgent!.id
    logger.info({ subagentId }, 'Subagent registered')
  }

  // Initialize agent state
  const { data: existingState, error: stateSelectError } = await db
    .from('hermes.agent_state')
    .select('subagent_id')
    .eq('subagent_id', subagentId)
    .single()

  if (stateSelectError && stateSelectError.code !== 'PGRST116') {
    throw stateSelectError
  }

  if (!existingState) {
    const { error: stateInsertError } = await db.from('hermes.agent_state').insert({
      subagent_id: subagentId,
      status: 'starting',
    })
    if (stateInsertError) throw stateInsertError
  }

  // Start heartbeat
  setInterval(async () => {
    const { error } = await db
      .from('hermes.agent_state')
      .update({
        status: 'running',
        last_heartbeat_at: new Date().toISOString(),
      })
      .eq('subagent_id', subagentId)

    if (error) {
      logger.warn({ error }, 'Failed to update heartbeat')
    }
  }, CONFIG.HEARTBEAT_INTERVAL_MS)

  logger.info('Heartbeat started')

  // Start recovery orchestrator
  logger.info('Starting recovery orchestrator')
  await startRecoveryOrchestrator(subagentId)

  // Start mutual health monitor
  logger.info('Starting mutual health monitor')
  await startMutualHealthMonitor(subagentId)

  logger.info('Hermes Recovery Agent is live')
}
