-- 055_render_pipeline.sql
-- Phase 2.5 — Render pipeline via Replicate API.
--
-- Content_items krijgen render-state velden zodat een renderer executor
-- task kan worden gevolgd: render_model (welk model), render_job_id
-- (Replicate prediction id), render_logs (stream van prediction events),
-- render_started_at.

alter table public.media_holding_content_items
  add column if not exists render_model      text,
  add column if not exists render_job_id     text,
  add column if not exists render_logs       text,
  add column if not exists render_started_at timestamptz;

create index if not exists idx_mh_content_render_job on media_holding_content_items(render_job_id) where render_job_id is not null;

alter table public.orchestrator_tasks
  drop constraint if exists orchestrator_tasks_executor_check;

alter table public.orchestrator_tasks
  add constraint orchestrator_tasks_executor_check
  check (executor in ('claude-code','anthropic','shell','viral_scanner','content_factory','gravity_detector','atlas_upload','renderer'));
