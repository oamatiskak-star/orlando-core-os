-- 044_finalize_chain_direct.sql
-- finalize_chain_root_on_last_completion probeerde de root task op
-- 'completed' te zetten om de reverse sync trigger te fired'n. Maar als
-- de root al completed was (typisch geval: root completed eerst, chain
-- children daarna), is `set status='completed'` een no-op en fired de
-- update trigger niet. Resultaat: planning_items blijft op 'bezig'.
--
-- Fix: de chain-finalisatie schrijft direct naar planning_items met
-- aggregate summary van alle chain children.

create or replace function public.finalize_chain_root_on_last_completion()
returns trigger
language plpgsql
security definer
set search_path = public
as $f$
declare
  v_pending          int;
  v_root             public.orchestrator_tasks%rowtype;
  v_planning_id      uuid;
  v_aggregate_text   text;
  v_aggregate_errors text;
  v_note_block       text;
  v_root_status_str  text;
begin
  if new.status <> 'completed' then return new; end if;
  if coalesce(old.status, '') = new.status then return new; end if;
  if new.parent_task_id is null then return new; end if;

  -- Zijn er nog open steps?
  select count(*) into v_pending
    from public.orchestrator_task_chain
   where parent_task_id = new.parent_task_id
     and status in ('pending', 'dispatched');

  if v_pending > 0 then return new; end if;

  -- Haal root op
  select * into v_root from public.orchestrator_tasks where id = new.parent_task_id;
  if not found then return new; end if;

  v_planning_id := nullif(v_root.payload->>'planning_item_id', '')::uuid;

  -- Aggregate alle child summaries
  select string_agg(
    format(
      e'\n\n— %s [persona=%s]\n  %s',
      to_char(child.finished_at at time zone 'Europe/Amsterdam', 'YYYY-MM-DD HH24:MI'),
      coalesce(child.payload->>'persona', '—'),
      replace(coalesce(child.result_summary, ''), E'\n', E'\n  ')
    ),
    '' order by child.created_at asc
  )
  into v_aggregate_text
  from public.orchestrator_tasks child
  where child.parent_task_id = v_root.id
    and child.result_summary is not null
    and child.result_summary <> '';

  -- Aggregate errors
  select string_agg(
    format(e'\n\n[%s] error: %s', coalesce(child.payload->>'persona', '—'), child.error),
    '' order by child.created_at asc
  )
  into v_aggregate_errors
  from public.orchestrator_tasks child
  where child.parent_task_id = v_root.id
    and child.error is not null
    and child.error <> '';

  -- Bepaal de chain-uitkomst voor planning status
  -- (gereed als alle child completed, geblokkeerd als er failed steps zijn)
  if exists (
    select 1 from public.orchestrator_task_chain
     where parent_task_id = v_root.id
       and status = 'failed'
  ) then
    v_root_status_str := 'geblokkeerd';
  else
    v_root_status_str := 'gereed';
  end if;

  -- Note-block: root summary + alle child summaries + eventuele errors
  v_note_block := format(
    e'\n\n— %s [chain afgerond, root persona=%s]%s',
    to_char(now() at time zone 'Europe/Amsterdam', 'YYYY-MM-DD HH24:MI'),
    coalesce(v_root.payload->>'persona', '—'),
    case when v_root.result_summary is null or v_root.result_summary = '' then '' else
      e'\n  ' || replace(v_root.result_summary, E'\n', E'\n  ') end
  )
  || coalesce(v_aggregate_text, '')
  || coalesce(v_aggregate_errors, '');

  -- Update planning_items direct (geen omweg via root status)
  if v_planning_id is not null then
    update public.planning_items pi
       set status       = v_root_status_str,
           completed_at = case when v_root_status_str = 'gereed' then now() else null end,
           notes        = coalesce(pi.notes, '') || v_note_block,
           updated_at   = now()
     where pi.id = v_planning_id;
  end if;

  -- Mark de root finished_at als nog niet gezet
  update public.orchestrator_tasks
     set finished_at = coalesce(finished_at, now()),
         updated_at = now()
   where id = v_root.id
     and finished_at is null;

  return new;
end
$f$;
