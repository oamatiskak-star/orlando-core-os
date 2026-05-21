-- Migration 080: Viral Prediction Engine
-- Stores ML predictions about video virality before publishing

CREATE TABLE IF NOT EXISTS public.viral_predictions (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id              uuid REFERENCES public.youtube_videos(id) ON DELETE CASCADE,
  channel_id            uuid NOT NULL REFERENCES public.youtube_channels(id) ON DELETE CASCADE,

  -- Video metadata
  title                 text NOT NULL,

  -- Prediction scores
  viral_score           integer NOT NULL CHECK (viral_score BETWEEN 0 AND 100),
  confidence            numeric(3,2) DEFAULT 0.5,
  estimated_views       integer DEFAULT 0,
  estimated_ctr         numeric(5,4) DEFAULT 0,

  -- Recommendation
  recommendation        text,

  -- Analysis details
  risks                 text[] DEFAULT ARRAY[]::text[],
  opportunities         text[] DEFAULT ARRAY[]::text[],
  trending_factors      text[] DEFAULT ARRAY[]::text[],
  seasonal_factor       numeric(4,2) DEFAULT 1.0,

  -- Metadata captured
  metadata              jsonb DEFAULT '{}'::jsonb,

  -- Timestamps
  created_at            timestamptz NOT NULL DEFAULT now(),
  actual_performance_at timestamptz,
  actual_views          integer,
  actual_ctr            numeric(5,4)
);

CREATE INDEX IF NOT EXISTS viral_pred_video_idx ON public.viral_predictions(video_id);
CREATE INDEX IF NOT EXISTS viral_pred_channel_idx ON public.viral_predictions(channel_id);
CREATE INDEX IF NOT EXISTS viral_pred_score_idx ON public.viral_predictions(viral_score DESC);
CREATE INDEX IF NOT EXISTS viral_pred_created_idx ON public.viral_predictions(created_at DESC);

-- prediction_feedback: Track accuracy of predictions over time
CREATE TABLE IF NOT EXISTS public.prediction_accuracy (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id            uuid NOT NULL REFERENCES public.youtube_channels(id) ON DELETE CASCADE,

  predicted_score       integer,
  actual_score          integer,
  prediction_error      integer,
  accuracy_percent      numeric(5,2),

  sample_size           integer DEFAULT 1,
  measured_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS accuracy_channel_idx ON public.prediction_accuracy(channel_id);
CREATE INDEX IF NOT EXISTS accuracy_measured_idx ON public.prediction_accuracy(measured_at DESC);

-- RLS
ALTER TABLE public.viral_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prediction_accuracy ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_read_predictions" ON public.viral_predictions FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth_manage_predictions" ON public.viral_predictions FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "auth_read_accuracy" ON public.prediction_accuracy FOR SELECT USING (auth.role() = 'authenticated');

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.viral_predictions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.prediction_accuracy;
