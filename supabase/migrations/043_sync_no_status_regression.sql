-- 043_sync_no_status_regression.sql
-- Sluitstuk op de chain sync race: forward sync mag NIET het status field
-- regredereren wanneer planning_items een afgeleide status krijgt na
-- chain-progressie (root completed → planning bezig → forward sync zou
-- root op running zetten → orchestrator herclaimt → loop).
--
-- Fix: in sync_planning_to_orchestrator, sluit status uit van de UPDATE
-- set wanneer de mirror al in een terminal of post-completed state staat.
-- Status flowt vanaf nu primair vanuit orchestrator → planning, niet
-- andersom. Handmatige planning_items.status='gereed' veranderingen
-- worden nog steeds gerespecteerd voor non-chain tasks.

create or replace function public.sync_planning_to_orchestrator()
returns trigger
language plpgsql
security definer
set search_path = public
as $f$
declare
  v_existing_id  uuid;
  v_existing_status text;
  v_company_id   text;
  v_objective    jsonb;
  v_new_status   text;
begin
  v_company_id := coalesce(new.company_id::text, 'modiwerijo');
  v_objective  := case
    when new.beschrijving is null or new.beschrijving = '' then '[]'::jsonb
    else jsonb_build_array(new.beschrijving)
  end;
  v_new_status := planning_status_to_orchestrator(new.status);

  -- Alleen ROOT mirror's matchen
  select id, status into v_existing_id, v_existing_status
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
        v_new_status,
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

  -- Toegewezen weg uit eligible-set → orchestrator task pauseren
  if not planning_is_orchestrator_eligible(new.toegewezen) then
    update public.orchestrator_tasks
       set status = 'paused', updated_at = now()
     where id = v_existing_id
       and status not in ('completed', 'failed', 'paused');
    return new;
  end if;

  -- BELANGRIJK: status-veld NIET regredereren.
  --
  -- Als de orchestrator_task al een "post-execution" status heeft
  -- (completed/failed/paused/running/waiting/retry), dan staat de
  -- canonieke status onder controle van de orchestrator-handlers en
  -- de chain dispatcher — niet onder de planning_items UI.
  -- Forward sync update't dan alleen content velden (title/type/
  -- priority/objective), niet status. Status flowt vanaf nu één-richting
  -- van orchestrator → planning.
  --
  -- Alleen wanneer de mirror nog op 'open' staat én planning status
  -- ook een open-achtige status heeft mag forward de status touchen.
  update public.orchestrator_tasks ot
     set title     = new.titel,
         task_type = new.type,
         priority  = planning_priority_to_orchestrator(new.priority),
         status    = case
           when ot.status = 'open' then v_new_status
           else ot.status   -- bevries: orchestrator owned
         end,
         objective = v_objective,
         payload   = ot.payload || jsonb_build_object('due_date', new.due_date, 'project_id', new.project_id),
         updated_at = now()
   where ot.id = v_existing_id
     and (
       ot.title     is distinct from new.titel
       or ot.task_type is distinct from new.type
       or ot.priority is distinct from planning_priority_to_orchestrator(new.priority)
       or (ot.status = 'open' and ot.status is distinct from v_new_status)
       or ot.objective is distinct from v_objective
     );

  return new;
end
$f$;
