import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const channelId = searchParams.get('channelId')
    const videoId = searchParams.get('videoId')

    if (videoId) {
      // Get sentiment analysis for specific video
      const { data, error } = await supabase
        .from('comment_sentiment_analysis')
        .select('*')
        .eq('video_id', videoId)
        .order('analyzed_at', { ascending: false })
        .limit(1)
        .single()

      if (error && error.code !== 'PGRST116') throw error

      if (!data) {
        return NextResponse.json({
          message: 'No analysis available yet',
          data: null
        })
      }

      // Calculate percentages
      const total = data.positive_count + data.neutral_count + data.negative_count
      const percentages = {
        positive: total > 0 ? Math.round((data.positive_count / total) * 100) : 0,
        neutral: total > 0 ? Math.round((data.neutral_count / total) * 100) : 0,
        negative: total > 0 ? Math.round((data.negative_count / total) * 100) : 0
      }

      return NextResponse.json({
        analysis: {
          ...data,
          percentages
        },
        summary: {
          status:
            data.average_sentiment > 0.3
              ? '😊 Positive feedback'
              : data.average_sentiment < -0.3
                ? '😞 Negative concerns'
                : '😐 Mixed reactions',
          sentimentScore: Math.round(((data.average_sentiment + 1) / 2) * 100),
          totalComments: data.total_comments,
          topicCount: data.top_topics?.length || 0,
          questionsCount: data.common_questions?.length || 0
        }
      })
    }

    if (channelId) {
      // Get channel-level sentiment summary
      const { data: channelSummary, error: summaryError } = await supabase
        .from('channel_sentiment_summary')
        .select('*')
        .eq('channel_id', channelId)
        .single()

      if (summaryError && summaryError.code !== 'PGRST116') throw summaryError

      // Get recent video analyses
      const { data: recentAnalyses } = await supabase
        .from('comment_sentiment_analysis')
        .select('*, youtube_videos(title)')
        .eq('channel_id', channelId)
        .order('analyzed_at', { ascending: false })
        .limit(5)

      // Get recent alerts
      const { data: recentAlerts } = await supabase
        .from('sentiment_alerts')
        .select('*')
        .eq('channel_id', channelId)
        .eq('resolved_at', null)
        .order('triggered_at', { ascending: false })
        .limit(3)

      // Determine audience sentiment status
      let sentimentStatus = 'mixed'
      if (channelSummary?.average_sentiment > 0.3) {
        sentimentStatus = 'very_positive'
      } else if (channelSummary?.average_sentiment > 0) {
        sentimentStatus = 'positive'
      } else if (channelSummary?.average_sentiment < -0.3) {
        sentimentStatus = 'negative'
      }

      return NextResponse.json({
        summary: {
          channelId,
          averageSentiment: channelSummary?.average_sentiment || 0,
          sentimentStatus,
          sentimentEmoji:
            sentimentStatus === 'very_positive'
              ? '🎉'
              : sentimentStatus === 'positive'
                ? '😊'
                : sentimentStatus === 'negative'
                  ? '😞'
                  : '😐',
          videosAnalyzed: channelSummary?.total_videos_analyzed || 0,
          trendingTopics: Object.entries(channelSummary?.trending_topics || {})
            .sort(([, a], [, b]) => (b as number) - (a as number))
            .slice(0, 5)
            .map(([topic]) => topic),
          commonFeedback: channelSummary?.common_feedback || [],
          contentQualityScore: channelSummary?.content_quality_score || 50,
          engagementLevel: channelSummary?.audience_engagement_level || 'medium'
        },
        recentAnalyses: (recentAnalyses || []).map(a => ({
          videoTitle: (a as any).youtube_videos?.title || 'Unknown',
          sentiment: a.average_sentiment,
          totalComments: a.total_comments,
          topTopics: a.top_topics,
          analyzedAt: a.analyzed_at,
          recommendations: a.recommendations
        })),
        activeAlerts: (recentAlerts || []).map(a => ({
          type: a.alert_type,
          severity: a.severity,
          description: a.description,
          action: a.action_recommended,
          triggeredAt: a.triggered_at
        }))
      })
    }

    return NextResponse.json(
      { error: 'videoId or channelId required' },
      { status: 400 }
    )
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
