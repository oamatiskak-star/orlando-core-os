-- Watchdog engine: events log + open incidents
-- Used by orlando-watchdog Render service to track Render fleet recovery actions.

create table if not exists public.infra_watchdog_events (
  id uuid primary key default gen_random_uuid(),
  service_id text not null,
  service_name text not null,
  service_type text not null,
  kind text not null,
  deploy_id text,
  deploy_status text,
  attempt int,
  message text,
  logs_tail text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists infra_watchdog_events_service_idx
  on public.infra_watchdog_events (service_id, created_at desc);
create index if not exists infra_watchdog_events_kind_idx
  on public.infra_watchdog_events (kind, created_at desc);

create table if not exists public.infra_watchdog_incidents (
  deploy_id text primary key,
  service_id text not null,
  service_name text not null,
  service_type text not null,
  failure_kind text not null,
  failure_summary text,
  logs_tail text,
  commit_sha text,
  commit_message text,
  attempts_made int not null default 0,
  proposed_actions jsonb,
  status text not null default 'open' check (status in ('open','acknowledged','resolved')),
  opened_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists infra_watchdog_incidents_status_idx
  on public.infra_watchdog_incidents (status, opened_at desc);

alter table public.infra_watchdog_events enable row level security;
alter table public.infra_watchdog_incidents enable row level security;

drop policy if exists infra_watchdog_events_service_role on public.infra_watchdog_events;
create policy infra_watchdog_events_service_role on public.infra_watchdog_events
  for all to service_role using (true) with check (true);

drop policy if exists infra_watchdog_incidents_service_role on public.infra_watchdog_incidents;
create policy infra_watchdog_incidents_service_role on public.infra_watchdog_incidents
  for all to service_role using (true) with check (true);
