import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import axios from 'axios'

const SUPABASE_URL = process.env.SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const POLL_MS = parseInt(process.env.POLL_INTERVAL_MS ?? '3600000', 10)
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID
const MAILTRAP_API_TOKEN = process.env.MAILTRAP_API_TOKEN
const MAILTRAP_INBOX_ID = process.env.MAILTRAP_INBOX_ID

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// Business plan constants
const VIEWS_TARGET = 840000
const DAYS_GOAL = 10
const DAILY_TARGET = VIEWS_TARGET / DAYS_GOAL

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
  businessPlan?: {
    target: number
    currentViews: number
    progressPercent: number
    daysRemaining: number
    dailyVelocity: number
    onTrack: boolean
    viewsNeeded: number
  }
}

async function sendTelegram(message: string): Promise<void> {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return
  try {
    await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      chat_id: TELEGRAM_CHAT_ID,
      text: message,
      parse_mode: 'HTML',
    })
  } catch (err) {
    console.error('[youtube-analyst] Telegram error:', (err as Error).message)
  }
}

async function sendMarketingEmail(
  to: string,
  channelName: string,
  analysis: ChannelAnalysis
): Promise<void> {
  if (!MAILTRAP_API_TOKEN || !MAILTRAP_INBOX_ID) {
    console.warn('[youtube-analyst] Mailtrap not configured, skipping email')
    return
  }

  const plan = analysis.businessPlan!
  const progressEmoji = plan.onTrack ? '✅' : '⚠️'
  const statusText = plan.onTrack
    ? `ON TRACK! ${plan.progressPercent.toFixed(0)}% naar doel`
    : `ACHTER OP SCHEMA! ${plan.progressPercent.toFixed(0)}% bereikt`

  const html = `
    <html>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        <h1>🎬 YouTube Channel Analyst Report</h1>
        <h2>${channelName}</h2>

        <h3>${progressEmoji} Businessplan Status</h3>
        <div style="background: #f0f0f0; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p><strong>${statusText}</strong></p>
          <p>📊 <strong>${plan.currentViews.toLocaleString()}</strong> van ${plan.target.toLocaleString()} views</p>
          <p>🎯 Dagelijks tempo: <strong>${plan.dailyVelocity.toLocaleString()}</strong> views/dag</p>
          <p>📈 Benodigd: <strong>${plan.viewsNeeded.toLocaleString()}</strong> views in ${plan.daysRemaining} dagen</p>
          <p>🏁 Dagelijks doel: <strong>${DAILY_TARGET.toLocaleString()}</strong> views/dag</p>
        </div>

        <h3>📈 Channel Metrics (48 uur)</h3>
        <ul>
          <li>Views: <strong>${analysis.channel.totalViews.toLocaleString()}</strong></li>
          <li>Watch Time: <strong>${Math.round(analysis.channel.totalWatchTimeMinutes).toLocaleString()}m</strong></li>
          <li>CTR: <strong>${(analysis.channel.averageCTR * 100).toFixed(2)}%</strong></li>
          <li>Health Score: <strong>${analysis.healthScore}/100</strong></li>
          <li>Growth 48h: <strong>${plan.onTrack ? '✅' : '❌'} ${analysis.trends.last48h.growthRate > 0 ? '+' : ''}${analysis.trends.last48h.growthRate}%</strong></li>
        </ul>

        <h3>💡 Recommendations voor Marketing</h3>
        <ul>
          ${analysis.recommendations.map(r => `<li>${r}</li>`).join('')}
        </ul>

        <h3>🎥 Top Content (48h)</h3>
        <ol>
          ${analysis.trends.last48h.topVideos.map(v => `<li>${v.title}: ${v.views.toLocaleString()} views (${v.ctr}% CTR)</li>`).join('')}
        </ol>

        <hr style="margin: 30px 0;">
        <p style="color: #666; font-size: 12px;">
          📧 Automatisch gegenereerd door YouTube Channel Analyst • ${new Date().toLocaleString('nl-NL')}
        </p>
      </body>
    </html>
  `

  try {
    await axios.post(
      `https://sandbox.api.mailtrap.io/api/send/${MAILTRAP_INBOX_ID}`,
      {
        from: { email: 'analytics@orlando-os.local', name: 'YouTube Analyst' },
        to: [{ email: to }],
        subject: `${progressEmoji} YouTube Analyst Report: ${channelName} (${plan.progressPercent.toFixed(0)}% naar 840k)`,
        html,
      },
      {
        headers: {
          Authorization: `Bearer ${MAILTRAP_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
      }
    )
    console.log(`[youtube-analyst] Email sent to ${to}`)
  } catch (err) {
    console.error('[youtube-analyst] Email send failed:', (err as Error).message)
  }
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

function calculateBusinessPlanProgress(
  currentViews: number,
  startDate: Date
): ChannelAnalysis['businessPlan'] {
  const now = new Date()
  const elapsedDays = Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
  const daysRemaining = Math.max(DAYS_GOAL - elapsedDays, 0)
  const expectedViews = (elapsedDays / DAYS_GOAL) * VIEWS_TARGET
  const progressPercent = (currentViews / VIEWS_TARGET) * 100
  const dailyVelocity = elapsedDays > 0 ? currentViews / elapsedDays : 0
  const viewsNeeded = Math.max(VIEWS_TARGET - currentViews, 0)
  const onTrack = currentViews >= expectedViews * 0.95

  return {
    target: VIEWS_TARGET,
    currentViews,
    progressPercent,
    daysRemaining,
    dailyVelocity: Math.round(dailyVelocity),
    onTrack,
    viewsNeeded,
  }
}

function generateRecommendations(analysis: ChannelMetrics, trends: TrendAnalysis[], plan: ChannelAnalysis['businessPlan']): string[] {
  const recommendations: string[] = []

  // Business plan urgency
  if (!plan!.onTrack) {
    const deficit = plan!.target - plan!.currentViews
    const neededDaily = plan!.daysRemaining > 0 ? deficit / plan!.daysRemaining : 0
    recommendations.push(`🚨 URGENT: Need ${neededDaily.toLocaleString()} views/dag to hit 840k target`)
  }

  if (plan!.progressPercent > 75) {
    recommendations.push('🎉 EXCELLENT: On track to hit 840k! Maintain current momentum')
  }

  // Content quality
  if (analysis.viralScoreAvg < 40 && plan!.onTrack) {
    recommendations.push('📈 Viral scores low but growing—keep pushing same content strategy')
  }

  if (analysis.viralScoreAvg < 30) {
    recommendations.push('🎯 Content overhaul needed: viral score critically low')
  }

  // CTR optimization
  if (analysis.averageCTR < 0.02) {
    recommendations.push('⚡ CRITICAL: Thumbnail/title overhaul required—CTR extremely low')
  } else if (analysis.averageCTR < 0.05) {
    recommendations.push('📸 A/B test thumbnails: 5%+ CTR is achievable')
  }

  // Growth velocity
  const last48h = trends[0]
  if (last48h.growthRate > 100) {
    recommendations.push('🚀 VIRAL MOMENTUM! Channel doubling growth—capitalize immediately')
  } else if (last48h.growthRate < 0 && plan!.onTrack) {
    recommendations.push('⚠️ Growth dipped in 48h—analyze recent videos for patterns')
  }

  // Content diversity
  if (analysis.videoCount < 5) {
    recommendations.push('📺 Increase upload frequency: need more videos to hit targets')
  }

  // Watch time health
  if (analysis.totalWatchTimeMinutes > 500) {
    recommendations.push('⏱️ Strong watch time—viewers are engaged, leverage for growth')
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
    .select('id, name, created_at')
    .limit(50)

  if (!channels || channels.length === 0) {
    console.log('[youtube-analyst] No channels found')
    return
  }

  // Get marketing specialist contacts
  const { data: marketingTeam } = await supabase
    .from('team_members')
    .select('email')
    .eq('role', 'marketing_specialist')

  const analyses: ChannelAnalysis[] = []

  for (const channel of channels) {
    const metrics = await getChannelMetrics(channel.id)
    if (!metrics) continue

    const trends = await Promise.all([
      getTrendAnalysis(channel.id, 48, '48h'),
      getTrendAnalysis(channel.id, 7 * 24, '7d'),
      getTrendAnalysis(channel.id, 30 * 24, '30d'),
    ])

    const businessPlan = calculateBusinessPlanProgress(
      metrics.totalViews,
      new Date(channel.created_at)
    )

    const recommendations = generateRecommendations(metrics, trends, businessPlan)
    const healthScore = calculateHealthScore(metrics, trends)

    const analysis: ChannelAnalysis = {
      channel: metrics,
      trends: {
        last48h: trends[0],
        last7d: trends[1],
        last30d: trends[2],
      },
      recommendations,
      healthScore,
      businessPlan,
    }

    analyses.push(analysis)

    if (businessPlan) {
      // Send email to marketing team if critical thresholds hit
      if (marketingTeam && marketingTeam.length > 0) {
        for (const member of marketingTeam) {
          // Send if behind schedule OR if viral momentum detected
          if (!businessPlan.onTrack || trends[0].growthRate > 75) {
            await sendMarketingEmail(member.email, channel.name, analysis)
          }
        }
      }

      // Send Telegram alert if behind schedule
      if (!businessPlan.onTrack) {
        await sendTelegram(
          `⚠️ <b>YouTube Channel Behind Schedule</b>\n\n` +
          `<b>${channel.name}</b>\n` +
          `📊 ${businessPlan.currentViews.toLocaleString()} / ${businessPlan.target.toLocaleString()} views\n` +
          `📈 Progress: ${businessPlan.progressPercent.toFixed(1)}%\n` +
          `🎯 Need: ${(businessPlan.viewsNeeded / Math.max(businessPlan.daysRemaining, 1)).toLocaleString()}/day`
        )
      }
    }
  }

  console.log(`\n${'='.repeat(80)}`)
  console.log('📊 YOUTUBE CHANNEL ANALYST REPORT — 840K BUSINESS PLAN')
  console.log(`${'='.repeat(80)}\n`)

  for (const analysis of analyses) {
    const plan = analysis.businessPlan!
    const statusEmoji = plan.onTrack ? '✅' : '🚨'
    console.log(`${statusEmoji} ${analysis.channel.channelName}`)
    console.log(`   📊 Progress: ${plan.progressPercent.toFixed(1)}% (${plan.currentViews.toLocaleString()} / ${plan.target.toLocaleString()})`)
    console.log(`   🎯 Daily Pace: ${plan.dailyVelocity.toLocaleString()} views/day (need ${DAILY_TARGET.toLocaleString()})`)
    console.log(`   ⏱️  Days Remaining: ${plan.daysRemaining} | Views Needed: ${plan.viewsNeeded.toLocaleString()}`)
    console.log(`   💪 Health: ${analysis.healthScore}/100 | 48h Growth: ${analysis.trends.last48h.growthRate > 0 ? '+' : ''}${analysis.trends.last48h.growthRate}%`)

    if (analysis.recommendations.length > 0) {
      console.log(`   💡 Actions:`)
      analysis.recommendations.slice(0, 3).forEach(rec => console.log(`      ${rec}`))
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
      growth_7d: a.trends.last7d.growthRate,
      growth_30d: a.trends.last30d.growthRate,
      recommendations: a.recommendations,
      views_target: a.businessPlan?.target,
      views_progress_percent: a.businessPlan?.progressPercent,
      views_needed: a.businessPlan?.viewsNeeded,
      on_track: a.businessPlan?.onTrack,
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
