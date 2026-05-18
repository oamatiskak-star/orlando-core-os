-- 035_orchestrator.sql
-- Priority Task Orchestration Engine — schema
-- Geen DROPs van bestaande structuren. Alle CREATEs zijn IF NOT EXISTS.
-- Bestaande tabellen blijven onaangetast.

create extension if not exists pgcrypto;

-- ─────────────────────────────────────────────────────────────────────────────
-- orchestrator_tasks: hoofdtabel voor de priority task engine
-- Priority: 1 = hoogst, 10 = laagst.
-- Bands worden afgeleid via generated column priority_band.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.orchestrator_tasks (
  id                    uuid primary key default gen_random_uuid(),
  company_id            text not null,
  title                 text not null,
  task_type             text,
  project               text,

  -- Execution selection
  executor              text not null default 'anthropic'
                          check (executor in ('claude-code','anthropic','shell')),
  allowed_actions       jsonb not null default '[]'::jsonb,

  -- Priority & queue state
  priority              integer not null default 5
                          check (priority between 1 and 10),
  priority_band         text generated always as (
                          case
                            when priority <= 3 then 'hoog'
                            when priority <= 6 then 'normaal'
                            else 'laag'
                          end
                        ) stored,
  status                text not null default 'open'
                          check (status in (
                            'open','running','completed',
                            'failed','retry','waiting','paused'
                          )),

  -- Behavior flags
  interruptible         boolean not null default true,
  requires_confirmation boolean not null default false,
  safe_mode             boolean not null default true,
  background_task       boolean not null default false,
  system_critical       boolean not null default false,
  estimated_runtime     text not null default 'medium'
                          check (estimated_runtime in ('fast','medium','long')),

  -- Task contract (uit user-spec)
  objective             jsonb not null default '[]'::jsonb,
  success_condition     jsonb not null default '[]'::jsonb,
  notes                 jsonb not null default '[]'::jsonb,
  payload               jsonb not null default '{}'::jsonb,

  -- Escalation
  escalation_question   text,
  escalation_response   jsonb,
  parent_task_id        uuid references public.orchestrator_tasks(id) on delete set null,

  -- Pause/resume
  paused_state          jsonb,

  -- Execution bookkeeping
  worker_id             text,
  attempts              integer not null default 0,
  max_attempts          integer not null default 3,
  run_at                timestamptz not null default now(),
  started_at            timestamptz,
  finished_at           timestamptz,
  error                 text,

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  created_by            uuid references auth.users(id) on delete set null
);

create index if not exists idx_orch_tasks_claim
  on public.orchestrator_tasks (priority, run_at)
  where status in ('open','retry');

create index if not exists idx_orch_tasks_band
  on public.orchestrator_tasks (priority_band, status);

create index if not exists idx_orch_tasks_company
  on public.orchestrator_tasks (company_id, status);

create index if not exists idx_orch_tasks_parent
  on public.orchestrator_tasks (parent_task_id)
  where parent_task_id is not null;

-- updated_at trigger
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists trg_orch_tasks_touch on public.orchestrator_tasks;
create trigger trg_orch_tasks_touch
  before update on public.orchestrator_tasks
  for each row execute function public.touch_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- task_logs / task_errors — per-task audit trail
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.orchestrator_task_logs (
  id          uuid primary key default gen_random_uuid(),
  task_id     uuid not null references public.orchestrator_tasks(id) on delete cascade,
  level       text not null check (level in ('debug','info','warn','error')),
  message     text not null,
  payload     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists idx_orch_logs_task on public.orchestrator_task_logs(task_id, created_at);

create table if not exists public.orchestrator_task_errors (
  id                 uuid primary key default gen_random_uuid(),
  task_id            uuid not null references public.orchestrator_tasks(id) on delete cascade,
  error_class        text,
  message            text not null,
  stack_trace        text,
  recovery_attempted boolean not null default false,
  recovered          boolean not null default false,
  created_at         timestamptz not null default now()
);
create index if not exists idx_orch_errors_task on public.orchestrator_task_errors(task_id, created_at);

-- ─────────────────────────────────────────────────────────────────────────────
-- task_memory — persistente knowledge base (F3 gebruikt dit)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.orchestrator_memory (
  scope       text not null default 'global',
  key         text not null,
  value       jsonb not null,
  updated_at  timestamptz not null default now(),
  updated_by  text,
  primary key (scope, key)
);

drop trigger if exists trg_orch_memory_touch on public.orchestrator_memory;
create trigger trg_orch_memory_touch
  before update on public.orchestrator_memory
  for each row execute function public.touch_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- worker_heartbeats — observability voor F2 executor instances
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.orchestrator_workers (
  worker_id        text primary key,
  hostname         text,
  last_seen        timestamptz not null default now(),
  status           text not null default 'idle'
                     check (status in ('idle','busy','paused','offline')),
  current_task_id  uuid references public.orchestrator_tasks(id) on delete set null,
  cpu_pct          numeric,
  ram_mb           numeric,
  meta             jsonb not null default '{}'::jsonb
);
create index if not exists idx_orch_workers_last_seen on public.orchestrator_workers(last_seen);

-- ─────────────────────────────────────────────────────────────────────────────
-- system events — watchdog signals (F3)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.orchestrator_events (
  id          uuid primary key default gen_random_uuid(),
  type        text not null,
  severity    text not null default 'info'
                check (severity in ('info','warn','error','critical')),
  task_id     uuid references public.orchestrator_tasks(id) on delete set null,
  worker_id   text,
  payload     jsonb not null default '{}'::jsonb,
  resolved    boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists idx_orch_events_unresolved
  on public.orchestrator_events(created_at desc)
  where resolved = false;

-- ─────────────────────────────────────────────────────────────────────────────
-- task_claim RPC — atomic claim met FOR UPDATE SKIP LOCKED
-- Vervangt de race in sterkbouw-saas-executor/ao.js.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.orchestrator_task_claim(
  p_worker_id text,
  p_max       integer default 1
)
returns setof public.orchestrator_tasks
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  update public.orchestrator_tasks q
     set status     = 'running',
         worker_id  = p_worker_id,
         started_at = now(),
         attempts   = q.attempts + 1
   where q.id in (
     select id
       from public.orchestrator_tasks
      where status in ('open','retry')
        and run_at <= now()
      order by priority asc, run_at asc
      for update skip locked
      limit greatest(p_max, 1)
   )
   returning q.*;
end
$$;

grant execute on function public.orchestrator_task_claim(text, integer) to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- system state RPC — counters voor dashboard widgets (geen mock data nodig)
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.orchestrator_system_state(p_company_id text default null)
returns table (
  band   text,
  status text,
  count  bigint
)
language sql
stable
as $$
  select priority_band as band,
         status,
         count(*)::bigint as count
    from public.orchestrator_tasks
   where (p_company_id is null or company_id = p_company_id)
   group by priority_band, status
$$;

grant execute on function public.orchestrator_system_state(text) to authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS — multi-tenant via company_id, service_role bypass
-- Authenticated users zien alleen rijen voor companies waar ze toegang toe hebben.
-- Voor F1: simpele policy = authenticated mag alles in zijn eigen rijen lezen
-- (write blijft via service-role of /api/orchestrator/*).
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.orchestrator_tasks         enable row level security;
alter table public.orchestrator_task_logs     enable row level security;
alter table public.orchestrator_task_errors   enable row level security;
alter table public.orchestrator_memory        enable row level security;
alter table public.orchestrator_workers       enable row level security;
alter table public.orchestrator_events        enable row level security;

drop policy if exists orch_tasks_auth_read  on public.orchestrator_tasks;
create policy orch_tasks_auth_read on public.orchestrator_tasks
  for select to authenticated using (true);

drop policy if exists orch_logs_auth_read   on public.orchestrator_task_logs;
create policy orch_logs_auth_read on public.orchestrator_task_logs
  for select to authenticated using (true);

drop policy if exists orch_errors_auth_read on public.orchestrator_task_errors;
create policy orch_errors_auth_read on public.orchestrator_task_errors
  for select to authenticated using (true);

drop policy if exists orch_memory_auth_read on public.orchestrator_memory;
create policy orch_memory_auth_read on public.orchestrator_memory
  for select to authenticated using (true);

drop policy if exists orch_workers_auth_read on public.orchestrator_workers;
create policy orch_workers_auth_read on public.orchestrator_workers
  for select to authenticated using (true);

drop policy if exists orch_events_auth_read on public.orchestrator_events;
create policy orch_events_auth_read on public.orchestrator_events
  for select to authenticated using (true);

-- Realtime publication voor dashboard widgets
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    return;
  end if;
  begin
    execute 'alter publication supabase_realtime add table public.orchestrator_tasks';
  exception when duplicate_object then null; end;
  begin
    execute 'alter publication supabase_realtime add table public.orchestrator_workers';
  exception when duplicate_object then null; end;
  begin
    execute 'alter publication supabase_realtime add table public.orchestrator_events';
  exception when duplicate_object then null; end;
end $$;
