-- 037_planning_orchestrator_bridge.sql
-- Bridge planning_items (/dashboard/taken) → orchestrator_tasks (priority engine).
-- Bi-directionele sync via twee triggers.
--
-- Filter: alleen mirrorren wanneer planning_items.toegewezen ∈
--         {'claude-code', 'ai', 'orchestrator'} (case-insensitive).
-- Safety: volledig autonoom — safe_mode=false, allowed_actions=['*'],
--         requires_confirmation=false (per Orlando's keuze 2026-05-19).
-- Loop prevention: vergelijking op waarden — geen update als nieuwe = oude.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Helper: mapping van planning_items.priority → orchestrator_tasks.priority
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.planning_priority_to_orchestrator(p text)
returns integer
language sql
immutable
as $$
  select case lower(coalesce(p, 'normaal'))
    when 'urgent'  then 1
    when 'hoog'    then 3
    when 'normaal' then 5
    when 'laag'    then 8
    else 5
  end
$$;

-- Reverse mapping (priority band → planning_items prio tekst)
create or replace function public.orchestrator_priority_to_planning(p integer)
returns text
language sql
immutable
as $$
  select case
    when p <= 1 then 'urgent'
    when p <= 3 then 'hoog'
    when p <= 6 then 'normaal'
    else 'laag'
  end
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Helper: mapping van statussen tussen de twee tabellen
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.planning_status_to_orchestrator(s text)
returns text
language sql
immutable
as $$
  select case lower(coalesce(s, 'open'))
    when 'open'        then 'open'
    when 'bezig'       then 'running'
    when 'gereed'      then 'completed'
    when 'geblokkeerd' then 'paused'
    else 'open'
  end
$$;

create or replace function public.orchestrator_status_to_planning(s text)
returns text
language sql
immutable
as $$
  select case lower(coalesce(s, 'open'))
    when 'open'      then 'open'
    when 'running'   then 'bezig'
    when 'retry'     then 'bezig'
    when 'waiting'   then 'open'
    when 'completed' then 'gereed'
    when 'failed'    then 'geblokkeerd'
    when 'paused'    then 'geblokkeerd'
    else 'open'
  end
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Helper: bepaalt of een planning_item in aanmerking komt voor orchestrator
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.planning_is_orchestrator_eligible(toegewezen text)
returns boolean
language sql
immutable
as $$
  select lower(coalesce(toegewezen, '')) in ('claude-code', 'ai', 'orchestrator')
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Forward sync: planning_items → orchestrator_tasks
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.sync_planning_to_orchestrator()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing_id uuid;
  v_company_id  text;
  v_objective   jsonb;
begin
  v_company_id := coalesce(new.company_id::text, 'modiwerijo');
  v_objective  := case
    when new.beschrijving is null or new.beschrijving = ''
      then '[]'::jsonb
    else jsonb_build_array(new.beschrijving)
  end;

  select id into v_existing_id
  from public.orchestrator_tasks
  where (payload->>'planning_item_id')::uuid = new.id
  limit 1;

  -- INSERT pad of planning_items net eligible geworden
  if v_existing_id is null then
    if planning_is_orchestrator_eligible(new.toegewezen) then
      insert into public.orchestrator_tasks (
        company_id,
        title,
        task_type,
        executor,
        allowed_actions,
        priority,
        status,
        interruptible,
        requires_confirmation,
        safe_mode,
        background_task,
        system_critical,
        estimated_runtime,
        objective,
        notes,
        payload,
        run_at,
        attempts,
        max_attempts
      )
      values (
        v_company_id,
        new.titel,
        new.type,
        case lower(new.toegewezen)
          when 'claude-code' then 'claude-code'
          else 'anthropic'
        end,
        '["*"]'::jsonb,
        planning_priority_to_orchestrator(new.priority),
        planning_status_to_orchestrator(new.status),
        true,
        false,
        false,
        false,
        false,
        'medium',
        v_objective,
        '[]'::jsonb,
        jsonb_build_object(
          'planning_item_id', new.id,
          'source', 'planning_items',
          'due_date', new.due_date,
          'project_id', new.project_id
        ),
        coalesce(new.start_date::timestamptz, now()),
        0,
        3
      );
    end if;
    return new;
  end if;

  -- UPDATE pad: orchestrator_tasks bestaat al voor dit planning_item
  if not planning_is_orchestrator_eligible(new.toegewezen) then
    -- toegewezen weg uit eligible-set → orchestrator task pauzeren
    update public.orchestrator_tasks
       set status     = 'paused',
           updated_at = now()
     where id = v_existing_id
       and status not in ('completed', 'failed', 'paused');
    return new;
  end if;

  -- Sync relevante veld-wijzigingen (alleen bij echte change om loops te vermijden)
  update public.orchestrator_tasks ot
     set title    = new.titel,
         task_type = new.type,
         priority = planning_priority_to_orchestrator(new.priority),
         status   = planning_status_to_orchestrator(new.status),
         objective = v_objective,
         payload  = ot.payload
                  || jsonb_build_object(
                       'due_date',  new.due_date,
                       'project_id', new.project_id
                     ),
         updated_at = now()
   where ot.id = v_existing_id
     and (
       ot.title    is distinct from new.titel
       or ot.task_type is distinct from new.type
       or ot.priority is distinct from planning_priority_to_orchestrator(new.priority)
       or ot.status   is distinct from planning_status_to_orchestrator(new.status)
       or ot.objective is distinct from v_objective
     );

  return new;
end
$$;

drop trigger if exists trg_planning_to_orchestrator on public.planning_items;
create trigger trg_planning_to_orchestrator
  after insert or update on public.planning_items
  for each row
  execute function public.sync_planning_to_orchestrator();

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Reverse sync: orchestrator_tasks → planning_items
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.sync_orchestrator_to_planning()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_planning_id    uuid;
  v_new_planning_status text;
begin
  v_planning_id := nullif(new.payload->>'planning_item_id', '')::uuid;
  if v_planning_id is null then
    return new;
  end if;

  v_new_planning_status := orchestrator_status_to_planning(new.status);

  update public.planning_items pi
     set status       = v_new_planning_status,
         completed_at = case
           when v_new_planning_status = 'gereed'
             then coalesce(new.finished_at, now())
           else null
         end,
         updated_at   = now()
   where pi.id = v_planning_id
     and pi.status is distinct from v_new_planning_status;

  return new;
end
$$;

drop trigger if exists trg_orchestrator_to_planning on public.orchestrator_tasks;
create trigger trg_orchestrator_to_planning
  after update of status, finished_at on public.orchestrator_tasks
  for each row
  execute function public.sync_orchestrator_to_planning();

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Backfill: bestaande eligible planning_items
-- ─────────────────────────────────────────────────────────────────────────────
insert into public.orchestrator_tasks (
  company_id, title, task_type, executor, allowed_actions, priority, status,
  interruptible, requires_confirmation, safe_mode, background_task,
  system_critical, estimated_runtime, objective, notes, payload, run_at,
  attempts, max_attempts
)
select
  coalesce(pi.company_id::text, 'modiwerijo'),
  pi.titel,
  pi.type,
  case lower(pi.toegewezen) when 'claude-code' then 'claude-code' else 'anthropic' end,
  '["*"]'::jsonb,
  planning_priority_to_orchestrator(pi.priority),
  planning_status_to_orchestrator(pi.status),
  true, false, false, false, false, 'medium',
  case
    when pi.beschrijving is null or pi.beschrijving = '' then '[]'::jsonb
    else jsonb_build_array(pi.beschrijving)
  end,
  '[]'::jsonb,
  jsonb_build_object(
    'planning_item_id', pi.id,
    'source', 'planning_items',
    'due_date', pi.due_date,
    'project_id', pi.project_id
  ),
  coalesce(pi.start_date::timestamptz, now()),
  0, 3
from public.planning_items pi
where planning_is_orchestrator_eligible(pi.toegewezen)
  and not exists (
    select 1 from public.orchestrator_tasks ot
    where (ot.payload->>'planning_item_id')::uuid = pi.id
  );
