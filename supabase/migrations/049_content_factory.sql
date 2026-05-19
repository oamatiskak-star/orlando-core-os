-- 049_content_factory.sql
-- Phase 2 — Content Factory: voegt content_brief jsonb toe aan content items
-- en breidt executor enum uit met 'content_factory'.

alter table public.media_holding_content_items
  add column if not exists content_brief jsonb;

create index if not exists idx_mh_content_items_brief
  on media_holding_content_items ((content_brief is not null));

alter table public.orchestrator_tasks
  drop constraint if exists orchestrator_tasks_executor_check;

alter table public.orchestrator_tasks
  add constraint orchestrator_tasks_executor_check
  check (executor in ('claude-code','anthropic','shell','viral_scanner','content_factory'));
