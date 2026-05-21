-- Migration 081: Comment Sentiment Analysis System
-- Analyzes YouTube comments for sentiment, topics, and actionable insights

CREATE TABLE IF NOT EXISTS public.comment_sentiment_analysis (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id              uuid NOT NULL REFERENCES public.youtube_videos(id) ON DELETE CASCADE,
  channel_id            uuid GENERATED ALWAYS AS (
    (SELECT channel_id FROM public.youtube_videos WHERE id = video_id)
  ) STORED,

  -- Comment statistics
  total_comments        integer DEFAULT 0,
  positive_count        integer DEFAULT 0,
  neutral_count         integer DEFAULT 0,
  negative_count        integer DEFAULT 0,

  -- Sentiment metrics
  average_sentiment     numeric(3,2) DEFAULT 0,  -- -1 to 1

  -- Extracted insights
  top_topics            text[] DEFAULT ARRAY[]::text[],
  common_questions      text[] DEFAULT ARRAY[]::text[],
  critical_feedback     text[] DEFAULT ARRAY[]::text[],

  -- AI recommendations
  recommendations       text[] DEFAULT ARRAY[]::text[],

  -- Timestamps
  analyzed_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sentiment_video_idx ON public.comment_sentiment_analysis(video_id);
CREATE INDEX IF NOT EXISTS sentiment_channel_idx ON public.comment_sentiment_analysis(channel_id);
CREATE INDEX IF NOT EXISTS sentiment_analyzed_idx ON public.comment_sentiment_analysis(analyzed_at DESC);

-- Channel-level sentiment summary
CREATE TABLE IF NOT EXISTS public.channel_sentiment_summary (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id            uuid NOT NULL UNIQUE REFERENCES public.youtube_channels(id) ON DELETE CASCADE,

  -- Overall metrics
  average_sentiment     numeric(3,2) DEFAULT 0,
  total_videos_analyzed integer DEFAULT 0,

  -- Trending topics aggregated across all videos
  trending_topics       jsonb DEFAULT '{}'::jsonb,

  -- Consolidated feedback
  common_feedback       text[] DEFAULT ARRAY[]::text[],

  -- Actionable insights
  audience_sentiment    text,  -- 'very positive', 'positive', 'mixed', 'negative'
  content_quality_score integer CHECK (content_quality_score BETWEEN 0 AND 100),
  audience_engagement_level text,  -- 'high', 'medium', 'low'

  analyzed_at          timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS channel_sentiment_idx ON public.channel_sentiment_summary(channel_id);
CREATE INDEX IF NOT EXISTS channel_sentiment_updated_idx ON public.channel_sentiment_summary(updated_at DESC);

-- Sentiment alerts: Track when sentiment shifts
CREATE TABLE IF NOT EXISTS public.sentiment_alerts (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id              uuid NOT NULL REFERENCES public.youtube_videos(id) ON DELETE CASCADE,
  channel_id            uuid NOT NULL REFERENCES public.youtube_channels(id) ON DELETE CASCADE,

  alert_type            text NOT NULL CHECK (alert_type IN (
    'negative_spike',
    'positive_trend',
    'quality_concern',
    'engagement_drop',
    'topic_shift'
  )),

  description           text NOT NULL,
  severity              text NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
  action_recommended    text,

  triggered_at         timestamptz NOT NULL DEFAULT now(),
  resolved_at          timestamptz
);

CREATE INDEX IF NOT EXISTS alert_channel_idx ON public.sentiment_alerts(channel_id);
CREATE INDEX IF NOT EXISTS alert_severity_idx ON public.sentiment_alerts(severity);

-- RLS
ALTER TABLE public.comment_sentiment_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channel_sentiment_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sentiment_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_read_sentiment" ON public.comment_sentiment_analysis FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth_read_channel_sentiment" ON public.channel_sentiment_summary FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth_read_alerts" ON public.sentiment_alerts FOR SELECT USING (auth.role() = 'authenticated');

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.comment_sentiment_analysis;
ALTER PUBLICATION supabase_realtime ADD TABLE public.channel_sentiment_summary;
ALTER PUBLICATION supabase_realtime ADD TABLE public.sentiment_alerts;
