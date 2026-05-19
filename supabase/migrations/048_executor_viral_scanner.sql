-- 048_executor_viral_scanner.sql
-- Breidt de orchestrator_tasks.executor CHECK constraint uit met
-- 'viral_scanner' zodat Vortex' workflow via de orchestrator kan lopen.

alter table public.orchestrator_tasks
  drop constraint if exists orchestrator_tasks_executor_check;

alter table public.orchestrator_tasks
  add constraint orchestrator_tasks_executor_check
  check (executor in ('claude-code','anthropic','shell','viral_scanner'));
