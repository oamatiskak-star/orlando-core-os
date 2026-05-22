import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import axios from 'axios'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID
const SLACK_WEBHOOK_CRITICAL = process.env.SLACK_WEBHOOK_CRITICAL
const SLACK_WEBHOOK_MARKETING = process.env.SLACK_WEBHOOK_MARKETING

interface Recommendation {
  id: string
  channel_id: string
  recommendation_type: string
  priority: number
  ai_confidence: number
  title: string
  description: string
  action_items: string[]
  estimated_impact_views: number
  status: string
  executed_at?: string | null
  scheduled_for?: string | null
}

async function sendSlack(webhook: string | undefined, message: string, emoji: string): Promise<void> {
  if (!webhook) return

  try {
    await axios.post(webhook, {
      text: `${emoji} ${message}`,
      mrkdwn: true
    })
  } catch (err) {
    console.error('[orchestrator] Slack error:', err)
  }
}

async function sendTelegram(message: string): Promise<void> {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return

  try {
    await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      chat_id: TELEGRAM_CHAT_ID,
      text: message,
      parse_mode: 'HTML'
    })
  } catch (err) {
    console.error('[orchestrator] Telegram error:', err)
  }
}

async function prioritizeRecommendations(recommendations: Recommendation[]): Promise<Recommendation[]> {
  return recommendations.sort((a, b) => {
    // Sort by: priority (desc), confidence (desc), impact (desc)
    if (b.priority !== a.priority) return b.priority - a.priority
    if (b.ai_confidence !== a.ai_confidence) return b.ai_confidence - a.ai_confidence
    return b.estimated_impact_views - a.estimated_impact_views
  })
}

async function scheduleRecommendation(rec: Recommendation): Promise<void> {
  if (rec.recommendation_type === 'content_timing') {
    // Find best upload slot
    const { data: schedule } = await supabase
      .from('marketing_schedule')
      .select('*')
      .eq('channel_id', rec.channel_id)
      .order('optimal_score', { ascending: false })
      .limit(1)

    if (schedule && schedule.length > 0) {
      const slot = schedule[0]
      const now = new Date()
      const nextRun = new Date()
      nextRun.setUTCDate(nextRun.getUTCDate() + ((slot.day_of_week - now.getUTCDay() + 7) % 7))
      nextRun.setUTCHours(slot.hour_utc, 0, 0, 0)

      await supabase
        .from('marketing_recommendations')
        .update({
          status: 'scheduled',
          scheduled_for: nextRun.toISOString()
        })
        .eq('id', rec.id)
    }
  } else if (rec.recommendation_type === 'thumbnail_ab_test' || rec.recommendation_type === 'title_optimization') {
    // Schedule for immediate execution
    await supabase
      .from('marketing_recommendations')
      .update({
        status: 'scheduled',
        scheduled_for: new Date().toISOString()
      })
      .eq('id', rec.id)
  }
}

async function executeRecommendation(rec: Recommendation): Promise<boolean> {
  try {
    if (rec.recommendation_type === 'thumbnail_ab_test' || rec.recommendation_type === 'title_optimization') {
      // Mark as executing
      await supabase
        .from('marketing_recommendations')
        .update({ status: 'executing' })
        .eq('id', rec.id)

      // Simulate execution (in production, this would call YouTube API)
      console.log(`[orchestrator] 🎬 Executing: ${rec.title}`)

      // Mark as completed
      await supabase
        .from('marketing_recommendations')
        .update({
          status: 'completed',
          executed_at: new Date().toISOString()
        })
        .eq('id', rec.id)

      return true
    }

    return true
  } catch (err) {
    console.error('[orchestrator] Execution error:', err)
    await supabase
      .from('marketing_recommendations')
      .update({ status: 'failed' })
      .eq('id', rec.id)

    return false
  }
}

async function trackResults(rec: Recommendation): Promise<void> {
  // In production, check actual views/revenue impact after 7 days
  const { data: analytics } = await supabase
    .from('youtube_video_analytics')
    .select('views, estimated_revenue')
    .eq('channel_id', rec.channel_id)
    .gte('recorded_at', rec.executed_at)
    .limit(1)

  if (analytics && analytics.length > 0) {
    const roi = rec.estimated_impact_views > 0
      ? ((analytics[0].views - rec.estimated_impact_views) / rec.estimated_impact_views) * 100
      : 0

    await supabase
      .from('marketing_recommendations')
      .update({
        actual_impact_views: analytics[0].views,
        actual_impact_revenue: analytics[0].estimated_revenue,
        roi_percent: roi
      })
      .eq('id', rec.id)
  }
}

async function updateRealtimeKPIs(): Promise<void> {
  const { data: channels } = await supabase
    .from('youtube_channels')
    .select('id, created_at')

  if (!channels) return

  for (const channel of channels) {
    // Fetch recent analytics
    const { data: analytics } = await supabase
      .from('youtube_video_analytics')
      .select('*')
      .eq('channel_id', channel.id)

    if (!analytics || analytics.length === 0) continue

    // Calculate metrics
    const views24h = analytics
      .filter(a => new Date(a.recorded_at).getTime() > Date.now() - 24 * 60 * 60 * 1000)
      .reduce((sum, a) => sum + (a.views ?? 0), 0)

    const views7d = analytics
      .filter(a => new Date(a.recorded_at).getTime() > Date.now() - 7 * 24 * 60 * 60 * 1000)
      .reduce((sum, a) => sum + (a.views ?? 0), 0)

    const totalViews = analytics.reduce((sum, a) => sum + (a.views ?? 0), 0)
    const avgCTR = analytics.length > 0
      ? analytics.reduce((sum, a) => sum + (a.ctr ?? 0), 0) / analytics.length
      : 0

    const revenue24h = analytics
      .filter(a => new Date(a.recorded_at).getTime() > Date.now() - 24 * 60 * 60 * 1000)
      .reduce((sum, a) => sum + (a.estimated_revenue ?? 0), 0)

    const revenue7d = analytics
      .filter(a => new Date(a.recorded_at).getTime() > Date.now() - 7 * 24 * 60 * 60 * 1000)
      .reduce((sum, a) => sum + (a.estimated_revenue ?? 0), 0)

    // Business plan progress
    const daysSinceStart = Math.floor((Date.now() - new Date(channel.created_at).getTime()) / (1000 * 60 * 60 * 24))
    const goalViews = 840000
    const expectedProgress = (daysSinceStart / 10) * 100
    const actualProgress = (totalViews / goalViews) * 100
    const onTrack = actualProgress >= expectedProgress * 0.95

    // Health score
    const healthScore = Math.min(
      50 +
      (avgCTR > 0.05 ? 15 : 0) +
      (views24h > 1000 ? 15 : 0) +
      (totalViews > 100000 ? 15 : 0) +
      (onTrack ? 10 : 0),
      100
    )

    // Upsert KPIs
    await supabase
      .from('marketing_kpis_realtime')
      .upsert({
        channel_id: channel.id,
        views_24h: views24h,
        views_7d: views7d,
        growth_rate_percent: views24h > 0 && views7d > 0 ? ((views24h - views7d / 7) / (views7d / 7)) * 100 : 0,
        health_score: healthScore,
        revenue_24h: revenue24h,
        revenue_7d: revenue7d,
        avg_ctr: avgCTR,
        goal_views: goalViews,
        current_progress_percent: Math.min(actualProgress, 100),
        days_remaining: Math.max(10 - daysSinceStart, 0),
        daily_velocity_needed: Math.max((goalViews - totalViews) / Math.max(10 - daysSinceStart, 1), 0),
        on_track: onTrack,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'channel_id'
      })
  }
}

async function orchestrateRecommendations(): Promise<void> {
  console.log('[orchestrator] 🎯 Starting orchestration cycle...')

  // Fetch pending recommendations
  const { data: pending } = await supabase
    .from('marketing_recommendations')
    .select('*')
    .eq('status', 'pending')

  if (!pending || pending.length === 0) {
    console.log('[orchestrator] No pending recommendations')
    return
  }

  // Prioritize
  const prioritized = await prioritizeRecommendations(pending)

  for (const rec of prioritized.slice(0, 5)) {
    // Schedule top 5 recommendations
    await scheduleRecommendation(rec)

    // Send notification
    if (rec.ai_confidence > 0.8) {
      await sendSlack(
        SLACK_WEBHOOK_MARKETING,
        `*New High-Confidence Recommendation*\n${rec.title}\n_${rec.description}_\n_Confidence: ${(rec.ai_confidence * 100).toFixed(0)}%_`,
        '💡'
      )

      await sendTelegram(
        `💡 <b>${rec.title}</b>\n${rec.description}\n\n📈 Est. Impact: +${rec.estimated_impact_views.toLocaleString()} views`
      )
    }
  }

  // Execute scheduled high-priority items
  const { data: scheduled } = await supabase
    .from('marketing_recommendations')
    .select('*')
    .eq('status', 'scheduled')
    .gte('priority', 80)

  if (scheduled) {
    for (const rec of scheduled) {
      const success = await executeRecommendation(rec)

      if (success) {
        await sendSlack(
          SLACK_WEBHOOK_MARKETING,
          `*Recommendation Executed* ✅\n${rec.title}`,
          '🚀'
        )
      }
    }
  }

  // Update realtime KPIs
  await updateRealtimeKPIs()

  // Check for critical alerts
  const { data: kpis } = await supabase
    .from('marketing_kpis_realtime')
    .select('*')
    .eq('on_track', false)

  if (kpis && kpis.length > 0) {
    for (const kpi of kpis) {
      const { data: channel } = await supabase
        .from('youtube_channels')
        .select('name')
        .eq('id', kpi.channel_id)
        .single()

      await sendSlack(
        SLACK_WEBHOOK_CRITICAL,
        `*🚨 CRITICAL: ${channel?.name} Behind Target*\nProgress: ${kpi.current_progress_percent.toFixed(1)}%\nDaily Need: ${kpi.daily_velocity_needed.toLocaleString()} views`,
        '🚨'
      )

      await sendTelegram(
        `🚨 <b>${channel?.name} - Behind 840k Target</b>\n` +
        `Progress: ${kpi.current_progress_percent.toFixed(1)}%\n` +
        `Need: ${kpi.daily_velocity_needed.toLocaleString()}/day`
      )
    }
  }

  console.log('[orchestrator] ✅ Orchestration cycle complete')
}

async function main() {
  console.log('[orchestrator] Orlando Marketing Orchestrator started')

  // Run immediately
  await orchestrateRecommendations()

  // Run every 30 minutes
  setInterval(orchestrateRecommendations, 30 * 60 * 1000)
}

if (require.main === module) {
  main().catch(console.error)
}

export { orchestrateRecommendations }
