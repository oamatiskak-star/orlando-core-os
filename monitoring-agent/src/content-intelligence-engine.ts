import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface ContentAnalysis {
  channelId: string
  totalViews: number
  avgCTR: number
  avgViralScore: number
  recommendations: Array<{
    type: string
    priority: number
    confidence: number
    title: string
    description: string
    actionItems: string[]
    estimatedImpact: number
  }>
}

async function analyzePerformancePatterns(channelId: string): Promise<ContentAnalysis> {
  const { data: analytics } = await supabase
    .from('youtube_video_analytics')
    .select('*')
    .eq('channel_id', channelId)
    .gte('recorded_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())

  if (!analytics || analytics.length === 0) {
    return { channelId, totalViews: 0, avgCTR: 0, avgViralScore: 0, recommendations: [] }
  }

  const totalViews = analytics.reduce((sum, a) => sum + (a.views ?? 0), 0)
  const avgCTR = analytics.length > 0
    ? analytics.reduce((sum, a) => sum + (a.ctr ?? 0), 0) / analytics.length
    : 0
  const avgViralScore = analytics.length > 0
    ? analytics.reduce((sum, a) => sum + (a.viral_score ?? 0), 0) / analytics.length
    : 0

  const recommendations: ContentAnalysis['recommendations'] = []

  // Recommendation 1: Title optimization
  if (avgCTR < 0.04) {
    recommendations.push({
      type: 'title_optimization',
      priority: 85,
      confidence: 0.85,
      title: 'A/B Test Title Variations',
      description: 'Current CTR is below 4%. A/B testing can improve CTR by 15-30%',
      actionItems: [
        'Create 5 alternative titles emphasizing curiosity gap',
        'Focus on power words: "revealed", "shocking", "never seen"',
        'Test with different emoji combinations'
      ],
      estimatedImpact: Math.round(totalViews * 0.2) // 20% view increase potential
    })
  }

  // Recommendation 2: Thumbnail optimization
  if (avgCTR < 0.05) {
    const topVideos = analytics
      .sort((a, b) => (b.views ?? 0) - (a.views ?? 0))
      .slice(0, 3)

    recommendations.push({
      type: 'thumbnail_ab_test',
      priority: 80,
      confidence: 0.8,
      title: 'Thumbnail A/B Testing Campaign',
      description: 'Thumbnails account for 90% of CTR. High-contrast designs perform 25% better',
      actionItems: [
        'Redesign thumbnails with high-contrast colors',
        'Add emotional faces or bold text overlays',
        'Test minimal vs. busy designs',
        `Start with top 3 videos: ${topVideos.length} videos`
      ],
      estimatedImpact: Math.round(totalViews * 0.25)
    })
  }

  // Recommendation 3: Content timing
  recommendations.push({
    type: 'content_timing',
    priority: 70,
    confidence: 0.75,
    title: 'Optimize Upload Schedule',
    description: 'Uploading at peak audience times increases initial velocity by 40%+',
    actionItems: [
      'Analyze audience timezone distribution',
      'Test uploads Tuesday-Thursday 10am-2pm in primary timezone',
      'Monitor first 24h performance patterns',
      'Scale to 2x weekly uploads if performing'
    ],
    estimatedImpact: Math.round(totalViews * 0.4)
  })

  // Recommendation 4: Viral score improvement
  if (avgViralScore < 50) {
    recommendations.push({
      type: 'niche_pivot',
      priority: 75,
      confidence: 0.7,
      title: 'Content Niche Optimization',
      description: 'Current viral scores suggest content may be too broad. Narrow niche = higher engagement',
      actionItems: [
        'Analyze top 5 performing videos for common themes',
        'Identify underserved niche within category',
        'Create 5-video series focused on that niche',
        'Target long-tail keywords with lower competition'
      ],
      estimatedImpact: Math.round(totalViews * 0.5)
    })
  }

  // Recommendation 5: Upload burst for viral growth
  const last7d = analytics.filter(a =>
    new Date(a.recorded_at).getTime() > Date.now() - 7 * 24 * 60 * 60 * 1000
  )

  if (last7d.length < 3 && avgViralScore > 50) {
    recommendations.push({
      type: 'upload_burst',
      priority: 90,
      confidence: 0.85,
      title: 'Rapid Upload Burst Strategy',
      description: 'Your content is performing well. 3-5 uploads/week can compound growth exponentially',
      actionItems: [
        'Plan 5 videos to upload over next 10 days',
        'Stagger uploads every 48 hours',
        'Pre-produce to maintain quality',
        'Cross-promote between videos'
      ],
      estimatedImpact: Math.round(totalViews * 2) // 2x multiplier
    })
  }

  return {
    channelId,
    totalViews,
    avgCTR,
    avgViralScore: Math.round(avgViralScore),
    recommendations: recommendations.sort((a, b) => b.priority - a.priority)
  }
}

async function calculateOptimalSchedule(channelId: string): Promise<void> {
  const { data: analytics } = await supabase
    .from('youtube_video_analytics')
    .select('recorded_at, views, ctr')
    .eq('channel_id', channelId)
    .gte('recorded_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())

  if (!analytics || analytics.length === 0) return

  // Group by day of week and hour
  const schedule: Record<string, { views: number; ctr: number; count: number }> = {}

  for (const record of analytics) {
    const date = new Date(record.recorded_at)
    const dayOfWeek = date.getUTCDay()
    const hour = date.getUTCHours()
    const key = `${dayOfWeek}-${hour}`

    if (!schedule[key]) {
      schedule[key] = { views: 0, ctr: 0, count: 0 }
    }

    schedule[key].views += record.views ?? 0
    schedule[key].ctr += record.ctr ?? 0
    schedule[key].count += 1
  }

  // Calculate optimal scores and upsert
  const schedules = Object.entries(schedule).map(([key, data]) => {
    const [dayOfWeek, hour] = key.split('-').map(Number)
    const avgViews = data.views / data.count
    const avgCTR = data.ctr / data.count
    const maxViews = Math.max(...Object.values(schedule).map(s => s.views / s.count))

    // Score: weighted average of normalized views and CTR
    const viewScore = (avgViews / maxViews) * 0.6
    const ctrScore = (avgCTR / 0.05) * 0.4 // normalize against 5% CTR target
    const optimalScore = Math.min((viewScore + ctrScore) / 2, 1)

    return {
      channel_id: channelId,
      day_of_week: dayOfWeek,
      hour_utc: hour,
      optimal_score: optimalScore,
      audience_size_expected: Math.round(avgViews),
      ctr_projection: avgCTR,
      viral_probability: avgCTR > 0.05 ? 75 : 50,
      competitor_conflicts: 0
    }
  })

  await supabase
    .from('marketing_schedule')
    .upsert(schedules, { onConflict: 'channel_id,day_of_week,hour_utc' })
}

async function generateABTestRecommendations(channelId: string): Promise<void> {
  const { data: videos } = await supabase
    .from('youtube_videos')
    .select('id, title, description')
    .eq('channel_id', channelId)
    .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
    .limit(5)

  if (!videos || videos.length === 0) return

  for (const video of videos) {
    // Check if already has active test
    const { data: existing } = await supabase
      .from('ab_test_variants')
      .select('id')
      .eq('video_id', video.id)
      .eq('status', 'active')

    if (existing && existing.length > 0) continue

    // Generate title variants
    const titleVariants = generateTitleVariants(video.title)

    await supabase
      .from('ab_test_variants')
      .insert({
        video_id: video.id,
        variant_type: 'title',
        variant_a_value: video.title,
        variant_b_value: titleVariants[0],
        status: 'active'
      })
  }
}

function generateTitleVariants(original: string): string[] {
  const powerWords = ['REVEALED', 'SHOCKING', 'EXCLUSIVE', 'MUST WATCH', 'YOU WON\'T BELIEVE']
  const variant1 = `${powerWords[Math.floor(Math.random() * powerWords.length)]}: ${original.slice(0, 40)}`
  const variant2 = `${original} [VIRAL]`

  return [variant1, variant2]
}

async function identifyContentGaps(channelId: string): Promise<void> {
  const { data: yourVideos } = await supabase
    .from('youtube_videos')
    .select('description')
    .eq('channel_id', channelId)

  if (!yourVideos) return

  // Simplified gap analysis
  const yourTopics = new Set(
    yourVideos
      .flatMap(v => (v.description || '').split(' '))
      .filter(w => w.length > 5)
  )

  // In production, compare with competitor analysis
  // For now, flag low-hanging fruit topics
  const commonGaps = [
    { topic: 'tutorial', opportunity: 50000 },
    { topic: 'shorts', opportunity: 75000 },
    { topic: 'challenge', opportunity: 100000 }
  ]

  for (const gap of commonGaps) {
    if (!yourTopics.has(gap.topic)) {
      await supabase
        .from('content_gap_analysis')
        .insert({
          channel_id: channelId,
          gap_category: gap.topic,
          opportunity_score: 0.7,
          estimated_views_opportunity: gap.opportunity,
          recommended_format: 'short-form',
          suggested_topics: [gap.topic, `${gap.topic} guide`, `best ${gap.topic}`],
          status: 'open'
        })
    }
  }
}

async function computeRevenuePerContentType(channelId: string): Promise<void> {
  const { data: analytics } = await supabase
    .from('youtube_video_analytics')
    .select('*')
    .eq('channel_id', channelId)
    .gte('recorded_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())

  if (!analytics || analytics.length === 0) return

  // Simplified: group by video duration categories
  const categories = {
    'shorts': analytics.filter(a => (a.watch_time_minutes ?? 0) < 1),
    'medium': analytics.filter(a => (a.watch_time_minutes ?? 0) >= 1 && (a.watch_time_minutes ?? 0) < 10),
    'long-form': analytics.filter(a => (a.watch_time_minutes ?? 0) >= 10)
  }

  for (const [type, records] of Object.entries(categories)) {
    if (records.length === 0) continue

    const totalRevenue = records.reduce((sum, r) => sum + (r.estimated_revenue ?? 0), 0)
    const totalWatchTime = records.reduce((sum, r) => sum + (r.watch_time_minutes ?? 0), 0)
    const avgViews = records.reduce((sum, r) => sum + (r.views ?? 0), 0) / records.length

    const cpm = totalWatchTime > 0 ? (totalRevenue / (totalWatchTime / 1000)) : 0
    const rpm = totalWatchTime > 0 ? (totalRevenue / (totalWatchTime / 1000)) * 1000 : 0

    await supabase
      .from('revenue_per_content_type')
      .insert({
        channel_id: channelId,
        content_type: type,
        cpm: Math.round(cpm * 100) / 100,
        rpm: Math.round(rpm * 100) / 100,
        avg_views: Math.round(avgViews),
        avg_watch_time_minutes: Math.round(totalWatchTime / records.length * 100) / 100,
        total_revenue: Math.round(totalRevenue * 100) / 100,
        video_count: records.length,
        period_start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        period_end: new Date().toISOString()
      })
  }
}

export async function runContentIntelligenceEngine(): Promise<void> {
  console.log('[intelligence-engine] Starting content analysis...')

  const { data: channels } = await supabase
    .from('youtube_channels')
    .select('id')

  if (!channels) return

  for (const channel of channels) {
    try {
      const analysis = await analyzePerformancePatterns(channel.id)

      // Store recommendations
      for (const rec of analysis.recommendations) {
        await supabase
          .from('marketing_recommendations')
          .insert({
            channel_id: channel.id,
            recommendation_type: rec.type,
            priority: rec.priority,
            ai_confidence: rec.confidence,
            title: rec.title,
            description: rec.description,
            action_items: rec.actionItems,
            estimated_impact_views: rec.estimatedImpact,
            status: 'pending'
          })
      }

      // Generate schedules
      await calculateOptimalSchedule(channel.id)

      // Generate A/B tests
      await generateABTestRecommendations(channel.id)

      // Identify gaps
      await identifyContentGaps(channel.id)

      // Compute revenue
      await computeRevenuePerContentType(channel.id)

      console.log(`[intelligence-engine] ✅ Analysis complete for ${channel.id}`)
    } catch (err) {
      console.error(`[intelligence-engine] Error for ${channel.id}:`, err)
    }
  }

  console.log('[intelligence-engine] Analysis complete')
}
