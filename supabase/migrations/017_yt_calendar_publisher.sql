-- Migration 017: YouTube Calendar Publisher — ontbrekende brug naar upload_jobs
-- Voegt video_path en tags toe aan yt_content_calendar.
-- Voegt "missed" en "queued" status toe.

-- ── yt_content_calendar uitbreiden ───────────────────────────────────────────

ALTER TABLE public.yt_content_calendar
  ADD COLUMN IF NOT EXISTS video_path  text,        -- pad of storage-URL van het MP4 bestand
  ADD COLUMN IF NOT EXISTS tags        text[],       -- YouTube SEO-tags
  ADD COLUMN IF NOT EXISTS upload_job_id uuid REFERENCES public.youtube_upload_jobs(id) ON DELETE SET NULL;

-- Zorg dat "missed" en "queued" als geldige status worden geaccepteerd
-- (de status kolom kan al een CHECK constraint hebben — we dropen en herstellen)
DO $$
BEGIN
  ALTER TABLE public.yt_content_calendar DROP CONSTRAINT IF EXISTS yt_content_calendar_status_check;
  ALTER TABLE public.yt_content_calendar
    ADD CONSTRAINT yt_content_calendar_status_check
    CHECK (status IN ('planned','scripted','produced','queued','uploaded','published','missed','cancelled'));
EXCEPTION WHEN others THEN
  NULL; -- constraint bestond niet, prima
END;
$$;

-- Index op publish_date + status voor de publisher query
CREATE INDEX IF NOT EXISTS yt_calendar_publish_date_idx ON public.yt_content_calendar (publish_date, status);
CREATE INDEX IF NOT EXISTS yt_calendar_channel_status_idx ON public.yt_content_calendar (channel_id, status);
