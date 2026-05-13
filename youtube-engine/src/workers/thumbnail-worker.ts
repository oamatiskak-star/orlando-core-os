import { Worker, Job } from 'bullmq'
import { getRedis, QUEUE_NAMES, ThumbnailJobData } from '../lib/redis-queue'
import { getSupabase, updateQueueStatus, addLog, recordFailure } from '../lib/supabase'
import { buildOAuthClient, uploadThumbnail } from '../lib/youtube-api'
import { workerLogger } from '../lib/logger'
import fs from 'fs'

const log = workerLogger('thumbnail-worker')

export function startThumbnailWorker(): Worker {
  const worker = new Worker<ThumbnailJobData>(
    QUEUE_NAMES.THUMBNAIL,
    async (job: Job<ThumbnailJobData>) => {
      const { queueId, videoId, channelId, youtubeVideoId, thumbnailPath } = job.data
      const db = getSupabase()

      log.info('Thumbnail upload started', { queueId, youtubeVideoId, thumbnailPath })

      if (!fs.existsSync(thumbnailPath)) {
        throw new Error(`Thumbnail file not found: ${thumbnailPath}`)
      }

      const { data: channel } = await db.from('youtube_channels')
        .select('*').eq('id', channelId).single()

      if (!channel) throw new Error(`Channel ${channelId} not found`)
      if (!channel.refresh_token) throw new Error(`Channel ${channel.naam} has no OAuth tokens`)

      const auth = buildOAuthClient(channel)

      await uploadThumbnail(auth, youtubeVideoId, thumbnailPath)
      await addLog(queueId, videoId, 'success', 'Thumbnail uploaded successfully', { thumbnailPath })

      log.info('Thumbnail uploaded', { queueId, youtubeVideoId })
      return { success: true }
    },
    {
      connection: getRedis(),
      concurrency: 3,
    }
  )

  worker.on('failed', async (job, err) => {
    if (!job) return
    const { queueId, videoId } = job.data
    log.error('Thumbnail upload failed', { queueId, error: err.message })
    await addLog(queueId, videoId, 'error', `Thumbnail upload failed: ${err.message}`)

    if (job.attemptsMade >= (job.opts.attempts ?? 3)) {
      await recordFailure(queueId, videoId, 'thumbnail_missing', err.message)
    }
  })

  log.info('Thumbnail worker started')
  return worker
}
