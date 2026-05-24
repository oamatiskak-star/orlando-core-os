-- ─────────────────────────────────────────────────────────────────────────
-- Migration 089 — Routines & Automation Control Layer
-- ─────────────────────────────────────────────────────────────────────────
-- Doel:
--   Meta-supervisor laag bovenop bestaande engines (youtube, mail, watchdog,
--   executive, acquisition, planning, local-agent) zonder duplicatie.
--   Hergebruikt waar mogelijk:
--     - orchestrator_tasks (taken die routines spawnen)
--     - executive_recommendations + executive_alerts (Intelligence findings
--       via target_kind='routine')
--     - infra_watchdog_events (read-only via v_system_health)
--     - acq_agent_registry + executive_agents (read-only via v_system_health)
--
-- Architectuur:
--   Scheduler:  pg_cron + pg_net (already enabled via migration 092)
--   Runner:     local-agent (Mac mini) via PM2 — polled routine_runs voor
--               status='queued' met `for update skip locked`
--   Approvals:  immutable via PG RULE op routine_audit_log
--   Overrides:  routine_autopilot_config per routine

-- ── 1. routines (definitie) ───────────────────────────────────────────────
create table if not exists public.routines (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid references public.companies(id) on delete set null,
  slug            text not null,
  name            text not null,
  description     text,
  kind            text not null
                    check (kind in ('agent','workflow','cron','reactive')),
  status          text not null default 'draft'
                    check (status in ('active','paused','disabled','draft')),
  owner_user_id   uuid,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (slug)
);

create index if not exists idx_routines_company_status on public.routines (company_id, status);
create index if not exists idx_routines_kind           on public.routines (kind);

create or replace function public.routines_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end$$;

drop trigger if exists trg_routines_updated_at on public.routines;
create trigger trg_routines_updated_at
  before update on public.routines
  for each row execute function public.routines_touch_updated_at();

-- ── 2. routine_steps (configuratie per stap) ──────────────────────────────
create table if not exists public.routine_steps (
  id                  uuid primary key default gen_random_uuid(),
  routine_id          uuid not null references public.routines(id) on delete cascade,
  order_idx           integer not null,
  type                text not null
                        check (type in ('action','condition','approval','fallback','delay')),
  config              jsonb not null default '{}'::jsonb,
  on_failure_step_id  uuid references public.routine_steps(id) on delete set null,
  created_at          timestamptz not null default now()
);

create unique index if not exists idx_routine_steps_routine_order
  on public.routine_steps (routine_id, order_idx);

-- ── 3. routine_triggers ───────────────────────────────────────────────────
-- kind='cron'      → config: { cron: '*/15 * * * *', tz: 'Europe/Amsterdam' }
-- kind='event'     → config: { event: 'watchdog_failure', filter: {...} }
-- kind='webhook'   → config: { secret_hash: '...' }
-- kind='manual'    → config: {}  (alleen via UI "Run now")
create table if not exists public.routine_triggers (
  id            uuid primary key default gen_random_uuid(),
  routine_id    uuid not null references public.routines(id) on delete cascade,
  kind          text not null check (kind in ('cron','event','webhook','manual')),
  config        jsonb not null default '{}'::jsonb,
  enabled       boolean not null default true,
  next_run_at   timestamptz,
  last_run_at   timestamptz,
  created_at    timestamptz not null default now()
);

create index if not exists idx_routine_triggers_enabled_kind
  on public.routine_triggers (kind) where enabled;
create index if not exists idx_routine_triggers_next_run
  on public.routine_triggers (next_run_at) where enabled and next_run_at is not null;

-- ── 4. routine_runs (executie-instanties) ─────────────────────────────────
create table if not exists public.routine_runs (
  id                uuid primary key default gen_random_uuid(),
  routine_id        uuid not null references public.routines(id) on delete cascade,
  parent_run_id     uuid references public.routine_runs(id) on delete set null,
  status            text not null default 'queued'
                      check (status in ('queued','running','paused','awaiting_approval','failed','recovered','completed','cancelled')),
  trigger_kind      text not null check (trigger_kind in ('cron','event','webhook','manual','retry')),
  trigger_payload   jsonb not null default '{}'::jsonb,
  service_id        text,         -- 'local-agent-macmini' | 'planning-engine' | etc.
  claimed_by        text,         -- runner identifier voor SKIP LOCKED-claims
  claimed_at        timestamptz,
  started_at        timestamptz not null default now(),
  heartbeat_at      timestamptz,
  ended_at          timestamptz,
  error             jsonb,
  cost_cents        integer not null default 0
);

create index if not exists idx_routine_runs_routine_started
  on public.routine_runs (routine_id, started_at desc);
create index if not exists idx_routine_runs_active_status
  on public.routine_runs (status)
  where status in ('queued','running','paused','awaiting_approval');
create index if not exists idx_routine_runs_heartbeat
  on public.routine_runs (heartbeat_at)
  where status = 'running';

-- ── 5. routine_run_steps (per-stap audit van een run) ─────────────────────
create table if not exists public.routine_run_steps (
  id           uuid primary key default gen_random_uuid(),
  run_id       uuid not null references public.routine_runs(id) on delete cascade,
  step_id      uuid not null references public.routine_steps(id) on delete cascade,
  started_at   timestamptz not null default now(),
  ended_at     timestamptz,
  status       text not null default 'started'
                 check (status in ('started','progress','completed','failed','skipped')),
  output       jsonb,
  error        jsonb,
  retries      integer not null default 0
);

create index if not exists idx_routine_run_steps_run on public.routine_run_steps (run_id, started_at);

-- ── 6. routine_approvals ──────────────────────────────────────────────────
create table if not exists public.routine_approvals (
  id           uuid primary key default gen_random_uuid(),
  run_id       uuid not null references public.routine_runs(id) on delete cascade,
  step_id      uuid not null references public.routine_steps(id) on delete cascade,
  requested_at timestamptz not null default now(),
  decided_at   timestamptz,
  decided_by   uuid,
  decision     text check (decision in ('approve','deny','defer')),
  notes        text
);

create index if not exists idx_routine_approvals_pending
  on public.routine_approvals (run_id)
  where decision is null;

-- ── 7. routine_agents_map ─────────────────────────────────────────────────
-- Soft-FK naar bestaande agent registries (acq_agent_registry, executive_agents, etc.)
-- We doen GEEN harde FK omdat de bron-tabellen verschillende key-types hebben.
create table if not exists public.routine_agents_map (
  routine_id    uuid not null references public.routines(id) on delete cascade,
  agent_source  text not null
                  check (agent_source in ('acq','executive','youtube','mail','watchdog','claude','local','planning')),
  agent_key     text not null,
  primary key (routine_id, agent_source, agent_key)
);

create index if not exists idx_routine_agents_map_source
  on public.routine_agents_map (agent_source, agent_key);

-- ── 8. routine_autopilot_config (per-routine human override) ──────────────
create table if not exists public.routine_autopilot_config (
  routine_id              uuid primary key references public.routines(id) on delete cascade,
  auto_recover            boolean not null default false,
  auto_escalate           boolean not null default true,
  auto_approve_threshold  numeric,
  updated_at              timestamptz not null default now(),
  updated_by              uuid
);

-- ── 9. routine_audit_log (IMMUTABLE) ──────────────────────────────────────
create table if not exists public.routine_audit_log (
  id          bigserial primary key,
  routine_id  uuid,
  run_id      uuid,
  action      text not null,
  actor       text not null check (actor in ('ai','user','system')),
  actor_id    uuid,
  detail      jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists idx_routine_audit_routine
  on public.routine_audit_log (routine_id, created_at desc);
create index if not exists idx_routine_audit_action
  on public.routine_audit_log (action);

-- PG RULE: blokkeer UPDATE en DELETE op audit log (pattern uit mail_audit_log)
create or replace rule routine_audit_log_no_update as
  on update to public.routine_audit_log do instead nothing;
create or replace rule routine_audit_log_no_delete as
  on delete to public.routine_audit_log do instead nothing;

-- ── 10. ALTER orchestrator_tasks: trace-link naar routine_runs ───────────
alter table public.orchestrator_tasks
  add column if not exists triggered_by_routine_run_id uuid
    references public.routine_runs(id) on delete set null;

create index if not exists idx_orchestrator_tasks_routine_run
  on public.orchestrator_tasks (triggered_by_routine_run_id)
  where triggered_by_routine_run_id is not null;

-- ── 11. v_system_health (meta-supervisor health view) ────────────────────
create or replace view public.v_system_health as
-- Acquisition agents (8 stuks uit acq_agent_registry)
select
  'acq'::text                        as source,
  a.id::text                         as id,
  a.name                             as label,
  a.agent_type                       as kind,
  a.status                           as status,
  a.last_heartbeat                   as last_seen,
  a.tasks_done                       as ok_count,
  a.tasks_failed                     as fail_count,
  null::text                         as note
from public.acq_agent_registry a
union all
-- Executive LLM agents (ATLAS + 5 specialisten)
select
  'executive'::text,
  e.id::text,
  e.name,
  e.role_persona,
  case when e.enabled then coalesce(e.last_run_status,'idle') else 'disabled' end,
  e.last_run_at,
  0, 0,
  e.model
from public.executive_agents e
union all
-- Watchdog services (Render + local) — laatste event per service binnen 1 uur
select
  'watchdog'::text,
  w.service_id,
  w.service_name,
  w.service_type,
  coalesce(w.deploy_status, w.kind),
  w.created_at,
  0, 0,
  w.message
from (
  select distinct on (service_id) *
  from public.infra_watchdog_events
  where created_at > now() - interval '1 hour'
  order by service_id, created_at desc
) w
union all
-- Orchestrator queue depth per executor
select
  'orchestrator'::text,
  ot.executor,
  ot.executor,
  'queue',
  case
    when ot.queue_open > 50 then 'overloaded'
    when ot.queue_open > 10 then 'busy'
    when ot.queue_open  > 0 then 'idle'
    else 'empty'
  end,
  null::timestamptz,
  ot.queue_done,
  ot.queue_failed,
  format('open=%s running=%s', ot.queue_open, ot.queue_running)
from (
  select
    executor,
    count(*) filter (where status = 'open')    as queue_open,
    count(*) filter (where status = 'running') as queue_running,
    count(*) filter (where status = 'done')    as queue_done,
    count(*) filter (where status = 'failed')  as queue_failed
  from public.orchestrator_tasks
  group by executor
) ot
union all
-- Routine runs counts per status (huidige periode)
select
  'routines'::text,
  rr.status,
  initcap(replace(rr.status,'_',' ')),
  'runs',
  rr.status,
  rr.last_at,
  rr.cnt,
  0,
  null
from (
  select status, count(*) as cnt, max(started_at) as last_at
  from public.routine_runs
  where started_at > now() - interval '24 hours'
  group by status
) rr;

comment on view public.v_system_health is
  'Meta-supervisor: één view voor alle agent/queue/runner health-signalen.
   Bronnen: acq_agent_registry, executive_agents, infra_watchdog_events (<1h),
   orchestrator_tasks queue-depth per executor, routine_runs counts per status (<24h).';

-- ── 12. routines_dispatch_cron_triggers() — pg_cron scheduler ────────────
-- Wordt elke minuut aangeroepen. Voor elke enabled cron-trigger waarvan
-- next_run_at <= now(), enqueue een routine_runs rij en bereken next_run_at.
-- Cron-parsing in plpgsql is beperkt; we ondersteunen alleen velden van
-- cron-expressies die we kunnen evalueren via `next_run_at` als precomputed
-- veld (de UI / server actions berekenen next_run_at bij save met cron-parser
-- in TypeScript). Deze functie is dus puur de "fire if due" dispatcher.
create or replace function public.routines_dispatch_cron_triggers()
returns integer language plpgsql security definer as $$
declare
  v_fired integer := 0;
  v_trig  record;
begin
  for v_trig in
    select t.id, t.routine_id, t.config
    from public.routine_triggers t
    join public.routines r on r.id = t.routine_id
    where t.kind = 'cron'
      and t.enabled
      and r.status = 'active'
      and t.next_run_at is not null
      and t.next_run_at <= now()
    for update of t skip locked
  loop
    insert into public.routine_runs (routine_id, status, trigger_kind, trigger_payload)
    values (v_trig.routine_id, 'queued', 'cron',
            jsonb_build_object('trigger_id', v_trig.id, 'config', v_trig.config));

    -- next_run_at wordt door de UI bij save bijgewerkt op basis van cron-expressie;
    -- de scheduler-tick verschuift hem 60s zodat we niet dubbel firen vóór UI-update
    update public.routine_triggers
      set last_run_at = now(),
          next_run_at = next_run_at + interval '1 minute'
    where id = v_trig.id;

    v_fired := v_fired + 1;
  end loop;

  return v_fired;
end$$;

-- ── 13. routines_health_sweep() — markeer stale runs als failed ──────────
create or replace function public.routines_health_sweep()
returns integer language plpgsql security definer as $$
declare
  v_swept integer;
begin
  with stale as (
    update public.routine_runs
       set status = 'failed',
           ended_at = now(),
           error = jsonb_build_object(
             'reason', 'stale_heartbeat',
             'last_heartbeat_at', heartbeat_at,
             'detected_at', now()
           )
     where status = 'running'
       and (heartbeat_at is null or heartbeat_at < now() - interval '30 minutes')
       and started_at < now() - interval '30 minutes'
    returning id
  )
  select count(*) into v_swept from stale;

  return v_swept;
end$$;

-- ── 14. pg_cron schedule: dispatch + sweep ───────────────────────────────
-- Verwijder eventuele oude schedules (idempotent)
do $$
begin
  if exists (select 1 from cron.job where jobname = 'routines_dispatch_cron') then
    perform cron.unschedule('routines_dispatch_cron');
  end if;
  if exists (select 1 from cron.job where jobname = 'routines_health_sweep') then
    perform cron.unschedule('routines_health_sweep');
  end if;
end$$;

select cron.schedule(
  'routines_dispatch_cron',
  '* * * * *',
  $cron$ select public.routines_dispatch_cron_triggers(); $cron$
);

select cron.schedule(
  'routines_health_sweep',
  '*/5 * * * *',
  $cron$ select public.routines_health_sweep(); $cron$
);

-- ── 15. RLS (service_role full access, authenticated read-only) ──────────
do $$
declare
  t text;
begin
  for t in select unnest(array[
    'routines','routine_steps','routine_triggers','routine_runs','routine_run_steps',
    'routine_approvals','routine_agents_map','routine_autopilot_config','routine_audit_log'
  ])
  loop
    execute format('alter table public.%I enable row level security', t);

    execute format(
      'drop policy if exists %I on public.%I',
      t || '_service_all', t
    );
    execute format(
      'create policy %I on public.%I for all to service_role using (true) with check (true)',
      t || '_service_all', t
    );

    execute format(
      'drop policy if exists %I on public.%I',
      t || '_authenticated_read', t
    );
    execute format(
      'create policy %I on public.%I for select to authenticated using (true)',
      t || '_authenticated_read', t
    );
  end loop;
end$$;

-- ── 16. Grant view-access voor authenticated ─────────────────────────────
grant select on public.v_system_health to authenticated, anon, service_role;
