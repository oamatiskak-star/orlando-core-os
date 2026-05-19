-- 038_result_summary_sync.sql
-- Voegt result_summary toe aan orchestrator_tasks en synct die naar
-- planning_items.notes zodat /dashboard/taken de orchestrator-output toont.

alter table public.orchestrator_tasks
  add column if not exists result_summary text;

-- ─────────────────────────────────────────────────────────────────────────────
-- sync_orchestrator_to_planning bijwerken: kopieer result_summary naar
-- planning_items.notes wanneer de task completed/failed/paused raakt.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.sync_orchestrator_to_planning()
returns trigger
language plpgsql
security definer
set search_path = public
as $f$
declare
  v_planning_id   uuid;
  v_new_status    text;
  v_note_block    text;
begin
  v_planning_id := nullif(new.payload->>'planning_item_id', '')::uuid;
  if v_planning_id is null then
    return new;
  end if;

  v_new_status := orchestrator_status_to_planning(new.status);

  -- Bouw een note-block met timestamp + status + (optioneel) summary.
  -- Wordt geappend aan planning_items.notes zodat history bewaard blijft.
  v_note_block := format(
    e'\n\n— %s [%s]%s%s',
    to_char(coalesce(new.finished_at, now()) at time zone 'Europe/Amsterdam',
            'YYYY-MM-DD HH24:MI'),
    new.status,
    case when new.error is null or new.error = '' then '' else
      e'\n  fout: ' || new.error end,
    case when new.result_summary is null or new.result_summary = '' then '' else
      e'\n  ' || replace(new.result_summary, E'\n', E'\n  ') end
  );

  update public.planning_items pi
     set status       = v_new_status,
         completed_at = case
           when v_new_status = 'gereed' then coalesce(new.finished_at, now())
           else null
         end,
         notes        = case
           -- Alleen appenden bij terminal/escalation states; running/open spamt notes niet vol
           when new.status in ('completed', 'failed', 'paused', 'waiting')
             then coalesce(pi.notes, '') || v_note_block
           else pi.notes
         end,
         updated_at   = now()
   where pi.id = v_planning_id
     and (
       pi.status is distinct from v_new_status
       or (new.status in ('completed', 'failed', 'paused', 'waiting')
           and (new.result_summary is not null or new.error is not null))
     );

  return new;
end
$f$;

-- Trigger fires ook bij wijziging van result_summary
drop trigger if exists trg_orchestrator_to_planning on public.orchestrator_tasks;
create trigger trg_orchestrator_to_planning
  after update of status, finished_at, result_summary on public.orchestrator_tasks
  for each row
  execute function public.sync_orchestrator_to_planning();
