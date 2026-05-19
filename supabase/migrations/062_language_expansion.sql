-- 062_language_expansion.sql
-- Phase 11 — Language Expansion. Per source content_item: fan-out naar
-- target_langs via Forge.
--
-- Vergelijkbaar met winner_extraction trigger (migratie 058): link
-- output content_item terug naar language_expansion_targets via
-- content_brief._language_target_id (gezet door Forge handler bij insert).

alter table public.orchestrator_tasks
  drop constraint if exists orchestrator_tasks_executor_check;

alter table public.orchestrator_tasks
  add constraint orchestrator_tasks_executor_check
  check (executor in ('claude-code','anthropic','shell','viral_scanner','content_factory','gravity_detector','atlas_upload','renderer','trend_scanner','retention_lab','winner_extractor','audio_scanner','sponsor_engine','monetization_tracker','language_expander'));

create index if not exists idx_language_targets_status on language_expansion_targets(status);
create index if not exists idx_language_targets_lang   on language_expansion_targets(target_lang);

-- Trigger: link output_content_id wanneer Forge een content_item insert
-- met content_brief._language_target_id gevuld
create or replace function public.link_language_expansion_output()
returns trigger
language plpgsql
security definer
set search_path = public
as $f$
declare
  v_target_id uuid;
begin
  if new.content_brief is null then return new; end if;
  v_target_id := nullif(new.content_brief->>'_language_target_id', '')::uuid;
  if v_target_id is null then return new; end if;

  update public.language_expansion_targets
     set output_content_id = new.id,
         status = case
           when new.status in ('ready','published') then 'ready'
           when new.status = 'failed' then 'failed'
           else status
         end,
         updated_at = now()
   where id = v_target_id;

  return new;
end
$f$;

drop trigger if exists trg_link_language_expansion on public.media_holding_content_items;
create trigger trg_link_language_expansion
  after insert on public.media_holding_content_items
  for each row execute function public.link_language_expansion_output();
