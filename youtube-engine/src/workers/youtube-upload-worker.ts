import { Worker, Job } from 'bullmq'
import { getRedis, QUEUE_NAMES, UploadJobData, enqueueVerification, enqueueNormalize } from '../lib/redis-queue'
import { getSupabase, updateQueueStatus, addLog, recordFailure } from '../lib/supabase'
import { buildOAuthClient, uploadVideo, uploadThumbnail } from '../lib/youtube-api'
import { notifyUploadFailure } from '../lib/notifications'
import { workerLogger } from '../lib/logger'
import { v4 as uuidv4 } from 'uuid'
import path from 'path'
import fs from 'fs'
import axios from 'axios'

async function downloadToTemp(url: string, dest: string): Promise<void> {
  const response = await axios.get<NodeJS.ReadableStream>(url, { responseType: 'stream' })
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest)
    ;(response.data as NodeJS.ReadableStream).pipe(file)
    file.on('finish', () => file.close((err) => (err ? reject(err) : resolve())))
    file.on('error', (err) => { try { fs.unlinkSync(dest) } catch (_) { /* ignore */ }; reject(err) })
  })
}

const log = workerLogger('upload-worker')
const CONCURRENCY = parseInt(process.env.UPLOAD_WORKER_CONCURRENCY ?? '2')

export function startYouTubeUploadWorker(): Worker {
  const worker = new Worker<UploadJobData>(
    QUEUE_NAMES.UPLOAD,
    async (job: Job<UploadJobData>) => {
      const { queueId, videoId, channelId } = job.data
      const db = getSupabase()
      const workerId = uuidv4().slice(0, 8)

      log.info('Upload job started', { queueId, videoId, workerId })

      await updateQueueStatus(queueId, 'preparing', {
        upload_started_at: new Date().toISOString(),
        worker_id: workerId,
      })

      const [{ data: video }, { data: channel }, { data: queueEntry }] = await Promise.all([
        db.from('youtube_videos').select('*').eq('id', videoId).single(),
        db.from('youtube_channels').select('*').eq('id', channelId).single(),
        db.from('youtube_upload_queue').select('*').eq('id', queueId).single(),
      ])

      if (!video) throw new Error(`Video ${videoId} not found`)
      if (!channel) throw new Error(`Channel ${channelId} not found`)
      if (!queueEntry) throw new Error(`Queue entry ${queueId} not found`)

      const rawPath = video.normalized_path ?? video.file_path
      if (!rawPath) throw new Error(`Video ${videoId} has no file_path — bestand al verwijderd?`)
      const isStorageUrl = rawPath.startsWith('http')

      let filePath: string = rawPath
      let tempDownloaded: string | null = null

      if (isStorageUrl) {
        const tmpDir = process.env.VIDEO_OUTPUT_DIR ?? '/tmp/orlando-videos'
        fs.mkdirSync(tmpDir, { recursive: true })
        const tmpFile = path.join(tmpDir, `download_${videoId}_${Date.now()}.mp4`)
        log.info('Downloading video from storage', { queueId, url: rawPath })
        await addLog(queueId, videoId, 'info', 'Downloaden van Supabase Storage...', { url: rawPath })
        await downloadToTemp(rawPath, tmpFile)
        filePath = tmpFile
        tempDownloaded = tmpFile
        log.info('Download complete', { queueId, localPath: filePath })
      } else if (!fs.existsSync(filePath)) {
        log.info('File not normalized yet, queuing normalization', { queueId })
        const normalizedPath = filePath.replace(/\.mp4$/i, '_normalized.mp4')
        await updateQueueStatus(queueId, 'normalizing')
        await enqueueNormalize({
          queueId,
          videoId,
          channelId,
          inputPath: filePath,
          outputPath: normalizedPath,
        })
        return { queued_normalize: true }
      }

      await addLog(queueId, videoId, 'info', 'Starting YouTube upload', {
        filePath,
        title: video.title,
        channel: channel.naam,
      })

      if (!channel.refresh_token) {
        throw new Error(`Channel ${channel.naam} has no OAuth tokens configured`)
      }

      const auth = buildOAuthClient(channel)
      const attemptNumber = (queueEntry.retry_count ?? 0) + 1

      // Determine effective privacy and schedule based on queue slot timing
      const slotTime = queueEntry.scheduled_publish_at
        ? new Date(queueEntry.scheduled_publish_at)
        : null
      const PUBLISH_BUFFER_MS = 10 * 60 * 1000 // 10 min: if slot is within 10 min or past → publish now
      let effectivePrivacy: 'public' | 'private' | 'unlisted' = 'private'
      let effectiveScheduledAt: string | undefined = undefined

      if (slotTime && slotTime <= new Date(Date.now() + PUBLISH_BUFFER_MS)) {
        effectivePrivacy = 'public'
        log.info('Slot time is past/imminent — uploading as public', { queueId, slotTime: slotTime.toISOString() })
      } else if (slotTime) {
        effectivePrivacy = 'private'
        effectiveScheduledAt = slotTime.toISOString()
        log.info('Slot in future — uploading as scheduled private', { queueId, publishAt: effectiveScheduledAt })
      }

      const { data: attempt } = await db.from('youtube_upload_attempts').insert({
        queue_id: queueId,
        attempt_number: attemptNumber,
        started_at: new Date().toISOString(),
        status: 'in_progress',
      }).select('id').single()

      await updateQueueStatus(queueId, 'uploading')
      await addLog(queueId, videoId, 'info', `Upload attempt ${attemptNumber} started`)

      const startTime = Date.now()

      let lastProgressLog = 0
      const result = await uploadVideo(auth, {
        filePath,
        title: video.title,
        description: video.description ?? '',
        tags: video.tags ?? [],
        categoryId: video.category_id ?? '22',
        privacyStatus: effectivePrivacy,
        scheduledPublishAt: effectiveScheduledAt,
        madeForKids: video.made_for_kids ?? false,
        thumbnailPath: video.thumbnail_path ?? undefined,
        onProgress: (bytesUploaded, totalBytes) => {
          const pct = Math.round((bytesUploaded / totalBytes) * 100)
          if (pct - lastProgressLog >= 10) {
            lastProgressLog = pct
            log.info(`Upload progress ${pct}%`, { queueId })
          }
        },
      })

      const durationMs = Date.now() - startTime

      await db.from('youtube_upload_attempts').update({
        finished_at: new Date().toISOString(),
        status: 'success',
        upload_response: result as unknown as Record<string, unknown>,
        duration_ms: durationMs,
      }).eq('id', attempt?.id)

      await db.from('youtube_videos').update({
        youtube_video_id: result.youtubeVideoId,
        status: 'uploaded',
        privacy_status: effectivePrivacy,
        updated_at: new Date().toISOString(),
      }).eq('id', videoId)

      await updateQueueStatus(queueId, 'uploaded_pending_processing', {
        upload_finished_at: new Date().toISOString(),
        youtube_video_id: result.youtubeVideoId,
        youtube_url: result.youtubeUrl,
      })

      await addLog(queueId, videoId, 'success', 'Upload completed — pending processing', {
        youtubeVideoId: result.youtubeVideoId,
        youtubeUrl: result.youtubeUrl,
        durationMs,
      })

      if (video.thumbnail_path && fs.existsSync(video.thumbnail_path)) {
        try {
          await uploadThumbnail(auth, result.youtubeVideoId, video.thumbnail_path)
          await addLog(queueId, videoId, 'success', 'Thumbnail uploaded')
        } catch (thumbErr) {
          await addLog(queueId, videoId, 'warn', 'Thumbnail upload failed — will retry', {
            error: (thumbErr as Error).message,
          })
        }
      }

      await enqueueVerification({
        queueId,
        videoId,
        channelId,
        youtubeVideoId: result.youtubeVideoId,
        attemptCount: 0,
      }, 30_000)

      log.info('Upload complete, verification queued', {
        queueId,
        youtubeVideoId: result.youtubeVideoId,
      })

      if (tempDownloaded && fs.existsSync(tempDownloaded)) {
        fs.unlinkSync(tempDownloaded)
        log.info('Temp download file removed', { path: tempDownloaded })
      }

      return result
    },
    {
      connection: getRedis(),
      concurrency: CONCURRENCY,
    }
  )

  worker.on('failed', async (job, err) => {
    if (!job) return
    const { queueId, videoId, channelId } = job.data
    const db = getSupabase()

    log.error('Upload job failed', { queueId, error: err.message })

    const { data: queueEntry } = await db.from('youtube_upload_queue')
      .select('retry_count, max_retries')
      .eq('id', queueId).single()

    const retryCount = (queueEntry?.retry_count ?? 0) + 1
    const maxRetries = queueEntry?.max_retries ?? 5

    const { data: video } = await db.from('youtube_videos').select('title').eq('id', videoId).single()
    const { data: channel } = await db.from('youtube_channels').select('naam').eq('id', channelId).single()
    const videoTitle = video?.title ?? videoId
    const channelName = channel?.naam ?? channelId

    if (retryCount < maxRetries) {
      await updateQueueStatus(queueId, 'retrying', {
        retry_count: retryCount,
        last_error: err.message,
      })
      await addLog(queueId, videoId, 'warn', `Upload failed, retry ${retryCount}/${maxRetries}`, {
        error: err.message,
      })
      // Notify on every failure so nothing is missed
      await notifyUploadFailure(videoTitle, channelName, `Poging ${retryCount}/${maxRetries}: ${err.message}`)
    } else {
      const failureId = await recordFailure(queueId, videoId, 'upload_stuck', err.message)
      await updateQueueStatus(queueId, 'manual_review_required', {
        retry_count: retryCount,
        last_error: err.message,
      })
      await addLog(queueId, videoId, 'error', 'Max retries reached — manual review required')
      await notifyUploadFailure(videoTitle, channelName, `❌ MAX RETRIES BEREIKT — Handmatige review vereist\n${err.message}`)
    }
  })

  log.info('YouTube upload worker started', { concurrency: CONCURRENCY })
  return worker
}
