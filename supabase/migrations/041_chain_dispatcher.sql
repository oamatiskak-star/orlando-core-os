-- 041_chain_dispatcher.sql
-- Trigger op orchestrator_tasks die bij completion van een chain-step
-- automatisch de volgende step in dezelfde chain dispatcht.
--
-- Workflow:
--   1. POST /api/planning/[id]/chain creeert een orchestrator_task_chain
--      record per persona-step en dispatcht de eerste step als een
--      orchestrator_tasks row met parent_task_id = root_task_id.
--   2. Wanneer een child task completed wordt → trigger ziet dat
--      child_task_id staat op een dispatched chain step → markeert die
--      step completed en zoekt volgende pending step met dezelfde
--      parent_task_id.
--   3. Voor de volgende step wordt een nieuwe orchestrator_tasks row
--      gespawned met persona prefix in title en payload.persona gevuld.

create or replace function public.dispatch_next_chain_step()
returns trigger
language plpgsql
security definer
set search_path = public
as $f$
declare
  v_step          record;
  v_parent_id     uuid;
  v_new_task_id   uuid;
begin
  -- Alleen reageren op nieuwe completed-overgang
  if new.status <> 'completed' then return new; end if;
  if coalesce(old.status, '') = new.status then return new; end if;

  -- Bepaal welke parent_task_id deze chain hoort
  v_parent_id := coalesce(new.parent_task_id, new.id);

  -- Markeer huidige chain step (waarvoor deze task het child was) als completed
  update public.orchestrator_task_chain
     set status      = 'completed',
         finished_at = coalesce(new.finished_at, now())
   where child_task_id = new.id
     and status = 'dispatched';

  -- Zoek volgende pending step
  select c.* into v_step
    from public.orchestrator_task_chain c
   where c.parent_task_id = v_parent_id
     and c.status = 'pending'
   order by c.step_order asc
   limit 1;

  if not found then return new; end if;

  -- Spawn nieuwe orchestrator_tasks row voor deze step
  insert into public.orchestrator_tasks (
    company_id, title, task_type, executor, allowed_actions, priority,
    objective, payload, parent_task_id
  )
  select
    new.company_id,
    new.title || ' → ' || v_step.persona_name,
    new.task_type,
    'anthropic',
    '["*"]'::jsonb,
    new.priority,
    new.objective,
    new.payload
      || jsonb_build_object(
           'chain_step_id', v_step.id,
           'persona',       v_step.persona_name,
           'chain_root',    v_parent_id
         ),
    v_parent_id
  returning id into v_new_task_id;

  update public.orchestrator_task_chain
     set status        = 'dispatched',
         child_task_id = v_new_task_id,
         started_at    = now()
   where id = v_step.id;

  return new;
end
$f$;

drop trigger if exists trg_chain_dispatcher on public.orchestrator_tasks;
create trigger trg_chain_dispatcher
  after update of status on public.orchestrator_tasks
  for each row
  execute function public.dispatch_next_chain_step();
