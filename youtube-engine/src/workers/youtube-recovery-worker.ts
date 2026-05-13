import { Worker, Job } from 'bullmq'
import { getRedis, QUEUE_NAMES, RecoverJobData, enqueueUpload, enqueueNormalize, enqueueThumbnail } from '../lib/redis-queue'
import { getSupabase, updateQueueStatus, addLog } from '../lib/supabase'
import { buildOAuthClient, setVideoPublic } from '../lib/youtube-api'
import { notifyUploadFailure } from '../lib/notifications'
import { workerLogger } from '../lib/logger'
import path from 'path'

const log = workerLogger('recovery-worker')

async function logRecoveryAction(
  failureId: string,
  queueId: string,
  actionType: string,
  success: boolean,
  notes?: string
): Promise<void> {
  const db = getSupabase()
  await db.from('youtube_recovery_actions').insert({
    failure_id: failureId,
    queue_id: queueId,
    action_type: actionType,
    triggered_at: new Date().toISOString(),
    completed_at: new Date().toISOString(),
    success,
    notes,
  })
}

export function startYouTubeRecoveryWorker(): Worker {
  const worker = new Worker<RecoverJobData>(
    QUEUE_NAMES.RECOVER,
    async (job: Job<RecoverJobData>) => {
      const { queueId, videoId, channelId, failureType, failureId } = job.data
      const db = getSupabase()

      log.info('Recovery action started', { queueId, failureType })
      await addLog(queueId, videoId, 'info', `Recovery started for: ${failureType}`)

      const { data: queueEntry } = await db.from('youtube_upload_queue')
        .select('*, youtube_videos(*), youtube_channels(*)')
        .eq('id', queueId).single()

      if (!queueEntry) throw new Error(`Queue entry ${queueId} not found`)

      const video = queueEntry.youtube_videos as Record<string, unknown>
      const channel = queueEntry.youtube_channels as Record<string, unknown>
      const retryCount = (queueEntry.retry_count ?? 0) + 1
      const maxRetries = queueEntry.max_retries ?? 5

      if (retryCount >= maxRetries) {
        await updateQueueStatus(queueId, 'manual_review_required', {
          last_error: `Recovery exhausted after ${retryCount} attempts`,
        })
        await addLog(queueId, videoId, 'error', 'Recovery exhausted — manual review required')
        await logRecoveryAction(failureId, queueId, 'manual_review', true, 'Max retries reached')
        await notifyUploadFailure(
          String(video.title ?? videoId),
          String(channel.naam ?? channelId),
          `Recovery exhausted after ${retryCount} attempts`
        )
        return { exhausted: true }
      }

      switch (failureType) {
        case 'upload_stuck': {
          log.info('Recovery: retry upload', { queueId })
          await addLog(queueId, videoId, 'info', 'Recovery: cancelling stuck upload and retrying')
          await updateQueueStatus(queueId, 'retrying', { retry_count: retryCount })
          await enqueueUpload({ queueId, videoId, channelId })
          await logRecoveryAction(failureId, queueId, 'retry_upload', true, `Retry attempt ${retryCount}`)
          break
        }

        case 'processing_failed': {
          log.info('Recovery: retranscode and reupload', { queueId })
          await addLog(queueId, videoId, 'info', 'Recovery: retranscoding and reuploading')

          const filePath = String(video.file_path ?? '')
          const normalizedPath = filePath.replace(/\.mp4$/i, `_recovery_${retryCount}.mp4`)

          await db.from('youtube_videos').update({
            normalized_path: null,
            updated_at: new Date().toISOString(),
          }).eq('id', videoId)

          await updateQueueStatus(queueId, 'normalizing', { retry_count: retryCount })
          await enqueueNormalize({ queueId, videoId, inputPath: filePath, outputPath: normalizedPath })
          await logRecoveryAction(failureId, queueId, 'retranscode', true, `Re-encoding attempt ${retryCount}`)
          break
        }

        case 'thumbnail_missing': {
          log.info('Recovery: reupload thumbnail', { queueId })
          const thumbnailPath = String(video.thumbnail_path ?? '')
          const youtubeVideoId = queueEntry.youtube_video_id

          if (!thumbnailPath || !youtubeVideoId) {
            await addLog(queueId, videoId, 'warn', 'Cannot recover thumbnail — missing thumbnail path or YouTube video ID')
            await logRecoveryAction(failureId, queueId, 'reupload_thumbnail', false, 'Missing thumbnail path or video ID')
            break
          }

          await enqueueThumbnail({
            queueId, videoId, channelId,
            youtubeVideoId,
            thumbnailPath,
          })
          await addLog(queueId, videoId, 'info', 'Thumbnail reupload queued')
          await logRecoveryAction(failureId, queueId, 'reupload_thumbnail', true, 'Thumbnail queued for reupload')
          break
        }

        case 'scheduled_publish_failed': {
          log.info('Recovery: forcing video public', { queueId })
          const youtubeVideoId = queueEntry.youtube_video_id

          if (!youtubeVideoId || !channel.refresh_token) {
            await addLog(queueId, videoId, 'error', 'Cannot force public — missing YouTube video ID or OAuth tokens')
            await logRecoveryAction(failureId, queueId, 'force_public', false, 'Missing video ID or tokens')
            break
          }

          const auth = buildOAuthClient(channel as Parameters<typeof buildOAuthClient>[0])
          await setVideoPublic(auth, youtubeVideoId)
          await db.from('youtube_videos').update({ privacy_status: 'public', updated_at: new Date().toISOString() }).eq('id', videoId)
          await addLog(queueId, videoId, 'success', 'Video forced public after scheduled publish failure')
          await logRecoveryAction(failureId, queueId, 'force_public', true, 'Video forced public')
          break
        }

        case 'copyright_detected': {
          log.info('Recovery: flagging copyright claim', { queueId })
          await updateQueueStatus(queueId, 'manual_review_required', { last_error: 'Copyright detected' })
          await addLog(queueId, videoId, 'error', 'Copyright claim — manual review required')
          await logRecoveryAction(failureId, queueId, 'flag_copyright', true, 'Flagged for manual copyright review')
          break
        }

        case 'browser_check_failed': {
          log.info('Recovery: retry browser verification after delay', { queueId })
          await updateQueueStatus(queueId, 'manual_review_required', { last_error: 'Browser check failed after recovery' })
          await addLog(queueId, videoId, 'warn', 'Browser check failed — review live URL manually')
          await logRecoveryAction(failureId, queueId, 'manual_review', true, 'Browser check failed — manual review')
          break
        }

        default: {
          log.warn('Unknown failure type', { failureType })
          await logRecoveryAction(failureId, queueId, 'manual_review', false, `Unknown failure type: ${failureType}`)
        }
      }

      await db.from('youtube_upload_failures').update({
        recovery_attempted: true,
        recovery_success: true,
      }).eq('id', failureId)

      return { recovered: true, action: failureType }
    },
    {
      connection: getRedis(),
      concurrency: 3,
    }
  )

  worker.on('failed', async (job, err) => {
    if (!job) return
    const { queueId, videoId } = job.data
    log.error('Recovery job failed', { queueId, error: err.message })
    await addLog(queueId, videoId, 'error', `Recovery worker error: ${err.message}`)
  })

  log.info('YouTube recovery worker started')
  return worker
}
