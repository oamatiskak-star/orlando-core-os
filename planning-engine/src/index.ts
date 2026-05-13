import 'dotenv/config'
import cron from 'node-cron'
import { logger } from './lib/logger'
import { runDailyPlanner } from './workers/daily-planner'
import { runAgentMonitor } from './workers/agent-monitor'
import { runSyncCoordinator } from './workers/sync-coordinator'
import { runMilestoneTracker } from './workers/milestone-tracker'
import { runBottleneckDetector } from './workers/bottleneck-detector'
import { runClickUpSync } from './workers/clickup-sync'

async function safe(name: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn()
  } catch (err) {
    logger.error(`Worker error: ${name}`, { error: (err as Error).message })
  }
}

async function main() {
  logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  logger.info('  Orlando Core OS — Master Planning Engine v1.0')
  logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  logger.info(`  Machine: ${process.env.MACHINE_ID ?? 'mac_mini_1'}`)
  logger.info(`  ClickUp: ${process.env.CLICKUP_API_TOKEN ? 'Connected' : 'No token'}`)
  logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  // Startup run
  await safe('daily-planner', runDailyPlanner)
  await safe('sync-coordinator', runSyncCoordinator)
  await safe('milestone-tracker', runMilestoneTracker)
  await safe('bottleneck-detector', runBottleneckDetector)

  // Daily plan at 06:00
  cron.schedule('0 6 * * *', () => safe('daily-planner', runDailyPlanner))

  // Agent monitor every 5 minutes
  cron.schedule('*/5 * * * *', () => safe('agent-monitor', runAgentMonitor))

  // Git sync every 15 minutes
  cron.schedule('*/15 * * * *', () => safe('sync-coordinator', runSyncCoordinator))

  // Milestone tracker every hour
  cron.schedule('0 * * * *', () => safe('milestone-tracker', runMilestoneTracker))

  // Bottleneck detector every 10 minutes
  cron.schedule('*/10 * * * *', () => safe('bottleneck-detector', runBottleneckDetector))

  // ClickUp sync every 30 minutes
  cron.schedule('*/30 * * * *', () => safe('clickup-sync', runClickUpSync))

  // End-of-day summary at 20:00
  cron.schedule('0 20 * * *', async () => {
    await safe('eod-milestone', runMilestoneTracker)
    await safe('eod-bottleneck', runBottleneckDetector)
    await safe('eod-clickup', runClickUpSync)
  })

  logger.info('All crons registered — engine running autonomously')

  process.on('SIGTERM', () => { logger.info('Shutdown received'); process.exit(0) })
  process.on('SIGINT',  () => { logger.info('Shutdown received'); process.exit(0) })
  process.on('uncaughtException', (err) => logger.error('Uncaught', { error: err.message }))
  process.on('unhandledRejection', (r) => logger.error('Unhandled', { reason: String(r) }))
}

main().catch(err => {
  logger.error('Fatal startup error', { error: err.message })
  process.exit(1)
})
