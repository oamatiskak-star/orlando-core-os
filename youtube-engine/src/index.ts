import 'dotenv/config'
import { logger } from './lib/logger'
import { getRedis } from './lib/redis-queue'
import { reportHeartbeat } from './lib/watchdog-heartbeat'
import { startUploadOrchestrator } from './workers/upload-orchestrator'
import { startFfmpegNormalizerWorker } from './workers/ffmpeg-normalizer-worker'
import { startYouTubeUploadWorker } from './workers/youtube-upload-worker'
import { startYouTubeVerificationWorker } from './workers/youtube-verification-worker'
import { startBrowserVerificationWorker } from './workers/browser-verification-worker'
import { startYouTubeRecoveryWorker } from './workers/youtube-recovery-worker'
import { startThumbnailWorker } from './workers/thumbnail-worker'
import { startAnalyticsFeedbackWorker } from './workers/analytics-feedback-worker'
import { startSlotFillerWorker } from './workers/slot-filler-worker'
import { startAutoPlanner } from './workers/auto-planner-worker'
import { startFileCleanupWorker } from './workers/file-cleanup-worker'

const startTime = Date.now()
let lastErrorTime: number | null = null

async function main() {
  logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  logger.info('  Orlando Core OS — YouTube Engine v1.0')
  logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  const redis = getRedis()
  await redis.connect()
  logger.info('Redis connected')

  const workers = [
    startFfmpegNormalizerWorker(),
    startYouTubeUploadWorker(),
    startYouTubeVerificationWorker(),
    startBrowserVerificationWorker(),
    startYouTubeRecoveryWorker(),
    startThumbnailWorker(),
    startAnalyticsFeedbackWorker(),
  ]

  startUploadOrchestrator()
  startAutoPlanner()
  startSlotFillerWorker()
  startFileCleanupWorker()

  logger.info(`${workers.length} workers running`)
  logger.info('Engine is live — watching for upload jobs')

  // Hermes health endpoint
  const http = (await import('http')).default
  const healthServer = http.createServer((req, res) => {
    if (req.url === '/hermes/health' && req.method === 'GET') {
      const uptime = Date.now() - startTime
      const healthScore = lastErrorTime ? Math.max(50, 100 - (Date.now() - lastErrorTime) / 60000) : 95

      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({
        service: 'youtube-engine',
        uptime_ms: uptime,
        workers_active: workers.length,
        queue_depth: 0, // Would need to query Redis
        health_score: Math.min(100, Math.max(0, healthScore)),
        last_error_at: lastErrorTime ? new Date(lastErrorTime).toISOString() : null,
      }))
    } else {
      res.writeHead(404)
      res.end()
    }
  })

  const healthPort = parseInt(process.env.HERMES_HEALTH_PORT || '3001', 10)
  healthServer.listen(healthPort, () => {
    logger.info('Health endpoint listening', { port: healthPort })
  })

  await reportHeartbeat('engine.youtube-engine.tick', { workers: workers.length, started: true })
  setInterval(() => {
    reportHeartbeat('engine.youtube-engine.tick', { workers: workers.length })
      .catch((e) => logger.error('heartbeat failed', { error: (e as Error).message }))
  }, 5 * 60_000)

  async function gracefulShutdown(signal: string) {
    logger.info(`Received ${signal} — graceful shutdown`)
    for (const worker of workers) {
      await worker.close()
    }
    await redis.quit()
    process.exit(0)
  }

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
  process.on('SIGINT', () => gracefulShutdown('SIGINT'))

  process.on('uncaughtException', (err) => {
    logger.error('Uncaught exception', { error: err.message, stack: err.stack })
  })

  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled rejection', { reason: String(reason) })
  })
}

main().catch((err) => {
  logger.error('Fatal startup error', { error: err.message })
  process.exit(1)
})
