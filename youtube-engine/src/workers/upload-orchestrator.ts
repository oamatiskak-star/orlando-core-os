import cron from 'node-cron'
import { getSupabase, updateQueueStatus, addLog } from '../lib/supabase'
import { enqueueUpload, enqueueAnalytics } from '../lib/redis-queue'
import { buildOAuthClient, setVideoPublic } from '../lib/youtube-api'
import { notifyUploadStarted, notifyQuotaLimit } from '../lib/notifications'
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

// Max uploads dispatched per channel per quota day. Each upload costs 1,600 units.
// Default 6 → 9,600 units, leaves ~400 units for verification + analytics.
const MAX_UPLOADS_PER_DAY_PER_CHANNEL = parseInt(
  process.env.MAX_UPLOADS_PER_DAY_PER_CHANNEL ?? '6'
)

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

async function pollQueuedItems(): Promise<void> {
  const db = getSupabase()

  const { data: queued } = await db
    .from('youtube_upload_queue')
    .select('id, video_id, channel_id, priority, retry_count')
    .in('status', ['queued', 'retrying'])
    .lte('scheduled_publish_at', new Date(Date.now() + 60 * 60 * 1000).toISOString())
    .order('priority', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(10)

  if (!queued || queued.length === 0) return

  log.info(`Polling: found ${queued.length} queued items`)

  for (const item of queued) {
    const uploadedToday = await getChannelUploadsToday(item.channel_id)

    if (uploadedToday >= MAX_UPLOADS_PER_DAY_PER_CHANNEL) {
      log.info('Channel daily upload limit reached — skipping', {
        channelId: item.channel_id,
        uploadedToday,
        limit: MAX_UPLOADS_PER_DAY_PER_CHANNEL,
      })
      const { data: ch } = await db.from('youtube_channels').select('naam').eq('id', item.channel_id).maybeSingle()
      await notifyQuotaLimit(ch?.naam ?? item.channel_id, uploadedToday, MAX_UPLOADS_PER_DAY_PER_CHANNEL)
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
      limit: MAX_UPLOADS_PER_DAY_PER_CHANNEL,
    })
  }
}

async function pollStuckProcessing(): Promise<void> {
  const db = getSupabase()
  const stuckThreshold = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()

  const { data: stuck } = await db
    .from('youtube_upload_queue')
    .select('id, video_id, channel_id, youtube_video_id, retry_count, max_retries')
    .in('status', ['uploading', 'uploaded_pending_processing', 'processing'])
    .lt('updated_at', stuckThreshold)
    .limit(5)

  if (!stuck || stuck.length === 0) return

  log.warn(`Found ${stuck.length} stuck uploads`)

  for (const item of stuck) {
    log.warn('Stuck upload detected', { queueId: item.id, retries: item.retry_count })

    if ((item.retry_count ?? 0) >= (item.max_retries ?? 5)) {
      await updateQueueStatus(item.id, 'manual_review_required', {
        last_error: 'Stuck upload — automatic retry exhausted',
      })
      continue
    }

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
        return
      }
      log.error('publishOverdueVideos failed for item', { queueId: item.id, error: msg })
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
