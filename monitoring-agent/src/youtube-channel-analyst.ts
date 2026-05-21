import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const POLL_MS = parseInt(process.env.POLL_INTERVAL_MS ?? '3600000', 10) // Default 1 hour

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

interface ChannelMetrics {
  channelId: string
  channelName: string
  totalViews: number
  totalWatchTimeMinutes: number
  totalImpressions: number
  averageCTR: number
  videoCount: number
  viralScoreAvg: number
}

interface TrendAnalysis {
  period: '48h' | '7d' | '30d'
  viewsPerDay: number
  growthRate: number
  topVideos: Array<{
    title: string
    views: number
    ctr: number
    viralScore: number
  }>
}

interface ChannelAnalysis {
  channel: ChannelMetrics
  trends: {
    last48h: TrendAnalysis
    last7d: TrendAnalysis
    last30d: TrendAnalysis
  }
  recommendations: string[]
  healthScore: number
}

async function getChannelMetrics(channelId: string): Promise<ChannelMetrics | null> {
  const { data: channel } = await supabase
    .from('youtube_channels')
    .select('id, name')
    .eq('id', channelId)
    .single()

  if (!channel) return null

  const { data: analytics } = await supabase
    .from('youtube_video_analytics')
    .select('views, watch_time_minutes, impressions, ctr, viral_score, video_id, recorded_at')
    .eq('channel_id', channelId)

  if (!analytics || analytics.length === 0) {
    return {
      channelId,
      channelName: channel.name || 'Unknown',
      totalViews: 0,
      totalWatchTimeMinutes: 0,
      totalImpressions: 0,
      averageCTR: 0,
      videoCount: 0,
      viralScoreAvg: 0,
    }
  }

  const uniqueVideos = new Set(analytics.map(a => a.video_id)).size
  const totalViews = analytics.reduce((sum, a) => sum + (a.views ?? 0), 0)
  const totalWatchTimeMinutes = analytics.reduce((sum, a) => sum + (a.watch_time_minutes ?? 0), 0)
  const totalImpressions = analytics.reduce((sum, a) => sum + (a.impressions ?? 0), 0)
  const averageCTR = analytics.length > 0
    ? analytics.reduce((sum, a) => sum + (a.ctr ?? 0), 0) / analytics.length
    : 0
  const viralScoreAvg = analytics.length > 0
    ? analytics.reduce((sum, a) => sum + (a.viral_score ?? 0), 0) / analytics.length
    : 0

  return {
    channelId,
    channelName: channel.name || 'Unknown',
    totalViews,
    totalWatchTimeMinutes,
    totalImpressions,
    averageCTR,
    videoCount: uniqueVideos,
    viralScoreAvg: Math.round(viralScoreAvg),
  }
}

async function getTrendAnalysis(
  channelId: string,
  periodHours: number,
  periodLabel: '48h' | '7d' | '30d'
): Promise<TrendAnalysis> {
  const since = new Date(Date.now() - periodHours * 60 * 60 * 1000).toISOString()

  const { data: analytics } = await supabase
    .from('youtube_video_analytics')
    .select('views, ctr, viral_score, video_id, recorded_at')
    .eq('channel_id', channelId)
    .gte('recorded_at', since)
    .order('recorded_at', { ascending: false })

  if (!analytics || analytics.length === 0) {
    return {
      period: periodLabel,
      viewsPerDay: 0,
      growthRate: 0,
      topVideos: [],
    }
  }

  const totalViews = analytics.reduce((sum, a) => sum + (a.views ?? 0), 0)
  const days = Math.max(periodHours / 24, 1)
  const viewsPerDay = Math.round(totalViews / days)

  const videoGrouped: Record<
    string,
    { views: number; ctr: number; viralScore: number; title?: string }
  > = {}
  analytics.forEach(a => {
    if (!videoGrouped[a.video_id]) {
      videoGrouped[a.video_id] = { views: 0, ctr: 0, viralScore: 0 }
    }
    videoGrouped[a.video_id].views += a.views ?? 0
    videoGrouped[a.video_id].ctr = a.ctr ?? videoGrouped[a.video_id].ctr
    videoGrouped[a.video_id].viralScore = Math.max(
      a.viral_score ?? 0,
      videoGrouped[a.video_id].viralScore
    )
  })

  const topVideos = Object.entries(videoGrouped)
    .sort((a, b) => b[1].views - a[1].views)
    .slice(0, 5)
    .map(([videoId, data]) => ({
      title: `Video ${videoId.slice(0, 8)}`,
      views: data.views,
      ctr: Math.round(data.ctr * 10000) / 100,
      viralScore: data.viralScore,
    }))

  const firstDayViews = analytics
    .filter(a => new Date(a.recorded_at).getTime() > Date.now() - 24 * 60 * 60 * 1000)
    .reduce((sum, a) => sum + (a.views ?? 0), 0)

  const lastDayViews = analytics
    .filter(
      a =>
        new Date(a.recorded_at).getTime() >
          Date.now() - periodHours * 60 * 60 * 1000 &&
        new Date(a.recorded_at).getTime() < Date.now() - (periodHours - 24) * 60 * 60 * 1000
    )
    .reduce((sum, a) => sum + (a.views ?? 0), 0)

  const growthRate =
    lastDayViews > 0 ? Math.round(((firstDayViews - lastDayViews) / lastDayViews) * 100) : 0

  return {
    period: periodLabel,
    viewsPerDay,
    growthRate,
    topVideos,
  }
}

function generateRecommendations(analysis: ChannelMetrics, trends: TrendAnalysis[]): string[] {
  const recommendations: string[] = []

  if (analysis.viralScoreAvg < 30) {
    recommendations.push('🎯 Content verbetering nodig: gemiddelde viral score is laag')
  }

  if (analysis.averageCTR < 0.03) {
    recommendations.push('📸 Thumbnails/titels optimaliseren: CTR is onder 3%')
  }

  const last48h = trends[0]
  if (last48h.growthRate > 50) {
    recommendations.push('🚀 Momentum! Channel groeit >50% in laatste 48 uur')
  }

  if (last48h.viewsPerDay < 100 && analysis.videoCount > 5) {
    recommendations.push('📊 Video output reviewen: laag engagement ondanks veel content')
  }

  if (analysis.viralScoreAvg > 70) {
    recommendations.push('✨ Content strategie werkt! Blijf deze richting volgen')
  }

  if (analysis.totalWatchTimeMinutes > 1000) {
    recommendations.push('⏱️ Goede watch time! Kijkers kijken jouw videos volledig')
  }

  return recommendations
}

function calculateHealthScore(
  metrics: ChannelMetrics,
  trends: TrendAnalysis[]
): number {
  let score = 50

  // Views impact
  if (metrics.totalViews > 10000) score += 15
  else if (metrics.totalViews > 1000) score += 10
  else if (metrics.totalViews > 100) score += 5

  // Engagement
  if (metrics.averageCTR > 0.05) score += 15
  else if (metrics.averageCTR > 0.03) score += 10
  else if (metrics.averageCTR > 0.01) score += 5

  // Content quality
  if (metrics.viralScoreAvg > 70) score += 15
  else if (metrics.viralScoreAvg > 50) score += 10
  else if (metrics.viralScoreAvg > 30) score += 5

  // Growth momentum
  const last48h = trends[0]
  if (last48h.growthRate > 100) score += 10
  else if (last48h.growthRate > 50) score += 8
  else if (last48h.growthRate > 0) score += 5

  return Math.min(score, 100)
}

async function analyzeAllChannels(): Promise<void> {
  console.log(`[youtube-analyst] Starting channel analysis — ${new Date().toISOString()}`)

  const { data: channels } = await supabase
    .from('youtube_channels')
    .select('id, name')
    .limit(50)

  if (!channels || channels.length === 0) {
    console.log('[youtube-analyst] No channels found')
    return
  }

  const analyses: ChannelAnalysis[] = []

  for (const channel of channels) {
    const metrics = await getChannelMetrics(channel.id)
    if (!metrics) continue

    const trends = await Promise.all([
      getTrendAnalysis(channel.id, 48, '48h'),
      getTrendAnalysis(channel.id, 7 * 24, '7d'),
      getTrendAnalysis(channel.id, 30 * 24, '30d'),
    ])

    const recommendations = generateRecommendations(metrics, trends)
    const healthScore = calculateHealthScore(metrics, trends)

    analyses.push({
      channel: metrics,
      trends: {
        last48h: trends[0],
        last7d: trends[1],
        last30d: trends[2],
      },
      recommendations,
      healthScore,
    })
  }

  console.log(`\n${'='.repeat(80)}`)
  console.log('📊 YOUTUBE CHANNEL ANALYST REPORT')
  console.log(`${'='.repeat(80)}\n`)

  for (const analysis of analyses) {
    console.log(`📺 ${analysis.channel.channelName}`)
    console.log(`   Health Score: ${analysis.healthScore}/100`)
    console.log(`   Videos: ${analysis.channel.videoCount} | Views: ${analysis.channel.totalViews.toLocaleString()}`)
    console.log(`   Watch Time: ${Math.round(analysis.channel.totalWatchTimeMinutes).toLocaleString()}m | Avg CTR: ${(analysis.channel.averageCTR * 100).toFixed(2)}%`)

    console.log(`\n   📈 48h Trend:`)
    console.log(`      Views/day: ${analysis.trends.last48h.viewsPerDay.toLocaleString()} | Growth: ${analysis.trends.last48h.growthRate > 0 ? '+' : ''}${analysis.trends.last48h.growthRate}%`)
    if (analysis.trends.last48h.topVideos.length > 0) {
      console.log(`      Top video: ${analysis.trends.last48h.topVideos[0].views} views (${analysis.trends.last48h.topVideos[0].ctr}% CTR)`)
    }

    if (analysis.recommendations.length > 0) {
      console.log(`\n   💡 Recommendations:`)
      analysis.recommendations.forEach(rec => console.log(`      ${rec}`))
    }

    console.log()
  }

  console.log(`${'='.repeat(80)}\n`)

  // Store latest analysis in database
  await supabase.from('channel_analyst_reports').upsert(
    analyses.map(a => ({
      channel_id: a.channel.channelId,
      health_score: a.healthScore,
      total_views: a.channel.totalViews,
      watch_time_minutes: a.channel.totalWatchTimeMinutes,
      avg_ctr: a.channel.averageCTR,
      growth_48h: a.trends.last48h.growthRate,
      recommendations: a.recommendations,
      analyzed_at: new Date().toISOString(),
    })),
    { onConflict: 'channel_id' }
  )
}

async function main() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('[youtube-analyst] SUPABASE_URL en SUPABASE_SERVICE_ROLE_KEY zijn vereist')
    process.exit(1)
  }

  await analyzeAllChannels()
  setInterval(analyzeAllChannels, POLL_MS)
}

main().catch(err => {
  console.error('[youtube-analyst] Fatal:', err)
  process.exit(1)
})
