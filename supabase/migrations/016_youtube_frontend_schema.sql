-- Migration 016: YouTube frontend schema aanvulling
-- Voegt ontbrekende kolommen en tabellen toe voor de frontend YouTube Engine

-- ── youtube_channels: naam alias + quota kolommen ────────────────────────────

ALTER TABLE public.youtube_channels
  ADD COLUMN IF NOT EXISTS naam              text GENERATED ALWAYS AS (name) STORED,
  ADD COLUMN IF NOT EXISTS upload_quota_used integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS upload_quota_reset_at timestamptz;

-- ── youtube_videos: ontbrekende kolommen ──────────────────────────────────────

ALTER TABLE public.youtube_videos
  ADD COLUMN IF NOT EXISTS status               text DEFAULT 'queued',
  ADD COLUMN IF NOT EXISTS file_path            text,
  ADD COLUMN IF NOT EXISTS thumbnail_path       text,
  ADD COLUMN IF NOT EXISTS category_id          text DEFAULT '22',
  ADD COLUMN IF NOT EXISTS scheduled_publish_at timestamptz;

UPDATE public.youtube_videos
  SET scheduled_publish_at = scheduled_at
  WHERE scheduled_at IS NOT NULL AND scheduled_publish_at IS NULL;

-- ── youtube_upload_queue (nieuw) ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.youtube_upload_queue (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id                  uuid REFERENCES public.youtube_videos(id) ON DELETE SET NULL,
  channel_id                uuid NOT NULL REFERENCES public.youtube_channels(id) ON DELETE CASCADE,
  status                    text NOT NULL DEFAULT 'queued'
    CHECK (status IN (
      'queued','preparing','normalizing','uploading',
      'uploaded_pending_processing','processing','verifying',
      'verified_live','failed','retrying','manual_review_required','cancelled'
    )),
  retry_count               smallint NOT NULL DEFAULT 0,
  max_retries               smallint NOT NULL DEFAULT 5,
  last_error                text,
  youtube_url               text,
  youtube_video_id          text,
  title                     text,
  privacy_status            text DEFAULT 'private',
  viral_score               numeric(5,2),
  scheduled_publish_at      timestamptz,
  upload_started_at         timestamptz,
  upload_finished_at        timestamptz,
  verification_started_at   timestamptz,
  verification_finished_at  timestamptz,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS yt_queue_channel_idx  ON public.youtube_upload_queue (channel_id);
CREATE INDEX IF NOT EXISTS yt_queue_status_idx   ON public.youtube_upload_queue (status);
CREATE INDEX IF NOT EXISTS yt_queue_created_idx  ON public.youtube_upload_queue (created_at DESC);
CREATE INDEX IF NOT EXISTS yt_queue_video_idx    ON public.youtube_upload_queue (video_id);

-- ── youtube_upload_failures (nieuw) ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.youtube_upload_failures (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_id            uuid NOT NULL REFERENCES public.youtube_upload_queue(id) ON DELETE CASCADE,
  failure_type        text NOT NULL
    CHECK (failure_type IN (
      'upload_stuck','processing_failed','thumbnail_missing',
      'scheduled_publish_failed','copyright_detected',
      'browser_check_failed','ffmpeg_failed','quota_exceeded','other'
    )),
  failure_detail      text,
  recovery_attempted  boolean NOT NULL DEFAULT false,
  recovery_success    boolean,
  copyright_status    text,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS yt_failures_queue_idx ON public.youtube_upload_failures (queue_id);

-- ── Realtime ──────────────────────────────────────────────────────────────────

ALTER PUBLICATION supabase_realtime ADD TABLE public.youtube_upload_queue;
ALTER PUBLICATION supabase_realtime ADD TABLE public.youtube_upload_failures;

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE public.youtube_upload_queue    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.youtube_upload_failures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_read_upload_queue"     ON public.youtube_upload_queue    FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth_write_upload_queue"    ON public.youtube_upload_queue    FOR ALL    USING (auth.role() = 'authenticated');
CREATE POLICY "auth_read_upload_failures"  ON public.youtube_upload_failures FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth_write_upload_failures" ON public.youtube_upload_failures FOR ALL    USING (auth.role() = 'authenticated');
