-- 057_retention_lab.sql
-- Phase 5 — Retention Lab
--
-- retention_lab_samples bestaat al (uit 045) met (content_item_id, second_index,
-- retention_pct, drop_off_marker). YouTube Analytics levert audienceWatchRatio
-- per "elapsedVideoTimeRatio" bucket (typisch 100 buckets = elke 1% van duur).
-- We slaan dat per bucket op met second_index = percentage.
--
-- Toevoegingen:
--   - retention_analysis jsonb op media_holding_content_items voor AI samenvatting
--   - retention_fetched_at timestamp
--   - executor 'retention_lab' in CHECK

alter table public.media_holding_content_items
  add column if not exists retention_analysis    jsonb,
  add column if not exists retention_fetched_at  timestamptz;

create index if not exists idx_mh_content_retention
  on media_holding_content_items(retention_fetched_at desc)
  where retention_fetched_at is not null;

alter table public.orchestrator_tasks
  drop constraint if exists orchestrator_tasks_executor_check;

alter table public.orchestrator_tasks
  add constraint orchestrator_tasks_executor_check
  check (executor in ('claude-code','anthropic','shell','viral_scanner','content_factory','gravity_detector','atlas_upload','renderer','trend_scanner','retention_lab'));
