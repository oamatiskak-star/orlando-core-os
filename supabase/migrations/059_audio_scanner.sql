-- 059_audio_scanner.sql
-- Phase 7 — Audio Library scanner via YouTube Music chart (categoryId=10).

alter table public.orchestrator_tasks
  drop constraint if exists orchestrator_tasks_executor_check;

alter table public.orchestrator_tasks
  add constraint orchestrator_tasks_executor_check
  check (executor in ('claude-code','anthropic','shell','viral_scanner','content_factory','gravity_detector','atlas_upload','renderer','trend_scanner','retention_lab','winner_extractor','audio_scanner'));

create index if not exists idx_audio_lib_velocity on audio_library(trend_velocity desc);
create index if not exists idx_audio_lib_captured on audio_library(captured_at desc);
