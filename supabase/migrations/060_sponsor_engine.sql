-- 060_sponsor_engine.sql
-- Phase 8 — Sponsor Engine. AI-gedreven brand discovery + outreach draft.

alter table public.sponsor_engine_targets
  add column if not exists channel_id      uuid references public.media_holding_channels(id) on delete set null,
  add column if not exists outreach_draft  text,
  add column if not exists contact_name    text,
  add column if not exists contact_email   text,
  add column if not exists category        text,
  add column if not exists est_budget      text;

create index if not exists idx_sponsor_targets_channel on sponsor_engine_targets(channel_id);
create index if not exists idx_sponsor_targets_fit on sponsor_engine_targets(fit_score desc);

alter table public.orchestrator_tasks
  drop constraint if exists orchestrator_tasks_executor_check;

alter table public.orchestrator_tasks
  add constraint orchestrator_tasks_executor_check
  check (executor in ('claude-code','anthropic','shell','viral_scanner','content_factory','gravity_detector','atlas_upload','renderer','trend_scanner','retention_lab','winner_extractor','audio_scanner','sponsor_engine'));
