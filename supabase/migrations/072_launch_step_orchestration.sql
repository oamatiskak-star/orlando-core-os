-- 072_launch_step_orchestration.sql
-- Step auto-advance + dispatcher voor launch_step executor.
--
-- Trigger A: bij channel_launch_steps.status → 'in_progress'
--   → dispatch launch_step task naar executor
-- Trigger B: bij channel_launch_steps.status → 'completed'
--   → markeer volgende step in plan als 'in_progress' (sequentieel)
--
-- Loop-bescherming: triggers vuren alleen op transitions, niet op herhaalde
-- updates met dezelfde status.

-- Executor enum: launch_step
alter table public.orchestrator_tasks
  drop constraint if exists orchestrator_tasks_executor_check;

alter table public.orchestrator_tasks
  add constraint orchestrator_tasks_executor_check
  check (executor in (
    'claude-code','anthropic','shell',
    'viral_scanner','content_factory','gravity_detector','atlas_upload','renderer',
    'trend_scanner','retention_lab','winner_extractor','audio_scanner',
    'sponsor_engine','monetization_tracker','language_expander','cron_dispatcher',
    'affiliate_injector','launch_step'
  ));

-- ─────────────────────────────────────────────────────────────────────────────
-- Trigger A: in_progress → dispatch launch_step task
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.tg_launch_step_dispatch()
returns trigger
language plpgsql
security definer
set search_path = public
as $f$
declare
  v_plan record;
  v_task_id uuid;
begin
  if new.status <> 'in_progress' then return new; end if;
  if tg_op = 'UPDATE' and old.status = 'in_progress' then return new; end if;

  -- Skip als er al een open launch_step task is voor deze step
  if exists (
    select 1 from public.orchestrator_tasks
     where executor = 'launch_step'
       and (payload->>'step_id')::uuid = new.id
       and status in ('open','running','in_progress')
  ) then return new; end if;

  select id, project_name, niche, channel_id, osil_opportunity_id, viral_opportunity_id, language
    into v_plan
    from public.channel_launch_plans
   where id = new.plan_id;

  insert into public.orchestrator_tasks (
    company_id, title, task_type, executor, allowed_actions, priority, status, objective, payload
  ) values (
    'modiwerijo',
    format('[launch] %s — %s', substring(v_plan.project_name, 1, 40), new.step_label),
    'launch_step',
    'launch_step',
    '["*"]'::jsonb,
    3,
    'open',
    jsonb_build_array(format('Voer launch step "%s" uit voor plan "%s"', new.step_label, v_plan.project_name)),
    jsonb_build_object(
      'step_id',                new.id,
      'plan_id',                new.plan_id,
      'step_key',               new.step_key,
      'step_label',             new.step_label,
      'step_order',             new.step_order,
      'owner_persona',          new.owner_persona,
      'project_name',           v_plan.project_name,
      'niche',                  v_plan.niche,
      'language',               v_plan.language,
      'channel_id',             v_plan.channel_id,
      'osil_opportunity_id',    v_plan.osil_opportunity_id,
      'viral_opportunity_id',   v_plan.viral_opportunity_id,
      'persona',                coalesce(new.owner_persona, 'Atlas')
    )
  )
  returning id into v_task_id;

  insert into public.autopilot_events (link_key, source_table, source_id, target_executor, task_id, details)
  values (
    'launch_step_dispatch',
    'channel_launch_steps',
    new.id,
    'launch_step',
    v_task_id,
    jsonb_build_object('step_key', new.step_key, 'plan_id', new.plan_id)
  );

  return new;
end
$f$;

drop trigger if exists trg_launch_step_dispatch on public.channel_launch_steps;
create trigger trg_launch_step_dispatch
  after insert or update of status on public.channel_launch_steps
  for each row execute function public.tg_launch_step_dispatch();

-- ─────────────────────────────────────────────────────────────────────────────
-- Trigger B: completed → next step naar in_progress
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.tg_launch_step_advance()
returns trigger
language plpgsql
security definer
set search_path = public
as $f$
declare
  v_next_id uuid;
  v_all_done boolean;
begin
  if new.status not in ('completed','skipped') then return new; end if;
  if tg_op = 'UPDATE' and old.status in ('completed','skipped') then return new; end if;

  -- Vind volgende pending step in zelfde plan
  select id into v_next_id
    from public.channel_launch_steps
   where plan_id = new.plan_id
     and step_order > new.step_order
     and status   = 'pending'
   order by step_order asc
   limit 1;

  if v_next_id is not null then
    update public.channel_launch_steps
       set status     = 'in_progress',
           started_at = now(),
           updated_at = now()
     where id = v_next_id;
  else
    -- Geen pending step meer — check of plan kan worden afgerond
    select bool_and(status in ('completed','skipped','blocked'))
      into v_all_done
      from public.channel_launch_steps
     where plan_id = new.plan_id;

    if v_all_done then
      update public.channel_launch_plans
         set status      = case when exists (
                                  select 1 from public.channel_launch_steps
                                   where plan_id = new.plan_id and status='blocked'
                                ) then 'paused' else 'live' end,
             completed_at = now(),
             updated_at   = now()
       where id = new.plan_id;
    end if;
  end if;

  return new;
end
$f$;

drop trigger if exists trg_launch_step_advance on public.channel_launch_steps;
create trigger trg_launch_step_advance
  after update of status on public.channel_launch_steps
  for each row execute function public.tg_launch_step_advance();

-- ─────────────────────────────────────────────────────────────────────────────
-- autopilot_config registratie (default ON — uitschakelbaar via dashboard)
-- ─────────────────────────────────────────────────────────────────────────────
insert into public.autopilot_config (link_key, description, enabled, threshold)
values
  ('launch_step_dispatch',
   'Auto-dispatch launch_step task bij channel_launch_steps.status=in_progress',
   true, null)
on conflict (link_key) do update
  set description = excluded.description,
      updated_at = now();
