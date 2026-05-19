-- 056_trend_scanner_executor.sql
-- Phase 13 — Trend Scanner: voeg 'trend_scanner' executor toe.

alter table public.orchestrator_tasks
  drop constraint if exists orchestrator_tasks_executor_check;

alter table public.orchestrator_tasks
  add constraint orchestrator_tasks_executor_check
  check (executor in ('claude-code','anthropic','shell','viral_scanner','content_factory','gravity_detector','atlas_upload','renderer','trend_scanner'));
