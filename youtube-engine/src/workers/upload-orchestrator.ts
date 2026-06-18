import cron from 'node-cron'
import { getSupabase, updateQueueStatus, addLog } from '../lib/supabase'
import { enqueueUpload, enqueueAnalytics } from '../lib/redis-queue'
import { buildOAuthClient, setVideoPublic } from '../lib/youtube-api'
import { duplicateTitleOnChannel } from '../lib/title-dedup'
import { notifyUploadStarted, notifyQuotaLimit } from '../lib/notifications'
import { emitErrorEvent } from '../lib/error-emission'
import { workerLogger } from '../lib/logger'

const log = workerLogger('orchestrator')

// YouTube Data API quota resets at midnight Pacific Time (07:00 UTC in summer, 08:00 UTC in winter).
// We use 07:00 UTC as a safe reset anchor.
function quotaResetToday(): Date {
  const now = new Date()
  const reset = new Date(now)
  reset.setUTCHours(7, 0, 0, 0)
  if (reset > now) reset.setUTCDate(reset.getUTCDate() - 1)
  return reset
}

// Global fallback: 6 uploads/day → 9,600 quota units, leaves ~400 for verification + analytics.
// Per-channel override via youtube_channels.daily_upload_target (requires own Google Cloud quota).
const MAX_UPLOADS_PER_DAY_PER_CHANNEL = parseInt(
  process.env.MAX_UPLOADS_PER_DAY_PER_CHANNEL ?? '6'
)

async function getChannelDailyLimits(): Promise<Record<string, number>> {
  const db = getSupabase()
  const { data } = await db.from('youtube_channels').select('id, daily_upload_target')
  const limits: Record<string, number> = {}
  for (const ch of data ?? []) {
    limits[ch.id] = ch.daily_upload_target ?? MAX_UPLOADS_PER_DAY_PER_CHANNEL
  }
  return limits
}

async function getChannelUploadsToday(channelId: string): Promise<number> {
  const db = getSupabase()
  const { count } = await db
    .from('youtube_upload_queue')
    .select('id', { count: 'exact', head: true })
    .eq('channel_id', channelId)
    .in('status', ['preparing', 'uploading', 'uploaded_pending_processing', 'verifying', 'verified_live', 'retrying'])
    .gte('updated_at', quotaResetToday().toISOString())

  return count ?? 0
}

async function getOverQuotaChannelIds(limits: Record<string, number>): Promise<string[]> {
  const db = getSupabase()
  const resetTime = quotaResetToday().toISOString()

  const { data } = await db
    .from('youtube_upload_queue')
    .select('channel_id')
    .in('status', ['preparing', 'uploading', 'uploaded_pending_processing', 'verifying', 'verified_live', 'retrying'])
    .gte('updated_at', resetTime)

  const counts: Record<string, number> = {}
  for (const row of data ?? []) {
    counts[row.channel_id] = (counts[row.channel_id] ?? 0) + 1
  }
  return Object.entries(counts)
    .filter(([id, count]) => count >= (limits[id] ?? MAX_UPLOADS_PER_DAY_PER_CHANNEL))
    .map(([id]) => id)
}

// CF2 upload-protection chokepoint (canonieke spine 153, NIET de verboden #149-scoring/view/RPC).
// Blokkeert queue-items die gekoppeld zijn aan een CF2 video_project dat de OBJECTIEVE QC-gate
// niet heeft gehaald. Legacy/non-CF2 uploads (geen video_projects.queue_id-link) passeren ongemoeid.
// Fail-open op lookup-fouten: de live legacy-pijplijn mag nooit gehalt worden door een DB-hiccup.
//
// AUTONOME GOEDKEURING (cert-sprint): de gate blokkeert uitsluitend op een OBJECTIEVE gate
// (QC/CQI niet geslaagd), niet op menselijke afwezigheid. quality_passed=true (de QC-gate uit
// /api/youtube/quality/assess: CQI + alle drempels) volstaat om door te laten — er is geen
// handmatige approve meer vereist. Een expliciete human approved=true blijft als override gelden.
// QC/CQI-gates, privacy=private en incident/recovery blijven volledig actief en ongemoeid.
async function cf2ApprovalBlocked(queueId: string): Promise<string | null> {
  const db = getSupabase()
  const { data, error } = await db
    .from('video_projects')
    .select('approved, quality_passed, status')
    .eq('queue_id', queueId)
    .maybeSingle()
  if (error) {
    log.warn('CF2-gate: QC-lookup faalde — item doorgelaten (fail-open)', { queueId, error: error.message })
    return null
  }
  if (!data) return null                        // geen CF2-koppeling → legacy upload, doorlaten
  if (data.approved === true) return null        // expliciete human-override → doorlaten
  if (data.quality_passed === true) return null  // objectieve QC-gate geslaagd → autonoom doorlaten
  return `qc_gate_not_passed (status=${data.status ?? 'onbekend'})`  // objectieve gate, geen menselijke afwezigheid
}

async function pollQueuedItems(): Promise<void> {
  const db = getSupabase()

  const channelLimits = await getChannelDailyLimits()
  const overQuotaIds = await getOverQuotaChannelIds(channelLimits)

  let query = db
    .from('youtube_upload_queue')
    .select('id, video_id, channel_id, priority, retry_count')
    .in('status', ['queued', 'retrying'])
    .lte('scheduled_publish_at', new Date(Date.now() + 60 * 60 * 1000).toISOString())

  if (overQuotaIds.length > 0) {
    query = query.not('channel_id', 'in', `(${overQuotaIds.join(',')})`) as typeof query
  }

  const { data: queued } = await query
    .order('priority', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(10)

  if (!queued || queued.length === 0) {
    if (overQuotaIds.length > 0) {
      log.info(`Polling: all eligible channels at daily limit (${overQuotaIds.length} over quota)`)
    }
    return
  }

  log.info(`Polling: found ${queued.length} queued items (${overQuotaIds.length} channels skipped — at limit)`)

  for (const item of queued) {
    const uploadedToday = await getChannelUploadsToday(item.channel_id)
    const channelLimit = channelLimits[item.channel_id] ?? MAX_UPLOADS_PER_DAY_PER_CHANNEL

    if (uploadedToday >= channelLimit) {
      log.info('Channel daily upload limit reached — skipping', {
        channelId: item.channel_id,
        uploadedToday,
        limit: channelLimit,
      })
      const { data: ch } = await db.from('youtube_channels').select('naam').eq('id', item.channel_id).maybeSingle()
      await notifyQuotaLimit(ch?.naam ?? item.channel_id, uploadedToday, channelLimit)
      continue
    }

    // Fetch title + scheduled_at for notification
    const { data: queueRow } = await db
      .from('youtube_upload_queue')
      .select('title, scheduled_publish_at, youtube_channels(naam), youtube_videos(title)')
      .eq('id', item.id)
      .maybeSingle()
    const videoTitle = (queueRow?.youtube_videos as any)?.title ?? queueRow?.title ?? 'Onbekend'
    const channelName = (queueRow?.youtube_channels as any)?.naam ?? item.channel_id

    // CF2 upload-protection chokepoint — blokkeer niet-goedgekeurde CF2-content vóór dispatch
    const cf2Block = await cf2ApprovalBlocked(item.id)
    if (cf2Block) {
      log.warn('CF2 upload-gate: project zonder geslaagde QC-gate geblokkeerd', { queueId: item.id, reason: cf2Block })
      await updateQueueStatus(item.id, 'manual_review_required', { last_error: cf2Block })
      await addLog(item.id, item.video_id, 'warn', 'CF2 upload-gate: upload geblokkeerd op objectieve QC-gate', { reason: cf2Block })
      continue
    }

    // Pre-publish dedup-gate — blokkeer near-duplicate titels vóór upload (anders straft
    // YouTube beide duplicaten af als spam). Fail-open: DB-hiccup blokkeert de pijplijn niet.
    if (videoTitle && videoTitle !== 'Onbekend') {
      const dupReason = await duplicateTitleOnChannel(db, item.channel_id, videoTitle, item.id)
      if (dupReason) {
        log.warn('Pre-publish dedup: near-duplicate geblokkeerd', { queueId: item.id, reason: dupReason })
        await updateQueueStatus(item.id, 'duplicate_skipped', { last_error: dupReason })
        await addLog(item.id, item.video_id, 'warn', 'Pre-publish dedup: upload overgeslagen (near-duplicate)', { reason: dupReason })
        continue
      }
    }

    await updateQueueStatus(item.id, 'preparing')
    await enqueueUpload({
      queueId: item.id,
      videoId: item.video_id,
      channelId: item.channel_id,
      priority: item.priority,
    })
    await notifyUploadStarted(videoTitle, channelName, queueRow?.scheduled_publish_at ?? null)
    log.info('Dispatched to upload queue', {
      queueId: item.id,
      uploadedToday: uploadedToday + 1,
      limit: channelLimit,
    })
  }
}

async function pollStuckProcessing(): Promise<void> {
  const db = getSupabase()
  const stuckThreshold = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()

  const { data: stuck } = await db
    .from('youtube_upload_queue')
    .select('id, video_id, channel_id, youtube_video_id, retry_count, max_retries')
    .in('status', ['preparing', 'uploading', 'uploaded_pending_processing', 'processing'])
    .lt('updated_at', stuckThreshold)
    .limit(5)

  if (!stuck || stuck.length === 0) return

  log.warn(`Found ${stuck.length} stuck uploads`)

  for (const item of stuck) {
    log.warn('Stuck upload detected', { queueId: item.id, retries: item.retry_count })

    if ((item.retry_count ?? 0) >= (item.max_retries ?? 5)) {
      await emitErrorEvent({
        errorCode: 'upload_stuck_exhausted',
        taskId: item.id,
        taskType: 'youtube_upload',
        message: 'Stuck upload — automatic retry exhausted',
        severity: 'error',
        workerId: 'upload-orchestrator',
        metadata: {
          videoId: item.video_id,
          channelId: item.channel_id,
          retryCount: item.retry_count,
          maxRetries: item.max_retries,
        },
      }).catch(() => {})

      await updateQueueStatus(item.id, 'manual_review_required', {
        last_error: 'Stuck upload — automatic retry exhausted',
      })
      continue
    }

    await emitErrorEvent({
      errorCode: 'upload_stuck',
      taskId: item.id,
      taskType: 'youtube_upload',
      message: 'Stuck upload detected — retrying',
      severity: 'warning',
      workerId: 'upload-orchestrator',
      metadata: {
        videoId: item.video_id,
        channelId: item.channel_id,
        currentRetry: (item.retry_count ?? 0) + 1,
        maxRetries: item.max_retries,
      },
    }).catch(() => {})

    await updateQueueStatus(item.id, 'retrying', {
      retry_count: (item.retry_count ?? 0) + 1,
      last_error: 'Stuck detected by orchestrator — retrying',
    })

    await enqueueUpload({
      queueId: item.id,
      videoId: item.video_id,
      channelId: item.channel_id,
    })
  }
}

async function scheduleAnalyticsForLiveVideos(): Promise<void> {
  const db = getSupabase()
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const { data: liveWithoutRecent } = await db
    .from('youtube_upload_queue')
    .select('video_id, channel_id, youtube_video_id')
    .eq('status', 'verified_live')
    .not('youtube_video_id', 'is', null)
    .limit(20)

  if (!liveWithoutRecent || liveWithoutRecent.length === 0) return

  for (const item of liveWithoutRecent) {
    if (!item.youtube_video_id) continue

    const { data: recentAnalytics } = await db
      .from('youtube_video_analytics')
      .select('id')
      .eq('youtube_video_id', item.youtube_video_id)
      .gte('recorded_at', oneDayAgo)
      .limit(1)

    if (!recentAnalytics || recentAnalytics.length === 0) {
      await enqueueAnalytics({
        videoId: item.video_id,
        channelId: item.channel_id,
        youtubeVideoId: item.youtube_video_id,
      })
    }
  }
}

async function updateChannelQuotas(): Promise<void> {
  const db = getSupabase()
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)

  const { data: channels } = await db
    .from('youtube_channels')
    .select('id')
    .or(`upload_quota_reset_at.is.null,upload_quota_reset_at.lt.${today.toISOString()}`)

  if (!channels) return

  for (const channel of channels) {
    await db.from('youtube_channels').update({
      upload_quota_used: 0,
      upload_quota_reset_at: new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString(),
    }).eq('id', channel.id)
  }

  if (channels.length > 0) {
    log.info(`Reset upload quota for ${channels.length} channels`)
  }
}

async function publishOverdueVideos(): Promise<void> {
  const db = getSupabase()

  // Only statuses that genuinely need a publish call — verified_live is already live
  const { data: overdue } = await db
    .from('youtube_upload_queue')
    .select('id, video_id, channel_id, youtube_video_id')
    .in('status', ['uploaded_pending_processing', 'verifying'])
    .not('youtube_video_id', 'is', null)
    .lte('scheduled_publish_at', new Date().toISOString())

  if (!overdue || overdue.length === 0) return

  // Filter to only those whose video is still private in our DB
  const videoIds = overdue.map(i => i.video_id)
  const { data: privateVideos } = await db
    .from('youtube_videos')
    .select('id')
    .in('id', videoIds)
    .eq('privacy_status', 'private')

  if (!privateVideos || privateVideos.length === 0) return

  const privateSet = new Set(privateVideos.map(v => v.id))
  const toPublish = overdue.filter(i => privateSet.has(i.video_id))

  log.info(`publishOverdueVideos: ${toPublish.length} videos to make public`)

  for (const item of toPublish) {
    try {
      const { data: channel } = await db
        .from('youtube_channels')
        .select('*')
        .eq('id', item.channel_id)
        .single()

      if (!channel?.refresh_token) {
        log.warn('No OAuth token for channel', { channelId: item.channel_id })
        continue
      }

      const auth = buildOAuthClient(channel)
      await setVideoPublic(auth, item.youtube_video_id)

      await db.from('youtube_videos').update({
        privacy_status: 'public',
        updated_at: new Date().toISOString(),
      }).eq('id', item.video_id)

      await updateQueueStatus(item.id, 'verified_live', {
        verification_finished_at: new Date().toISOString(),
      })

      await addLog(item.id, item.video_id, 'success', 'Scheduled publish executed — video is now public')
      log.info('Video published', { queueId: item.id, youtubeVideoId: item.youtube_video_id })
    } catch (err) {
      const msg = (err as Error).message
      // Quota exhausted — stop immediately, no point hammering remaining items
      if (msg.includes('quota')) {
        log.warn('publishOverdueVideos: quota exhausted, stopping run', { remaining: toPublish.length })
        await emitErrorEvent({
          errorCode: 'publish_quota_exhausted',
          taskId: item.id,
          taskType: 'youtube_publish',
          message: 'YouTube API quota exhausted during scheduled publish',
          severity: 'critical',
          workerId: 'upload-orchestrator',
          metadata: {
            videoId: item.video_id,
            youtubeVideoId: item.youtube_video_id,
            channelId: item.channel_id,
            itemsRemaining: toPublish.length,
          },
        }).catch(() => {})
        return
      }
      log.error('publishOverdueVideos failed for item', { queueId: item.id, error: msg })
      await emitErrorEvent({
        errorCode: 'publish_failed',
        taskId: item.id,
        taskType: 'youtube_publish',
        message: `Failed to publish video: ${msg}`,
        severity: 'error',
        workerId: 'upload-orchestrator',
        metadata: {
          videoId: item.video_id,
          youtubeVideoId: item.youtube_video_id,
          channelId: item.channel_id,
        },
        stackTrace: (err as Error).stack,
      }).catch(() => {})
    }
  }
}

export function startUploadOrchestrator(): void {
  log.info('Upload orchestrator starting')

  cron.schedule('*/30 * * * * *', async () => {
    try { await pollQueuedItems() } catch (err) {
      log.error('pollQueuedItems error', { error: (err as Error).message })
    }
  })

  cron.schedule('*/5 * * * *', async () => {
    try { await pollStuckProcessing() } catch (err) {
      log.error('pollStuckProcessing error', { error: (err as Error).message })
    }
  })

  cron.schedule('0 * * * *', async () => {
    try { await scheduleAnalyticsForLiveVideos() } catch (err) {
      log.error('scheduleAnalyticsForLiveVideos error', { error: (err as Error).message })
    }
  })

  cron.schedule('0 0 * * *', async () => {
    try { await updateChannelQuotas() } catch (err) {
      log.error('updateChannelQuotas error', { error: (err as Error).message })
    }
  })

  // Every 2 minutes: publish videos whose scheduled time has passed
  cron.schedule('*/2 * * * *', async () => {
    try { await publishOverdueVideos() } catch (err) {
      log.error('publishOverdueVideos error', { error: (err as Error).message })
    }
  })

  log.info('Orchestrator crons registered')
}
