-- Migration 078: YouTube Channel Analyst Reports
-- Voegt tabel toe voor het opslaan van channel analyse reports en video analytics

-- youtube_video_analytics: tabel voor video-level analytics
CREATE TABLE IF NOT EXISTS public.youtube_video_analytics (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id              uuid NOT NULL REFERENCES public.youtube_videos(id) ON DELETE CASCADE,
  channel_id            uuid NOT NULL REFERENCES public.youtube_channels(id) ON DELETE CASCADE,
  youtube_video_id      text NOT NULL,
  recorded_at           timestamptz NOT NULL DEFAULT now(),

  -- Metrics
  views                 integer DEFAULT 0,
  likes                 integer DEFAULT 0,
  comments              integer DEFAULT 0,
  shares                integer DEFAULT 0,
  impressions           integer DEFAULT 0,
  ctr                   numeric(5,4) DEFAULT 0,

  -- Watch time
  watch_time_minutes    numeric(10,2) DEFAULT 0,
  avg_view_duration_seconds integer DEFAULT 0,
  avg_view_percentage   numeric(5,2) DEFAULT 0,

  -- Revenue & growth
  subscribers_gained    integer DEFAULT 0,
  estimated_revenue     numeric(10,2) DEFAULT 0,
  rpm                   numeric(10,2) DEFAULT 0,

  -- Scores
  viral_score           integer DEFAULT 0,
  title_performance_score integer DEFAULT 0,
  thumbnail_performance_score integer DEFAULT 0,

  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS yt_analytics_channel_idx ON public.youtube_video_analytics (channel_id);
CREATE INDEX IF NOT EXISTS yt_analytics_video_idx ON public.youtube_video_analytics (video_id);
CREATE INDEX IF NOT EXISTS yt_analytics_recorded_idx ON public.youtube_video_analytics (recorded_at DESC);
CREATE INDEX IF NOT EXISTS yt_analytics_youtube_video_idx ON public.youtube_video_analytics (youtube_video_id);

-- channel_analyst_reports: tabel voor channel-level analyse reports
CREATE TABLE IF NOT EXISTS public.channel_analyst_reports (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id            uuid NOT NULL UNIQUE REFERENCES public.youtube_channels(id) ON DELETE CASCADE,

  -- Metrics
  health_score          integer DEFAULT 50,
  total_views           integer DEFAULT 0,
  watch_time_minutes    numeric(10,2) DEFAULT 0,
  avg_ctr               numeric(5,4) DEFAULT 0,

  -- Growth
  growth_48h            integer DEFAULT 0,
  growth_7d             integer DEFAULT 0,
  growth_30d            integer DEFAULT 0,

  -- Recommendations
  recommendations       text[] DEFAULT ARRAY[]::text[],

  analyzed_at           timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS analyst_channel_idx ON public.channel_analyst_reports (channel_id);
CREATE INDEX IF NOT EXISTS analyst_health_idx ON public.channel_analyst_reports (health_score DESC);
CREATE INDEX IF NOT EXISTS analyst_analyzed_idx ON public.channel_analyst_reports (analyzed_at DESC);

-- RLS
ALTER TABLE public.youtube_video_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channel_analyst_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_read_analytics" ON public.youtube_video_analytics FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth_read_reports" ON public.channel_analyst_reports FOR SELECT USING (auth.role() = 'authenticated');

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.youtube_video_analytics;
ALTER PUBLICATION supabase_realtime ADD TABLE public.channel_analyst_reports;
