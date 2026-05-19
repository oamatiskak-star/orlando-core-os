-- 042_chain_sync_race_fix.sql
-- Bugfix: chain children van orchestrator_tasks delen payload.planning_item_id
-- met de root task. Daardoor triggerde elke status-overgang van een child
-- de reverse sync → planning_items.status update → forward sync → die
-- pakte willekeurig een orchestrator_task uit de set (LIMIT 1) en zette die
-- weer op running/open. Resultaat: de root task werd herclaimd en draaide
-- meerdere keren, en de chain dispatcher trigger fired vaker dan bedoeld.
--
-- Fix: forward sync mirror't alleen naar de ROOT task (parent_task_id IS NULL).
-- Reverse sync skip't volledig voor child tasks; pas wanneer de hele chain
-- klaar is (root + alle steps completed) wordt planning_items finaal geupdate
-- via een aparte chain-completion trigger.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Forward sync: pakt alleen ROOT (parent_task_id IS NULL) als mirror
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.sync_planning_to_orchestrator()
returns trigger
language plpgsql
security definer
set search_path = public
as $f$
declare
  v_existing_id uuid;
  v_company_id  text;
  v_objective   jsonb;
begin
  v_company_id := coalesce(new.company_id::text, 'modiwerijo');
  v_objective  := case
    when new.beschrijving is null or new.beschrijving = '' then '[]'::jsonb
    else jsonb_build_array(new.beschrijving)
  end;

  -- Alleen root mirror's matchen — chain children blijven met rust
  select id into v_existing_id
  from public.orchestrator_tasks
  where (payload->>'planning_item_id')::uuid = new.id
    and parent_task_id is null
  order by created_at desc
  limit 1;

  if v_existing_id is null then
    if planning_is_orchestrator_eligible(new.toegewezen) then
      insert into public.orchestrator_tasks (
        company_id, title, task_type, executor, allowed_actions, priority, status,
        interruptible, requires_confirmation, safe_mode, background_task,
        system_critical, estimated_runtime, objective, notes, payload, run_at,
        attempts, max_attempts
      ) values (
        v_company_id, new.titel, new.type,
        case lower(new.toegewezen) when 'claude-code' then 'claude-code' else 'anthropic' end,
        '["*"]'::jsonb,
        planning_priority_to_orchestrator(new.priority),
        planning_status_to_orchestrator(new.status),
        true, false, false, false, false, 'medium',
        v_objective, '[]'::jsonb,
        jsonb_build_object(
          'planning_item_id', new.id,
          'source', 'planning_items',
          'due_date', new.due_date,
          'project_id', new.project_id
        ),
        coalesce(new.start_date::timestamptz, now()),
        0, 3
      );
    end if;
    return new;
  end if;

  if not planning_is_orchestrator_eligible(new.toegewezen) then
    update public.orchestrator_tasks
       set status = 'paused', updated_at = now()
     where id = v_existing_id
       and status not in ('completed', 'failed', 'paused');
    return new;
  end if;

  -- Update root mirror — children blijven onaangeraakt
  update public.orchestrator_tasks ot
     set title     = new.titel,
         task_type = new.type,
         priority  = planning_priority_to_orchestrator(new.priority),
         status    = planning_status_to_orchestrator(new.status),
         objective = v_objective,
         payload   = ot.payload || jsonb_build_object('due_date', new.due_date, 'project_id', new.project_id),
         updated_at = now()
   where ot.id = v_existing_id
     and (
       ot.title     is distinct from new.titel
       or ot.task_type is distinct from new.type
       or ot.priority is distinct from planning_priority_to_orchestrator(new.priority)
       or ot.status   is distinct from planning_status_to_orchestrator(new.status)
       or ot.objective is distinct from v_objective
     );

  return new;
end
$f$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Reverse sync: skip child tasks. Voor chain root: alleen finaliseren als
--    alle chain steps completed zijn. Voor non-chain tasks: bestaande logica.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.sync_orchestrator_to_planning()
returns trigger
language plpgsql
security definer
set search_path = public
as $f$
declare
  v_planning_id     uuid;
  v_new_status      text;
  v_pending_steps   int;
  v_note_block      text;
  v_aggregate_summary text;
  v_aggregate_errors  text;
begin
  -- Chain children mogen het planning_item NIET aanraken
  if new.parent_task_id is not null then
    return new;
  end if;

  v_planning_id := nullif(new.payload->>'planning_item_id', '')::uuid;
  if v_planning_id is null then return new; end if;

  -- Als deze root tasks chain steps heeft, kijken of er nog werk open staat
  select count(*) into v_pending_steps
    from public.orchestrator_task_chain
   where parent_task_id = new.id
     and status in ('pending', 'dispatched');

  -- Bij completed root + nog pending/dispatched chain steps: schrijf alvast
  -- de root summary in notes maar laat planning_items.status op 'bezig' staan
  -- (de bridge ziet de hele chain pas als klaar wanneer alle steps gerund zijn).
  if v_pending_steps > 0 and new.status = 'completed' then
    v_note_block := format(
      e'\n\n— %s [%s persona=%s]%s',
      to_char(coalesce(new.finished_at, now()) at time zone 'Europe/Amsterdam', 'YYYY-MM-DD HH24:MI'),
      new.status,
      coalesce(new.payload->>'persona', '—'),
      case when new.result_summary is null or new.result_summary = '' then '' else
        e'\n  ' || replace(new.result_summary, E'\n', E'\n  ') end
    );

    update public.planning_items pi
       set status     = 'bezig',
           notes      = coalesce(pi.notes, '') || v_note_block,
           updated_at = now()
     where pi.id = v_planning_id
       and (pi.status is distinct from 'bezig' or new.result_summary is not null);

    return new;
  end if;

  -- Geen pending chain steps meer (of geen chain überhaupt): finaliseer
  v_new_status := orchestrator_status_to_planning(new.status);

  -- Aggregate summaries van alle chain children (geordend op step_order)
  select string_agg(
    format(
      e'\n\n— %s [persona=%s]\n  %s',
      to_char(child.finished_at at time zone 'Europe/Amsterdam', 'YYYY-MM-DD HH24:MI'),
      coalesce(child.payload->>'persona', '—'),
      replace(coalesce(child.result_summary, ''), E'\n', E'\n  ')
    ),
    ''
    order by child.created_at asc
  )
  into v_aggregate_summary
  from public.orchestrator_tasks child
  where child.parent_task_id = new.id
    and child.result_summary is not null
    and child.result_summary <> '';

  -- Aggregate errors
  select string_agg(
    format(e'\n\n[%s] error: %s', coalesce(child.payload->>'persona', '—'), child.error),
    ''
    order by child.created_at asc
  )
  into v_aggregate_errors
  from public.orchestrator_tasks child
  where child.parent_task_id = new.id
    and child.error is not null
    and child.error <> '';

  -- Note-block voor deze root
  v_note_block := format(
    e'\n\n— %s [%s persona=%s]%s%s%s',
    to_char(coalesce(new.finished_at, now()) at time zone 'Europe/Amsterdam', 'YYYY-MM-DD HH24:MI'),
    new.status,
    coalesce(new.payload->>'persona', '—'),
    case when new.error is null or new.error = '' then '' else
      e'\n  fout: ' || new.error end,
    case when new.result_summary is null or new.result_summary = '' then '' else
      e'\n  ' || replace(new.result_summary, E'\n', E'\n  ') end,
    case
      when v_aggregate_summary is not null and v_aggregate_summary <> '' then v_aggregate_summary
      else ''
    end
    ||
    case
      when v_aggregate_errors is not null and v_aggregate_errors <> '' then v_aggregate_errors
      else ''
    end
  );

  update public.planning_items pi
     set status       = v_new_status,
         completed_at = case
           when v_new_status = 'gereed' then coalesce(new.finished_at, now())
           else null
         end,
         notes        = case
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

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Chain-finalisation trigger: wanneer de LAATSTE chain child completed wordt,
--    moet de root task tevens completed worden zodat de reverse sync (hierboven)
--    de planning_item finaliseert.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.finalize_chain_root_on_last_completion()
returns trigger
language plpgsql
security definer
set search_path = public
as $f$
declare
  v_pending int;
begin
  if new.status <> 'completed' then return new; end if;
  if coalesce(old.status, '') = new.status then return new; end if;
  if new.parent_task_id is null then return new; end if;

  -- Heeft de chain nog pending of dispatched steps?
  select count(*) into v_pending
    from public.orchestrator_task_chain
   where parent_task_id = new.parent_task_id
     and status in ('pending', 'dispatched');

  if v_pending > 0 then return new; end if;

  -- Mark de root task expliciet completed → triggert reverse sync finalisatie
  update public.orchestrator_tasks
     set status = 'completed',
         finished_at = coalesce(finished_at, now()),
         updated_at = now()
   where id = new.parent_task_id
     and status <> 'completed';

  return new;
end
$f$;

drop trigger if exists trg_finalize_chain_root on public.orchestrator_tasks;
create trigger trg_finalize_chain_root
  after update of status on public.orchestrator_tasks
  for each row
  execute function public.finalize_chain_root_on_last_completion();
