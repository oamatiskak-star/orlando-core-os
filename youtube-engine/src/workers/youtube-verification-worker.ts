import { Worker, Job } from 'bullmq'
import { getRedis, QUEUE_NAMES, VerifyJobData, enqueueVerification, enqueueBrowserVerify, enqueueRecovery } from '../lib/redis-queue'
import { getSupabase, updateQueueStatus, addLog, recordFailure, recordProcessingEvent } from '../lib/supabase'
import { buildOAuthClient, getVideoStatus } from '../lib/youtube-api'
import { notifyCopyrightClaim } from '../lib/notifications'
import { workerLogger } from '../lib/logger'

const log = workerLogger('verification-worker')

const MAX_VERIFY_ATTEMPTS = 40
const VERIFY_INTERVAL_MS = parseInt(process.env.VERIFICATION_INTERVAL_MS ?? '30000')

export function startYouTubeVerificationWorker(): Worker {
  const worker = new Worker<VerifyJobData>(
    QUEUE_NAMES.VERIFY,
    async (job: Job<VerifyJobData>) => {
      const { queueId, videoId, channelId, youtubeVideoId, attemptCount = 0 } = job.data
      const db = getSupabase()

      log.info('Verification check', { queueId, youtubeVideoId, attempt: attemptCount })

      const { data: channel } = await db.from('youtube_channels')
        .select('*').eq('id', channelId).single()

      if (!channel) throw new Error(`Channel ${channelId} not found`)
      if (!channel.refresh_token) throw new Error(`Channel ${channel.naam} has no OAuth tokens`)

      const auth = buildOAuthClient(channel)
      const status = await getVideoStatus(auth, youtubeVideoId)

      await addLog(queueId, videoId, 'info', 'YouTube API status check', {
        uploadStatus: status.uploadStatus,
        processingStatus: status.processingStatus,
        privacyStatus: status.privacyStatus,
        embeddable: status.embeddable,
        thumbnailExists: status.thumbnailExists,
        attempt: attemptCount,
      })

      await recordProcessingEvent(queueId, youtubeVideoId, 'api_check', {
        ...status,
        attemptCount,
      })

      if (status.uploadStatus === 'rejected' || status.copyrightStatus === 'blocked') {
        const failureId = await recordFailure(queueId, videoId, 'copyright_detected', 'Video blocked by YouTube', 'blocked')
        await updateQueueStatus(queueId, 'failed', { last_error: 'Video rejected/blocked by YouTube' })
        await addLog(queueId, videoId, 'error', 'Video blocked by YouTube — copyright or policy violation')

        const { data: vid } = await db.from('youtube_videos').select('title').eq('id', videoId).single()
        const { data: ch } = await db.from('youtube_channels').select('naam').eq('id', channelId).single()
        await notifyCopyrightClaim(vid?.title ?? videoId, ch?.naam ?? channelId, 'blocked')
        return { blocked: true }
      }

      if (status.uploadStatus === 'failed' || status.processingStatus === 'failed') {
        const failureId = await recordFailure(queueId, videoId, 'processing_failed', `YouTube processing failed: ${JSON.stringify(status)}`)
        await updateQueueStatus(queueId, 'retrying', { last_error: 'YouTube processing failed' })
        await addLog(queueId, videoId, 'error', 'YouTube processing failed — queuing recovery')
        await enqueueRecovery({ queueId, videoId, channelId, failureType: 'processing_failed', failureId }, 5_000)
        return { processing_failed: true }
      }

      if (status.uploadStatus === 'processed' || status.processingStatus === 'succeeded') {
        log.info('Video processed by YouTube — checking thumbnail and metadata', { queueId })

        await updateQueueStatus(queueId, 'verifying', {
          verification_started_at: new Date().toISOString(),
        })
        await addLog(queueId, videoId, 'info', 'Processing complete — starting deep verification')

        if (!status.thumbnailExists) {
          const { data: video } = await db.from('youtube_videos').select('thumbnail_path').eq('id', videoId).single()
          if (video?.thumbnail_path) {
            const failureId = await recordFailure(queueId, videoId, 'thumbnail_missing', 'Thumbnail not visible on YouTube after processing')
            await enqueueRecovery({ queueId, videoId, channelId, failureType: 'thumbnail_missing', failureId }, 2_000)
            await addLog(queueId, videoId, 'warn', 'Thumbnail missing — queuing recovery')
          }
        }

        const scheduledOk = !status.publishAt || new Date(status.publishAt) > new Date()
        const isPublicOrScheduled = status.privacyStatus === 'public' || status.privacyStatus === 'private'

        if (!isPublicOrScheduled || !status.embeddable) {
          log.warn('Status check failed', { privacyStatus: status.privacyStatus, embeddable: status.embeddable })
        }

        await enqueueBrowserVerify({
          queueId,
          videoId,
          channelId,
          youtubeVideoId,
          youtubeUrl: `https://www.youtube.com/watch?v=${youtubeVideoId}`,
        })

        return { processing_complete: true, scheduled_ok: scheduledOk }
      }

      if (status.uploadStatus === 'uploaded' || status.processingStatus === 'processing') {
        await updateQueueStatus(queueId, 'processing')
        await addLog(queueId, videoId, 'info', `Still processing — attempt ${attemptCount + 1}/${MAX_VERIFY_ATTEMPTS}`)

        if (attemptCount >= MAX_VERIFY_ATTEMPTS) {
          const failureId = await recordFailure(queueId, videoId, 'upload_stuck', 'Video stuck in processing after maximum verification attempts')
          await updateQueueStatus(queueId, 'manual_review_required', {
            last_error: 'Verification timeout — video stuck in processing',
          })
          await addLog(queueId, videoId, 'error', 'Verification timeout — manual review required')
          await enqueueRecovery({ queueId, videoId, channelId, failureType: 'upload_stuck', failureId }, 0)
          return { timeout: true }
        }

        await enqueueVerification({
          queueId, videoId, channelId, youtubeVideoId,
          attemptCount: attemptCount + 1,
        }, VERIFY_INTERVAL_MS)

        return { still_processing: true, attempt: attemptCount + 1 }
      }

      await addLog(queueId, videoId, 'warn', `Unknown status combination`, { uploadStatus: status.uploadStatus, processingStatus: status.processingStatus })
      await enqueueVerification({ queueId, videoId, channelId, youtubeVideoId, attemptCount: attemptCount + 1 }, VERIFY_INTERVAL_MS)
      return { unknown_status: true }
    },
    {
      connection: getRedis(),
      concurrency: 5,
    }
  )

  worker.on('failed', async (job, err) => {
    if (!job) return
    const { queueId, videoId } = job.data
    log.error('Verification job failed', { queueId, error: err.message })
    await addLog(queueId, videoId, 'error', `Verification worker error: ${err.message}`)
  })

  log.info('YouTube verification worker started')
  return worker
}
