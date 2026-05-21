-- Migration 079: Complete Marketing Orchestration System
-- Adds tables for AI recommendations, scheduling, A/B testing, revenue tracking, and competitor analysis

-- marketing_recommendations: AI-generated actions with execution tracking
CREATE TABLE IF NOT EXISTS public.marketing_recommendations (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id                  uuid NOT NULL REFERENCES public.youtube_channels(id) ON DELETE CASCADE,
  recommendation_type         text NOT NULL
    CHECK (recommendation_type IN (
      'content_timing', 'thumbnail_ab_test', 'title_optimization',
      'upload_burst', 'niche_pivot', 'cpm_adjustment', 'format_experiment',
      'retention_improvement', 'audience_shift', 'trend_capitalize'
    )),
  priority                    integer DEFAULT 50 CHECK (priority BETWEEN 1 AND 100),
  ai_confidence              numeric(5,2) DEFAULT 0.5 CHECK (ai_confidence BETWEEN 0 AND 1),

  -- Recommendation details
  title                      text NOT NULL,
  description               text,
  action_items              text[] DEFAULT ARRAY[]::text[],

  -- Impact estimation
  estimated_impact_views    integer DEFAULT 0,
  estimated_impact_revenue  numeric(10,2) DEFAULT 0,

  -- Status lifecycle
  status                    text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'scheduled', 'executing', 'completed', 'failed', 'cancelled')),
  scheduled_for            timestamptz,
  executed_at             timestamptz,

  -- Results tracking
  actual_impact_views      integer,
  actual_impact_revenue    numeric(10,2),
  roi_percent             numeric(5,2),

  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS marketing_recs_channel_idx ON public.marketing_recommendations(channel_id);
CREATE INDEX IF NOT EXISTS marketing_recs_status_idx ON public.marketing_recommendations(status, priority DESC);
CREATE INDEX IF NOT EXISTS marketing_recs_confidence_idx ON public.marketing_recommendations(ai_confidence DESC);
CREATE INDEX IF NOT EXISTS marketing_recs_type_idx ON public.marketing_recommendations(recommendation_type);

-- marketing_schedule: optimal upload timing based on audience analysis
CREATE TABLE IF NOT EXISTS public.marketing_schedule (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id              uuid NOT NULL REFERENCES public.youtube_channels(id) ON DELETE CASCADE,

  -- Time slot
  day_of_week            smallint NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  hour_utc               smallint NOT NULL CHECK (hour_utc BETWEEN 0 AND 23),

  -- Scoring
  optimal_score          numeric(5,2) DEFAULT 0.5,
  audience_size_expected integer DEFAULT 0,
  ctr_projection         numeric(5,4) DEFAULT 0,
  viral_probability      numeric(5,2) DEFAULT 0,
  competitor_conflicts   integer DEFAULT 0,

  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),

  UNIQUE(channel_id, day_of_week, hour_utc)
);

CREATE INDEX IF NOT EXISTS marketing_schedule_channel_idx ON public.marketing_schedule(channel_id);
CREATE INDEX IF NOT EXISTS marketing_schedule_score_idx ON public.marketing_schedule(optimal_score DESC);

-- ab_test_variants: A/B test configurations for titles and thumbnails
CREATE TABLE IF NOT EXISTS public.ab_test_variants (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id            uuid NOT NULL REFERENCES public.youtube_videos(id) ON DELETE CASCADE,

  -- Test type and variants
  variant_type        text NOT NULL CHECK (variant_type IN ('title', 'thumbnail')),
  variant_a_value     text NOT NULL,
  variant_b_value     text NOT NULL,

  -- Performance metrics
  variant_a_views     integer DEFAULT 0,
  variant_a_ctr       numeric(5,4) DEFAULT 0,
  variant_a_revenue   numeric(10,2) DEFAULT 0,

  variant_b_views     integer DEFAULT 0,
  variant_b_ctr       numeric(5,4) DEFAULT 0,
  variant_b_revenue   numeric(10,2) DEFAULT 0,

  -- Results
  winner              text,
  confidence_level    numeric(5,2),

  status              text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'concluded')),
  started_at          timestamptz NOT NULL DEFAULT now(),
  concluded_at        timestamptz,

  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ab_test_video_idx ON public.ab_test_variants(video_id);
CREATE INDEX IF NOT EXISTS ab_test_status_idx ON public.ab_test_variants(status);
CREATE INDEX IF NOT EXISTS ab_test_type_idx ON public.ab_test_variants(variant_type);

-- revenue_per_content_type: CPM optimization by content category
CREATE TABLE IF NOT EXISTS public.revenue_per_content_type (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id            uuid NOT NULL REFERENCES public.youtube_channels(id) ON DELETE CASCADE,

  content_type          text NOT NULL,

  -- Metrics
  cpm                   numeric(10,2) DEFAULT 0,
  rpm                   numeric(10,2) DEFAULT 0,

  -- Aggregates
  avg_views            integer DEFAULT 0,
  avg_watch_time_minutes numeric(10,2) DEFAULT 0,
  total_revenue        numeric(14,2) DEFAULT 0,
  video_count          integer DEFAULT 0,

  -- Period
  period_start         timestamptz,
  period_end           timestamptz,

  calculated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS revenue_content_idx ON public.revenue_per_content_type(channel_id, content_type);
CREATE INDEX IF NOT EXISTS revenue_cpm_idx ON public.revenue_per_content_type(cpm DESC);

-- content_gap_analysis: identified opportunities from competitor benchmarking
CREATE TABLE IF NOT EXISTS public.content_gap_analysis (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id              uuid NOT NULL REFERENCES public.youtube_channels(id) ON DELETE CASCADE,

  gap_category            text NOT NULL,
  competitor_trend        text,
  your_performance        text,

  -- Scoring
  opportunity_score       numeric(5,2) DEFAULT 0,
  estimated_views_opportunity bigint DEFAULT 0,

  -- Recommendations
  recommended_format      text,
  suggested_topics        text[] DEFAULT ARRAY[]::text[],

  detected_at             timestamptz NOT NULL DEFAULT now(),
  status                  text DEFAULT 'open'
);

CREATE INDEX IF NOT EXISTS content_gap_channel_idx ON public.content_gap_analysis(channel_id);
CREATE INDEX IF NOT EXISTS content_gap_opportunity_idx ON public.content_gap_analysis(opportunity_score DESC);

-- marketing_kpis_realtime: aggregated metrics updated frequently
CREATE TABLE IF NOT EXISTS public.marketing_kpis_realtime (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id                uuid NOT NULL UNIQUE REFERENCES public.youtube_channels(id) ON DELETE CASCADE,

  -- Views & growth
  views_24h                integer DEFAULT 0,
  views_7d                 integer DEFAULT 0,
  growth_rate_percent      numeric(5,2) DEFAULT 0,

  -- Health & momentum
  health_score            integer DEFAULT 50,
  viral_momentum_score    numeric(5,2) DEFAULT 0,

  -- Revenue
  revenue_24h             numeric(10,2) DEFAULT 0,
  revenue_7d              numeric(10,2) DEFAULT 0,
  avg_cpm                 numeric(10,2) DEFAULT 0,

  -- Engagement
  avg_ctr                 numeric(5,4) DEFAULT 0,
  avg_watch_time_pct      numeric(5,2) DEFAULT 0,

  -- Business plan (840k views goal)
  goal_views             integer DEFAULT 840000,
  goal_days              integer DEFAULT 10,
  current_progress_percent numeric(5,2) DEFAULT 0,
  days_remaining          integer DEFAULT 10,
  daily_velocity_needed   integer DEFAULT 84000,
  on_track               boolean DEFAULT false,

  updated_at             timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS marketing_kpis_channel_idx ON public.marketing_kpis_realtime(channel_id);
CREATE INDEX IF NOT EXISTS marketing_kpis_updated_idx ON public.marketing_kpis_realtime(updated_at DESC);
CREATE INDEX IF NOT EXISTS marketing_kpis_ontrack_idx ON public.marketing_kpis_realtime(on_track);

-- RLS
ALTER TABLE public.marketing_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ab_test_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.revenue_per_content_type ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_gap_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_kpis_realtime ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_read_recommendations" ON public.marketing_recommendations FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth_manage_recommendations" ON public.marketing_recommendations FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "auth_read_schedule" ON public.marketing_schedule FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth_manage_schedule" ON public.marketing_schedule FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "auth_read_ab_tests" ON public.ab_test_variants FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth_manage_ab_tests" ON public.ab_test_variants FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "auth_read_revenue" ON public.revenue_per_content_type FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth_read_gaps" ON public.content_gap_analysis FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth_read_kpis" ON public.marketing_kpis_realtime FOR SELECT USING (auth.role() = 'authenticated');

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.marketing_recommendations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.marketing_schedule;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ab_test_variants;
ALTER PUBLICATION supabase_realtime ADD TABLE public.marketing_kpis_realtime;
