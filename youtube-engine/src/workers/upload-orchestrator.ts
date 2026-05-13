import cron from 'node-cron'
import { getSupabase, updateQueueStatus, addLog } from '../lib/supabase'
import { enqueueUpload, enqueueAnalytics } from '../lib/redis-queue'
import { workerLogger } from '../lib/logger'

const log = workerLogger('orchestrator')

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
    await updateQueueStatus(item.id, 'preparing')
    await enqueueUpload({
      queueId: item.id,
      videoId: item.video_id,
      channelId: item.channel_id,
      priority: item.priority,
    })
    log.info('Dispatched to upload queue', { queueId: item.id })
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
    .eq('youtube_videos.status', 'live')
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

  log.info('Orchestrator crons registered')
}
