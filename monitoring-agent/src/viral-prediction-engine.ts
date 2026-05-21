import { createClient } from '@supabase/supabase-js'
import axios from 'axios'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface VideoMetadata {
  title: string
  description: string
  tags: string[]
  category: string
  duration?: number
  thumbnail?: string
}

interface ViralPrediction {
  viralScore: number
  confidence: number
  recommendation: string
  risks: string[]
  opportunities: string[]
  suggestedOptimizations: {
    title?: string
    tags?: string[]
    description?: string
  }
  estimatedViews: number
  estimatedCTR: number
  trendingFactors: string[]
  seasonalFactor: number
}

// ML scoring functions (simplified - in production use TensorFlow.js or similar)
function scoreTitle(title: string): { score: number; feedback: string[] } {
  const feedback: string[] = []
  let score = 50

  // Length check
  if (title.length < 30) {
    feedback.push('⚠️ Title too short (<30 chars) - improve searchability')
  } else if (title.length > 60) {
    feedback.push('⚠️ Title too long (>60 chars) - may get truncated')
  } else {
    score += 10
  }

  // Power words detection
  const powerWords = [
    'revealed',
    'shocking',
    'exclusive',
    'must',
    'never',
    'finally',
    'secret',
    'proven',
    'truth',
    'exposed'
  ]
  const hasPowerWord = powerWords.some(word => title.toLowerCase().includes(word))
  if (hasPowerWord) {
    score += 15
  } else {
    feedback.push('💡 Add power word (revealed, shocking, exclusive, etc)')
  }

  // Number detection (videos with numbers perform better)
  if (/\d+/.test(title)) {
    score += 10
  } else {
    feedback.push('💡 Include a number in title (+10 views on average)')
  }

  // Question detection
  if (title.includes('?')) {
    score += 8
  } else {
    feedback.push('💡 Consider framing as question for engagement')
  }

  // Emoji detection
  if (/[\u{1F300}-\u{1F9FF}]/u.test(title)) {
    score += 5
  }

  return { score: Math.min(score, 100), feedback }
}

function scoreThumbnail(thumbnail?: string): { score: number; feedback: string[] } {
  const feedback: string[] = []
  let score = 50

  if (!thumbnail) {
    feedback.push('❌ No thumbnail provided')
    return { score: 20, feedback }
  }

  // In production, use computer vision API to analyze:
  // - Color contrast (high contrast = better CTR)
  // - Face presence (faces get +15% clicks)
  // - Text overlay clarity
  // - Emotional expression intensity

  // For now, basic heuristics
  score += 30 // Base score for having a thumbnail

  feedback.push('✅ Thumbnail provided')
  feedback.push('💡 Ensure high contrast colors for visibility')
  feedback.push('💡 Include face showing emotion if possible')
  feedback.push('💡 Bold text overlay for quick scanning')

  return { score, feedback }
}

function scoreDescription(description: string): { score: number; feedback: string[] } {
  const feedback: string[] = []
  let score = 50

  const wordCount = description.split(/\s+/).length

  // Length check
  if (wordCount < 50) {
    feedback.push('⚠️ Description too short - missing SEO keywords')
  } else if (wordCount > 200) {
    feedback.push('⚠️ Description too long - focus key info in first 2 lines')
  } else {
    score += 10
  }

  // Link detection (more links = more engagement opportunities)
  const linkCount = (description.match(/https?:\/\//g) || []).length
  if (linkCount > 0) {
    score += 10
    feedback.push(`✅ ${linkCount} link(s) included`)
  } else {
    feedback.push('💡 Add related links to boost engagement')
  }

  // Hashtag detection
  const hashtagCount = (description.match(/#\w+/g) || []).length
  if (hashtagCount >= 3) {
    score += 10
    feedback.push(`✅ ${hashtagCount} hashtag(s) included`)
  } else {
    feedback.push('💡 Add 3-5 relevant hashtags for discoverability')
  }

  // Call-to-action detection
  const cta = ['subscribe', 'like', 'comment', 'share', 'follow', 'watch']
  if (cta.some(word => description.toLowerCase().includes(word))) {
    score += 8
    feedback.push('✅ Clear call-to-action detected')
  } else {
    feedback.push('💡 Add explicit call-to-action (subscribe, like, comment)')
  }

  return { score: Math.min(score, 100), feedback }
}

function scoreTags(tags: string[], category: string): { score: number; feedback: string[] } {
  const feedback: string[] = []
  let score = 50

  if (tags.length === 0) {
    feedback.push('❌ No tags provided - missing reach opportunity')
    return { score: 20, feedback }
  }

  if (tags.length < 5) {
    feedback.push(`⚠️ Only ${tags.length} tags (recommend 5-10)`)
  } else if (tags.length > 15) {
    feedback.push('⚠️ Too many tags (>15) - may appear spammy')
  } else {
    score += 10
  }

  // Tag length analysis
  const avgTagLength = tags.reduce((sum, tag) => sum + tag.length, 0) / tags.length
  if (avgTagLength < 3) {
    feedback.push('⚠️ Tags too short - use longer, more specific keywords')
  } else if (avgTagLength > 20) {
    feedback.push('💡 Consider shorter, more searchable tag phrases')
  } else {
    score += 10
  }

  // High-volume tag detection (good for reach)
  const highVolumeKeywords = ['tutorial', 'gaming', 'music', 'vlog', 'shorts']
  const hasHighVolume = tags.some(tag =>
    highVolumeKeywords.some(kw => tag.toLowerCase().includes(kw))
  )
  if (hasHighVolume) {
    score += 10
    feedback.push('✅ High-volume keywords included')
  } else {
    feedback.push('💡 Include high-volume category tags for broader reach')
  }

  return { score: Math.min(score, 100), feedback }
}

function detectTrendingTopics(title: string, tags: string[]): string[] {
  const allText = (title + ' ' + tags.join(' ')).toLowerCase()

  // Simplified trending detection
  const trendingPatterns = [
    { pattern: /ai|artificial intelligence|gpt|chatbot/, trend: '🤖 AI/ML trending' },
    { pattern: /short|shorts|tiktok/, trend: '📱 Short-form content hot' },
    { pattern: /viral|trending|viral|challenge/, trend: '🚀 Challenge content trending' },
    { pattern: /tutorial|how to|guide/, trend: '📚 Educational content gaining traction' },
    { pattern: /reaction|react/, trend: '👀 Reaction content performing' },
    { pattern: /collab|collaboration|together/, trend: '🤝 Collaboration trending' },
    {
      pattern: /gaming|game|fps|minecraft|fortnite/,
      trend: '🎮 Gaming content strong'
    },
    { pattern: /music|song|beat|remix/, trend: '🎵 Music-related trending' },
    { pattern: /lifestyle|morning|routine|vlog/, trend: '📹 Lifestyle vlogging hot' }
  ]

  return trendingPatterns
    .filter(({ pattern }) => pattern.test(allText))
    .map(({ trend }) => trend)
}

function calculateSeasonalFactor(): number {
  const now = new Date()
  const month = now.getMonth()
  const hour = now.getHours()

  // Peak engagement hours (2pm-8pm)
  let timeScore = 1.0
  if (hour >= 14 && hour <= 20) {
    timeScore = 1.3
  } else if (hour >= 18 && hour <= 21) {
    timeScore = 1.5 // Prime time
  }

  // Peak days (Thursday-Sunday)
  const day = now.getDay()
  let dayScore = 1.0
  if (day >= 4 && day <= 0) {
    dayScore = 1.2
  }

  // Seasonal boost
  let seasonScore = 1.0
  if ([11, 0, 6, 7].includes(month)) {
    // Holiday seasons, summer
    seasonScore = 1.15
  }

  return timeScore * dayScore * seasonScore
}

async function getHistoricalContext(channelId: string): Promise<{
  avgViralScore: number
  topPerformingCategories: string[]
  bestUploadTimes: { day: number; hour: number }[]
}> {
  const { data: analytics } = await supabase
    .from('youtube_video_analytics')
    .select('viral_score, recorded_at')
    .eq('channel_id', channelId)
    .gte('recorded_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString())

  const avgViralScore =
    analytics && analytics.length > 0
      ? analytics.reduce((sum, a) => sum + (a.viral_score ?? 0), 0) / analytics.length
      : 50

  // In production, fetch from marketing_schedule table
  const bestUploadTimes = [
    { day: 4, hour: 14 }, // Thursday 2pm
    { day: 5, hour: 18 }, // Friday 6pm
    { day: 0, hour: 10 } // Sunday 10am
  ]

  return {
    avgViralScore,
    topPerformingCategories: ['tutorial', 'shorts', 'entertainment'],
    bestUploadTimes
  }
}

export async function predictViral(
  channelId: string,
  metadata: VideoMetadata
): Promise<ViralPrediction> {
  // Score components
  const titleScore = scoreTitle(metadata.title)
  const thumbnailScore = scoreThumbnail(metadata.thumbnail)
  const descriptionScore = scoreDescription(metadata.description)
  const tagsScore = scoreTags(metadata.tags, metadata.category)

  // Trending detection
  const trendingFactors = detectTrendingTopics(metadata.title, metadata.tags)

  // Historical context
  const context = await getHistoricalContext(channelId)

  // Combine scores (weighted)
  const weights = {
    title: 0.25,
    thumbnail: 0.30, // Thumbnails are most important
    description: 0.20,
    tags: 0.15,
    category: 0.10
  }

  const compositeScore =
    titleScore.score * weights.title +
    thumbnailScore.score * weights.thumbnail +
    descriptionScore.score * weights.description +
    tagsScore.score * weights.tags

  // Apply seasonal factor
  const seasonalFactor = calculateSeasonalFactor()
  const viralScore = Math.min(compositeScore * seasonalFactor, 100)

  // Confidence (lower confidence if too new, too short history)
  const confidence = Math.min(0.95, (context.avgViralScore + 30) / 100)

  // Estimate views based on viral score
  const baseViewEstimate = context.avgViralScore > 50 ? 10000 : 5000
  const estimatedViews = Math.round(baseViewEstimate * (viralScore / 50) * seasonalFactor)

  // Estimated CTR
  const estimatedCTR =
    (titleScore.score + thumbnailScore.score) / 200 * 0.05 + 0.01 // 1-5% CTR estimate

  // Generate recommendations
  const allFeedback = [
    ...titleScore.feedback,
    ...thumbnailScore.feedback,
    ...descriptionScore.feedback,
    ...tagsScore.feedback
  ]

  const risks: string[] = []
  const opportunities: string[] = []

  if (viralScore < 40) {
    risks.push('Low viral potential - major optimizations needed')
    risks.push('CTR likely <2% - thumbnail/title may not engage')
  } else if (viralScore < 60) {
    risks.push('Moderate potential - competitive landscape challenging')
    opportunities.push('Focus on one strength area (title or thumbnail)')
  } else {
    opportunities.push('Strong viral potential - capitalize quickly')
    if (trendingFactors.length > 0) {
      opportunities.push(`Riding ${trendingFactors.length} trending factor(s)`)
    }
  }

  if (allFeedback.filter(f => f.startsWith('❌')).length > 0) {
    risks.push('Critical gaps detected - address before upload')
  }

  const suggestedOptimizations: ViralPrediction['suggestedOptimizations'] = {}

  if (titleScore.score < 60) {
    // Suggest improved title
    const powerWord =
      ['REVEALED', 'SHOCKING', 'EXCLUSIVE', 'MUST', 'NEVER'][Math.floor(Math.random() * 5)]
    suggestedOptimizations.title = `${powerWord}: ${metadata.title.slice(0, 40)}... [Add #]`
  }

  if (tagsScore.score < 60) {
    suggestedOptimizations.tags = [
      ...metadata.tags,
      'viral',
      'trending',
      'shorts',
      metadata.category,
      'newvideo'
    ].slice(0, 10)
  }

  const recommendation =
    viralScore >= 80
      ? '🚀 PUBLISH NOW - Strong viral potential! Consider rapid follow-up.'
      : viralScore >= 60
        ? '✅ Good to publish - Make recommended optimizations first'
        : viralScore >= 40
          ? '⚠️ Needs work - Optimize before publishing'
          : '❌ Major rework needed - Address critical feedback'

  return {
    viralScore: Math.round(viralScore),
    confidence: Math.round(confidence * 100) / 100,
    recommendation,
    risks,
    opportunities,
    suggestedOptimizations,
    estimatedViews,
    estimatedCTR: Math.round(estimatedCTR * 10000) / 10000,
    trendingFactors,
    seasonalFactor: Math.round(seasonalFactor * 100) / 100
  }
}

// Analyze video content using basic text analysis (in production, use CV APIs)
export async function analyzeVideoContent(
  videoId: string,
  metadata: VideoMetadata
): Promise<{ contentScore: number; topics: string[]; sentiment: 'positive' | 'neutral' | 'negative' }> {
  // Simplified content analysis
  const text = `${metadata.title} ${metadata.description}`.toLowerCase()

  const positiveWords = [
    'amazing',
    'incredible',
    'awesome',
    'great',
    'best',
    'epic',
    'ultimate',
    'proven',
    'guaranteed'
  ]
  const negativeWords = ['bad', 'worst', 'terrible', 'avoid', 'failed', 'scam']

  const positiveCount = positiveWords.filter(w => text.includes(w)).length
  const negativeCount = negativeWords.filter(w => text.includes(w)).length

  const sentiment =
    positiveCount > negativeCount
      ? 'positive'
      : negativeCount > positiveCount
        ? 'negative'
        : 'neutral'

  // Extract topics (simplified)
  const topics = metadata.tags.slice(0, 5)

  const contentScore = 50 + positiveCount * 5 - negativeCount * 5

  return {
    contentScore: Math.min(Math.max(contentScore, 20), 100),
    topics,
    sentiment
  }
}

// Store prediction in database
export async function storePrediction(
  videoId: string,
  channelId: string,
  prediction: ViralPrediction,
  metadata: VideoMetadata
): Promise<void> {
  await supabase.from('viral_predictions').insert({
    video_id: videoId,
    channel_id: channelId,
    title: metadata.title,
    viral_score: prediction.viralScore,
    confidence: prediction.confidence,
    estimated_views: prediction.estimatedViews,
    estimated_ctr: prediction.estimatedCTR,
    recommendation: prediction.recommendation,
    risks: prediction.risks,
    opportunities: prediction.opportunities,
    trending_factors: prediction.trendingFactors,
    seasonal_factor: prediction.seasonalFactor,
    metadata: {
      title: metadata.title,
      tags: metadata.tags,
      category: metadata.category
    },
    created_at: new Date().toISOString()
  })
}
