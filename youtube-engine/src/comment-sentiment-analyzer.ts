import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface CommentAnalysis {
  sentiment: 'positive' | 'negative' | 'neutral'
  score: number // -1 to 1
  topics: string[]
  isQuestion: boolean
  isCritical: boolean
}

interface SentimentReport {
  videoId: string
  totalComments: number
  sentimentBreakdown: {
    positive: number
    neutral: number
    negative: number
  }
  averageSentiment: number
  topTopics: string[]
  commonQuestions: string[]
  criticalFeedback: string[]
  recommendations: string[]
  engagement: {
    totalLikes: number
    avgLikesPerComment: number
    responseRate: number
  }
}

// Simple sentiment analysis (in production, use Cloud Natural Language API)
function analyzeSentiment(text: string): CommentAnalysis {
  const lowerText = text.toLowerCase()

  // Positive indicators
  const positiveWords = [
    'great',
    'awesome',
    'love',
    'excellent',
    'amazing',
    'best',
    'incredible',
    'fantastic',
    'brilliant',
    'thank',
    'thanks',
    'helpful',
    'useful',
    'good',
    'nice',
    'cool'
  ]

  // Negative indicators
  const negativeWords = [
    'bad',
    'terrible',
    'awful',
    'hate',
    'worst',
    'stupid',
    'boring',
    'waste',
    'disappointing',
    'useless',
    'trash',
    'trash',
    'fail',
    'wrong',
    'poor'
  ]

  // Question indicators
  const isQuestion = text.includes('?') || /^(how|what|why|when|where|is|can|could|would)/i.test(
    text.trim()
  )

  // Critical feedback patterns
  const isCritical =
    /^(but|however|actually|i disagree|wrong|incorrect|false)/i.test(text.trim()) ||
    text.match(/[!]{2,}/g) !== null

  // Count sentiment words
  const positiveCount = positiveWords.filter(word => lowerText.includes(word)).length
  const negativeCount = negativeWords.filter(word => lowerText.includes(word)).length

  // Calculate sentiment score
  let score = (positiveCount - negativeCount) / Math.max(text.split(/\s+/).length / 5, 1)
  score = Math.max(-1, Math.min(1, score))

  const sentiment =
    score > 0.2 ? 'positive' : score < -0.2 ? 'negative' : 'neutral'

  // Extract topics (simplified)
  const topics: string[] = []
  const topicPatterns = [
    { pattern: /tutorial|guide|how.?to|step/i, topic: 'educational' },
    { pattern: /quality|production|visual|audio|editing/, topic: 'quality' },
    { pattern: /engaging|boring|entertaining|fun|interesting/, topic: 'engagement' },
    { pattern: /length|long|short|pace|pacing/, topic: 'duration' },
    { pattern: /topic|subject|content/, topic: 'topic' },
    { pattern: /thumbnail|title|description/, topic: 'metadata' },
    { pattern: /music|soundtrack|sound/, topic: 'audio' },
    { pattern: /update|new|feature|version/, topic: 'novelty' }
  ]

  topicPatterns.forEach(({ pattern, topic }) => {
    if (pattern.test(text)) topics.push(topic)
  })

  return {
    sentiment,
    score,
    topics,
    isQuestion,
    isCritical
  }
}

async function analyzeVideoComments(videoId: string): Promise<SentimentReport> {
  // In production, fetch from YouTube Data API
  // For now, use mock data
  const mockComments = [
    'This is amazing! Exactly what I needed.',
    'Great tutorial, very helpful!',
    'Could you explain this part more? I didnt understand it.',
    'Boring content, waste of time.',
    'Excellent quality! Keep it up.',
    'How did you do that transition?',
    'The thumbnail is misleading.',
    'Best video Ive seen on this topic!',
    'Poor audio quality, hard to hear.',
    'This is exactly what I was looking for, thanks!'
  ]

  const comments = mockComments // Replace with actual YouTube API call

  const analyses = comments.map(comment => analyzeSentiment(comment))

  const sentimentBreakdown = {
    positive: analyses.filter(a => a.sentiment === 'positive').length,
    neutral: analyses.filter(a => a.sentiment === 'neutral').length,
    negative: analyses.filter(a => a.sentiment === 'negative').length
  }

  const averageSentiment =
    analyses.reduce((sum, a) => sum + a.score, 0) / analyses.length

  // Extract topics
  const allTopics = analyses.flatMap(a => a.topics)
  const topTopics = Object.entries(
    allTopics.reduce(
      (acc, topic) => {
        acc[topic] = (acc[topic] || 0) + 1
        return acc
      },
      {} as Record<string, number>
    )
  )
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([topic]) => topic)

  // Extract questions
  const commonQuestions = comments
    .map((comment, i) => ({ comment, analysis: analyses[i] }))
    .filter(({ analysis }) => analysis.isQuestion)
    .map(({ comment }) => comment)
    .slice(0, 5)

  // Extract critical feedback
  const criticalFeedback = comments
    .map((comment, i) => ({ comment, analysis: analyses[i] }))
    .filter(({ analysis }) => analysis.isCritical && analysis.sentiment === 'negative')
    .map(({ comment }) => comment)
    .slice(0, 5)

  // Generate recommendations
  const recommendations: string[] = []

  if (sentimentBreakdown.negative > sentimentBreakdown.positive * 0.5) {
    recommendations.push('🚨 High negative sentiment - content quality or clarity issues')
  }

  if (commonQuestions.length > 0) {
    recommendations.push(
      `💬 ${commonQuestions.length} common questions - create clarification video`
    )
  }

  if (topTopics.includes('audio')) {
    recommendations.push('🔊 Audio quality concerns - improve next video production')
  }

  if (topTopics.includes('tutorial') && sentimentBreakdown.positive > sentimentBreakdown.negative) {
    recommendations.push('✅ Tutorial content resonating - create similar series')
  }

  if (sentimentBreakdown.positive > sentimentBreakdown.negative) {
    recommendations.push('🎉 Strong positive sentiment - capitalize on this momentum')
  }

  return {
    videoId,
    totalComments: comments.length,
    sentimentBreakdown,
    averageSentiment,
    topTopics,
    commonQuestions,
    criticalFeedback,
    recommendations,
    engagement: {
      totalLikes: Math.round(comments.length * 2.5),
      avgLikesPerComment: 2.5,
      responseRate: 0.15
    }
  }
}

async function storeAnalysis(report: SentimentReport): Promise<void> {
  await supabase
    .from('comment_sentiment_analysis')
    .insert({
      video_id: report.videoId,
      total_comments: report.totalComments,
      positive_count: report.sentimentBreakdown.positive,
      neutral_count: report.sentimentBreakdown.neutral,
      negative_count: report.sentimentBreakdown.negative,
      average_sentiment: report.averageSentiment,
      top_topics: report.topTopics,
      common_questions: report.commonQuestions,
      critical_feedback: report.criticalFeedback,
      recommendations: report.recommendations,
      analyzed_at: new Date().toISOString()
    })
}

async function generateInsights(channelId: string): Promise<void> {
  console.log('[sentiment] Analyzing channel comments for insights...')

  const { data: videos } = await supabase
    .from('youtube_videos')
    .select('id')
    .eq('channel_id', channelId)
    .limit(5)

  if (!videos || videos.length === 0) return

  for (const video of videos) {
    const report = await analyzeVideoComments(video.id)
    await storeAnalysis(report)

    console.log(`[sentiment] ✅ Analyzed ${video.id}: ${report.averageSentiment.toFixed(2)} sentiment`)
  }

  // Store channel-level summary
  const { data: allAnalyses } = await supabase
    .from('comment_sentiment_analysis')
    .select('*')
    .eq('channel_id', channelId)

  if (allAnalyses && allAnalyses.length > 0) {
    const channelAvgSentiment =
      allAnalyses.reduce((sum, a) => sum + a.average_sentiment, 0) / allAnalyses.length

    const allRecommendations = allAnalyses.flatMap(a => a.recommendations || [])

    await supabase
      .from('channel_sentiment_summary')
      .upsert({
        channel_id: channelId,
        average_sentiment: channelAvgSentiment,
        total_videos_analyzed: allAnalyses.length,
        trending_topics: allAnalyses
          .flatMap(a => a.top_topics)
          .reduce(
            (acc, topic) => {
              acc[topic] = (acc[topic] || 0) + 1
              return acc
            },
            {} as Record<string, number>
          ),
        common_feedback: allRecommendations,
        analyzed_at: new Date().toISOString()
      }, {
        onConflict: 'channel_id'
      })
  }
}

async function main() {
  console.log('[sentiment] Comment Sentiment Analyzer started')

  const { data: channels } = await supabase
    .from('youtube_channels')
    .select('id')

  if (!channels) return

  for (const channel of channels) {
    await generateInsights(channel.id)
  }

  // Run every 24 hours
  setInterval(async () => {
    for (const channel of channels) {
      await generateInsights(channel.id)
    }
  }, 24 * 60 * 60 * 1000)
}

if (require.main === module) {
  main().catch(console.error)
}

export { analyzeSentiment, analyzeVideoComments, generateInsights }
