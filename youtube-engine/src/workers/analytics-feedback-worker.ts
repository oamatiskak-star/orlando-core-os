import { Worker, Job } from 'bullmq'
import { getRedis, QUEUE_NAMES, AnalyticsJobData, enqueueAnalytics } from '../lib/redis-queue'
import { getSupabase, addLog } from '../lib/supabase'
import { buildOAuthClient, getVideoAnalytics } from '../lib/youtube-api'
import { workerLogger } from '../lib/logger'

const log = workerLogger('analytics-worker')

function calcViralScore(data: {
  ctr?: number
  avgViewPercentage?: number
  views?: number
  subscribersGained?: number
}): number {
  const ctrScore = Math.min((data.ctr ?? 0) * 100 * 2, 30)
  const retentionScore = Math.min((data.avgViewPercentage ?? 0) * 0.4, 30)
  const viewScore = Math.min(Math.log10((data.views ?? 0) + 1) * 5, 25)
  const subScore = Math.min((data.subscribersGained ?? 0) * 0.5, 15)
  return Math.round(ctrScore + retentionScore + viewScore + subScore)
}

function calcTitleScore(analytics: Record<string, number>): number {
  const ctr = analytics['impressionClickThroughRate'] ?? 0
  const score = Math.min(ctr * 200, 100)
  return Math.round(score)
}

function calcThumbnailScore(analytics: Record<string, number>): number {
  const impressions = analytics['impressions'] ?? 0
  const ctr = analytics['impressionClickThroughRate'] ?? 0
  if (impressions < 100) return 50
  if (ctr >= 0.10) return 95
  if (ctr >= 0.07) return 80
  if (ctr >= 0.05) return 65
  if (ctr >= 0.03) return 50
  return 30
}

export function startAnalyticsFeedbackWorker(): Worker {
  const worker = new Worker<AnalyticsJobData>(
    QUEUE_NAMES.ANALYTICS,
    async (job: Job<AnalyticsJobData>) => {
      const { videoId, channelId, youtubeVideoId } = job.data
      const db = getSupabase()

      log.info('Analytics fetch started', { videoId, youtubeVideoId })

      const { data: channel } = await db.from('youtube_channels')
        .select('*').eq('id', channelId).single()

      if (!channel || !channel.refresh_token) {
        log.warn('No OAuth tokens for channel — skipping analytics', { channelId })
        return { skipped: true, reason: 'no_oauth' }
      }

      const auth = buildOAuthClient(channel)

      const today = new Date().toISOString().split('T')[0]
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

      const analytics = await getVideoAnalytics(auth, youtubeVideoId, thirtyDaysAgo, today)

      if (Object.keys(analytics).length === 0) {
        log.debug('No analytics data available yet', { videoId, youtubeVideoId })
        await enqueueAnalytics({ videoId, channelId, youtubeVideoId }, 4 * 60 * 60 * 1000)
        return { no_data: true }
      }

      const views = Math.round(analytics['views'] ?? 0)
      const likes = Math.round(analytics['likes'] ?? 0)
      const comments = Math.round(analytics['comments'] ?? 0)
      const shares = Math.round(analytics['shares'] ?? 0)
      const impressions = Math.round(analytics['impressions'] ?? 0)
      const ctr = analytics['impressionClickThroughRate'] ?? 0
      const watchTimeMinutes = analytics['estimatedMinutesWatched'] ?? 0
      const avgViewDuration = Math.round(analytics['averageViewDuration'] ?? 0)
      const avgViewPercentage = analytics['averageViewPercentage'] ?? 0
      const subscribersGained = Math.round(analytics['subscribersGained'] ?? 0)
      const estimatedRevenue = analytics['estimatedRevenue'] ?? 0
      const rpm = watchTimeMinutes > 0 ? (estimatedRevenue / watchTimeMinutes) * 1000 : 0

      const viralScore = calcViralScore({ ctr, avgViewPercentage, views, subscribersGained })
      const titleScore = calcTitleScore(analytics)
      const thumbnailScore = calcThumbnailScore(analytics)

      await db.from('youtube_video_analytics').insert({
        video_id: videoId,
        youtube_video_id: youtubeVideoId,
        recorded_at: new Date().toISOString(),
        views, likes, comments, shares, impressions,
        ctr,
        watch_time_minutes: watchTimeMinutes,
        avg_view_duration_seconds: avgViewDuration,
        avg_view_percentage: avgViewPercentage,
        subscribers_gained: subscribersGained,
        estimated_revenue: estimatedRevenue,
        rpm,
        viral_score: viralScore,
        title_performance_score: titleScore,
        thumbnail_performance_score: thumbnailScore,
      })

      await db.from('youtube_videos').update({
        viral_score: viralScore,
        updated_at: new Date().toISOString(),
      }).eq('id', videoId)

      log.info('Analytics recorded', {
        videoId, views, ctr: (ctr * 100).toFixed(2) + '%', viralScore,
      })

      await enqueueAnalytics({ videoId, channelId, youtubeVideoId }, 24 * 60 * 60 * 1000)

      return { views, ctr, viralScore, titleScore, thumbnailScore }
    },
    {
      connection: getRedis(),
      concurrency: 3,
    }
  )

  worker.on('failed', async (job, err) => {
    if (!job) return
    log.error('Analytics job failed', { videoId: job.data.videoId, error: err.message })
  })

  log.info('Analytics feedback worker started')
  return worker
}
