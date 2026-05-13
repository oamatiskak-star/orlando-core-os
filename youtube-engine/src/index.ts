import 'dotenv/config'
import { logger } from './lib/logger'
import { getRedis } from './lib/redis-queue'
import { startUploadOrchestrator } from './workers/upload-orchestrator'
import { startFfmpegNormalizerWorker } from './workers/ffmpeg-normalizer-worker'
import { startYouTubeUploadWorker } from './workers/youtube-upload-worker'
import { startYouTubeVerificationWorker } from './workers/youtube-verification-worker'
import { startBrowserVerificationWorker } from './workers/browser-verification-worker'
import { startYouTubeRecoveryWorker } from './workers/youtube-recovery-worker'
import { startThumbnailWorker } from './workers/thumbnail-worker'
import { startAnalyticsFeedbackWorker } from './workers/analytics-feedback-worker'
import { startSlotFillerWorker } from './workers/slot-filler-worker'

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
  startSlotFillerWorker()

  logger.info(`${workers.length} workers running`)
  logger.info('Engine is live — watching for upload jobs')

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
