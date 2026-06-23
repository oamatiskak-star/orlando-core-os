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
import ffmpeg from 'fluent-ffmpeg'

function probeHasAudio(filePath: string): Promise<boolean> {
  return new Promise((resolve) => {
    ffmpeg.ffprobe(filePath, (err, data) => {
      if (err) { resolve(true); return } // assume OK on probe error — let upload proceed
      resolve(data.streams.some(s => s.codec_type === 'audio'))
    })
  })
}

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

// Tracked-shortlink basis voor affiliate-CTA's. Klikken lopen via /r/<short_code> (redirect-engine)
// zodat affiliate_clicks geregistreerd wordt. NOOIT de rauwe affiliate-URL in de beschrijving.
const SHORTLINK_BASE = (process.env.SHORTLINK_BASE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'https://dashboard.strkbeheer.nl').replace(/\/+$/, '')
// Categorieën waar een affiliate-CTA inhoudelijk past (geen blinde injectie op alle kanalen).
const AFFILIATE_CTA_CATEGORIES = ['ai_video', 'saas_ai', 'automation', 'creator_tools']
const CTA_LABELS: Record<string, string> = {
  ElevenLabs: '🎙️ De AI-stem in deze video',
  Synthesia: '🎬 AI-video gemaakt met Synthesia',
  HeyGen: '🎬 AI-avatars via HeyGen',
}

/**
 * Voegt tracked affiliate-shortlink-CTA's toe aan de beschrijving op basis van de ACTIEVE
 * affiliate_links die aan dit kanaal gemapt zijn. 100% data-gedreven (affiliate_links/-mappings),
 * geen hardcoded link, altijd /r/<short_code> (nooit de rauwe URL). Fail-safe: een fout mag een
 * upload nooit blokkeren; bij twijfel wordt de oorspronkelijke beschrijving teruggegeven.
 */
async function buildAffiliateDescription(
  db: ReturnType<typeof getSupabase>,
  channel: { id?: string; name?: string | null; naam?: string | null },
  baseDescription: string,
): Promise<string> {
  try {
    const channelName = channel.name ?? channel.naam
    if (!channelName) return baseDescription
    // youtube_channels → media_holding_channels (mappings hangen aan media_holding_channels.id)
    const { data: mhc } = await db.from('media_holding_channels').select('id').ilike('name', channelName).maybeSingle()
    if (!mhc) return baseDescription
    const { data: maps } = await db.from('affiliate_channel_mappings')
      .select('affiliate_program_id').eq('channel_id', mhc.id).eq('is_active', true)
      .order('priority', { ascending: true })
    if (!maps?.length) return baseDescription
    const { data: progs } = await db.from('affiliate_programs')
      .select('name').in('id', maps.map(m => m.affiliate_program_id))
      .eq('account_status', 'active').in('category', AFFILIATE_CTA_CATEGORIES)
    if (!progs?.length) return baseDescription
    const { data: links } = await db.from('affiliate_links')
      .select('network, short_code').in('network', progs.map(p => p.name))
      .eq('active', true).is('content_item_id', null).not('short_code', 'is', null)
    if (!links?.length) return baseDescription
    const seen = new Set<string>()
    const ctaLines = links
      .filter(l => l.short_code && !seen.has(l.short_code) && seen.add(l.short_code))
      .map(l => `${CTA_LABELS[l.network] ?? `👉 ${l.network}`}: ${SHORTLINK_BASE}/r/${l.short_code}`)
    if (!ctaLines.length) return baseDescription
    if (baseDescription.includes(`${SHORTLINK_BASE}/r/`)) return baseDescription // idempotent
    return `${baseDescription}\n\n${ctaLines.join('\n')}`.trim()
  } catch (e) {
    log.warn('Affiliate-CTA injectie overgeslagen', { error: (e as Error).message })
    return baseDescription
  }
}

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

      // Volgorde: genormaliseerd (lokaal op Render, mét muziek) → persistente
      // storage_path (URL, restart-proof) → file_path (vluchtig /tmp, laatste redmiddel).
      // Zo overleven uploads een restart én gaat normalisatie-met-muziek niet verloren.
      const rawPath = video.normalized_path ?? video.storage_path ?? video.file_path
      if (!rawPath) throw new Error(`Video ${videoId} has no file_path — bestand al verwijderd?`)
      const isStorageUrl = rawPath.startsWith('http')

      let filePath: string = rawPath
      let tempDownloaded: string | null = null

      if (isStorageUrl) {
        const tmpDir = process.env.VIDEO_OUTPUT_DIR ?? '/opt/orlando-videos/work'
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
        await enqueueNormalize({ queueId, videoId, channelId, inputPath: video.storage_path ?? filePath, outputPath: normalizedPath })
        return { queued_normalize: true }
      }

      // Audio check: geen-audio video's gaan normaal via de normalizer voor
      // achtergrondmuziek. Voor visuele faceless-kanalen (SKIP_MUSIC_NORMALIZE_CHANNELS)
      // slaan we dat over en uploaden we direct vanuit storage — de zware muziek-encode
      // stalde te vaak op Render. Muziek kan later via een lichter profiel terug.
      const skipMusicChannels = (process.env.SKIP_MUSIC_NORMALIZE_CHANNELS ?? 'LoopForge AI,BrickPulse Lab')
        .split(',').map(s => s.trim()).filter(Boolean)
      const hasAudio = await probeHasAudio(filePath)
      if (!hasAudio && !skipMusicChannels.includes(String(channel.naam))) {
        log.info('No audio stream — routing through normalizer for background music', { queueId, filePath })
        await addLog(queueId, videoId, 'info', 'Geen audio gedetecteerd — achtergrondmuziek wordt toegevoegd via normalizer')
        const normalizedPath = filePath.replace(/\.mp4$/i, '_normalized.mp4')
        await updateQueueStatus(queueId, 'normalizing')
        await enqueueNormalize({ queueId, videoId, channelId, inputPath: video.storage_path ?? filePath, outputPath: normalizedPath })
        return { queued_normalize: true }
      }
      if (!hasAudio) {
        log.info('No audio — music-normalize bypassed, uploading silent', { queueId, channel: channel.naam })
        await addLog(queueId, videoId, 'info', `Geen audio — muziek-normalize overgeslagen voor ${channel.naam}, stil geüpload`)
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
      // Affiliate-CTA: tracked shortlink(s) uit actieve affiliate_links in de beschrijving (/r/<code>).
      const description = await buildAffiliateDescription(db, channel, video.description ?? '')
      if (description !== (video.description ?? '')) {
        await addLog(queueId, videoId, 'info', 'Affiliate-shortlink toegevoegd aan beschrijving')
      }
      const result = await uploadVideo(auth, {
        filePath,
        title: video.title,
        description,
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

      if (video.thumbnail_path) {
        let thumbPath: string | null = null
        let tempThumb: string | null = null

        if (video.thumbnail_path.startsWith('http')) {
          const tmpDir = process.env.VIDEO_OUTPUT_DIR ?? '/opt/orlando-videos/work'
          fs.mkdirSync(tmpDir, { recursive: true })
          const ext = video.thumbnail_path.split('?')[0].split('.').pop() ?? 'jpg'
          const tmpFile = path.join(tmpDir, `thumb_${videoId}_${Date.now()}.${ext}`)
          try {
            await downloadToTemp(video.thumbnail_path, tmpFile)
            thumbPath = tmpFile
            tempThumb = tmpFile
          } catch (dlErr) {
            await addLog(queueId, videoId, 'warn', 'Thumbnail download failed — skipping', {
              error: (dlErr as Error).message,
            })
          }
        } else if (fs.existsSync(video.thumbnail_path)) {
          thumbPath = video.thumbnail_path
        }

        if (thumbPath) {
          try {
            await uploadThumbnail(auth, result.youtubeVideoId, thumbPath)
            await addLog(queueId, videoId, 'success', 'Thumbnail uploaded')
          } catch (thumbErr) {
            await addLog(queueId, videoId, 'warn', 'Thumbnail upload failed — skipping', {
              error: (thumbErr as Error).message,
            })
          } finally {
            if (tempThumb && fs.existsSync(tempThumb)) {
              fs.unlinkSync(tempThumb)
            }
          }
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

    // Terminale OAuth-fout: niet retryen (kan nooit slagen) + kanaal markeren voor reconnect.
    // Dit herstelt meteen de waarheid van oauth_connected op het moment dat het écht faalt.
    const errLower = (err.message ?? '').toLowerCase()
    const terminalAuth = ['unauthorized_client', 'invalid_grant', 'invalid_client', 'token has been expired or revoked']
      .some(p => errLower.includes(p))

    if (terminalAuth) {
      await db.from('youtube_channels')
        .update({ oauth_status: 'reconnect_required', oauth_connected: false })
        .eq('id', channelId)
      await recordFailure(queueId, videoId, 'oauth_unauthorized', err.message)
      await updateQueueStatus(queueId, 'manual_review_required', {
        retry_count: retryCount,
        last_error: err.message,
      })
      await addLog(queueId, videoId, 'error', `OAuth terminaal (${err.message}) — kanaal moet opnieuw verbonden worden; geen retry`)
      await notifyUploadFailure(videoTitle, channelName,
        `🔑 OAuth GEWEIGERD — kanaal "${channelName}" opnieuw verbinden. Niet automatisch herhaald (zou nooit slagen).`)
      return
    }

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
