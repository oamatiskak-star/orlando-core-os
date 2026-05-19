-- 058_winner_extraction.sql
-- Phase 6 — Winner Extraction Engine
--
-- Een winning content_item krijgt een fan-out van N variants via 10 types.
-- winner_extraction_jobs bestaat al (uit 045). Trigger update de status
-- wanneer de Forge task (content_factory) een output content_item maakt
-- dat naar het winner_extraction_jobs.output_content_id wordt gelinkt.

alter table public.orchestrator_tasks
  drop constraint if exists orchestrator_tasks_executor_check;

alter table public.orchestrator_tasks
  add constraint orchestrator_tasks_executor_check
  check (executor in ('claude-code','anthropic','shell','viral_scanner','content_factory','gravity_detector','atlas_upload','renderer','trend_scanner','retention_lab','winner_extractor'));

-- Voeg multiplicator + winner_job_id naar content_brief payload mogelijkheden toe
-- via index voor lookups in winner_extraction_jobs
create index if not exists idx_winner_jobs_status on winner_extraction_jobs(status);
create index if not exists idx_winner_jobs_variant on winner_extraction_jobs(variant_kind);

-- ─────────────────────────────────────────────────────────────────────────────
-- Trigger: wanneer een content_item wordt ge-insert met een winner_job_id in
-- payload (via Forge), link het output_content_id terug op de winner_extraction_jobs row.
-- ─────────────────────────────────────────────────────────────────────────────
-- We slaan winner_job_id niet direct op content_items op, dus we gebruiken
-- een veld in content_brief jsonb: content_brief->>'_winner_job_id'.
--
-- Trigger op content_items INSERT die deze link legt.
create or replace function public.link_winner_extraction_output()
returns trigger
language plpgsql
security definer
set search_path = public
as $f$
declare
  v_job_id uuid;
begin
  if new.content_brief is null then return new; end if;
  v_job_id := nullif(new.content_brief->>'_winner_job_id', '')::uuid;
  if v_job_id is null then return new; end if;

  update public.winner_extraction_jobs
     set output_content_id = new.id,
         status = case
           when new.status in ('ready','published') then 'ready'
           when new.status = 'failed' then 'failed'
           else status
         end,
         updated_at = now()
   where id = v_job_id;

  return new;
end
$f$;

drop trigger if exists trg_link_winner_extraction on public.media_holding_content_items;
create trigger trg_link_winner_extraction
  after insert on public.media_holding_content_items
  for each row execute function public.link_winner_extraction_output();
