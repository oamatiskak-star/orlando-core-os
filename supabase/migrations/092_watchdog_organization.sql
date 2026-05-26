-- Organization watchdog: extends infra_watchdog (Render/PM2 infra layer)
-- with an application/workflow layer. Adds a check registry, per-run results,
-- and a heartbeat table so engines, crons and scrapers can self-report.
--
-- Incidents from check failures reuse the existing infra_watchdog_incidents
-- table with deploy_id = 'check:<slug>:<epoch_ms>' (same pattern local-watchdog
-- uses for PM2 crash-loops) so dashboards + Telegram pipeline stay unified.

create table if not exists public.infra_watchdog_checks (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  display_name text not null,
  check_type text not null check (check_type in (
    'http_ping','heartbeat','queue_depth','data_freshness','cron_lateness'
  )),
  layer text not null default 'app' check (layer in ('infra','app','data','content','external')),
  category text,
  config jsonb not null default '{}'::jsonb,
  threshold jsonb not null default '{}'::jsonb,
  interval_seconds int not null default 300,
  consecutive_failures_to_escalate int not null default 3,
  enabled boolean not null default true,
  severity text not null default 'error' check (severity in ('warning','error','critical')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists infra_watchdog_checks_enabled_idx
  on public.infra_watchdog_checks (enabled, check_type);
create index if not exists infra_watchdog_checks_layer_idx
  on public.infra_watchdog_checks (layer, category);

create table if not exists public.infra_watchdog_check_runs (
  id bigserial primary key,
  check_id uuid not null references public.infra_watchdog_checks(id) on delete cascade,
  ok boolean not null,
  latency_ms int,
  value numeric,
  message text,
  metadata jsonb,
  ran_at timestamptz not null default now()
);

create index if not exists infra_watchdog_check_runs_check_idx
  on public.infra_watchdog_check_runs (check_id, ran_at desc);
create index if not exists infra_watchdog_check_runs_ok_idx
  on public.infra_watchdog_check_runs (ok, ran_at desc);

-- Heartbeats: a tiny pub/sub style table. Any engine/cron upserts its slug
-- whenever it completes a unit of work; watchdog reads `last_seen_at` and
-- compares against the matching check threshold.
create table if not exists public.infra_watchdog_heartbeats (
  slug text primary key,
  last_seen_at timestamptz not null default now(),
  status text not null default 'ok',
  meta jsonb,
  updated_at timestamptz not null default now()
);

-- Tag check-derived incidents so the dashboard can render them differently
alter table public.infra_watchdog_incidents
  add column if not exists check_slug text;
alter table public.infra_watchdog_incidents
  add column if not exists incident_kind text not null default 'deploy_failure';

create index if not exists infra_watchdog_incidents_check_idx
  on public.infra_watchdog_incidents (check_slug, status);

alter table public.infra_watchdog_checks enable row level security;
alter table public.infra_watchdog_check_runs enable row level security;
alter table public.infra_watchdog_heartbeats enable row level security;

drop policy if exists infra_watchdog_checks_service_role on public.infra_watchdog_checks;
create policy infra_watchdog_checks_service_role on public.infra_watchdog_checks
  for all to service_role using (true) with check (true);
drop policy if exists infra_watchdog_checks_auth_read on public.infra_watchdog_checks;
create policy infra_watchdog_checks_auth_read on public.infra_watchdog_checks
  for select to authenticated using (true);

drop policy if exists infra_watchdog_check_runs_service_role on public.infra_watchdog_check_runs;
create policy infra_watchdog_check_runs_service_role on public.infra_watchdog_check_runs
  for all to service_role using (true) with check (true);
drop policy if exists infra_watchdog_check_runs_auth_read on public.infra_watchdog_check_runs;
create policy infra_watchdog_check_runs_auth_read on public.infra_watchdog_check_runs
  for select to authenticated using (true);

drop policy if exists infra_watchdog_heartbeats_service_role on public.infra_watchdog_heartbeats;
create policy infra_watchdog_heartbeats_service_role on public.infra_watchdog_heartbeats
  for all to service_role using (true) with check (true);
drop policy if exists infra_watchdog_heartbeats_auth_read on public.infra_watchdog_heartbeats;
create policy infra_watchdog_heartbeats_auth_read on public.infra_watchdog_heartbeats
  for select to authenticated using (true);

alter publication supabase_realtime add table public.infra_watchdog_checks;
alter publication supabase_realtime add table public.infra_watchdog_check_runs;
alter publication supabase_realtime add table public.infra_watchdog_heartbeats;
