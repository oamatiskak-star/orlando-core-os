-- Add host_id to watchdog tables so local-watchdog (PM2 on Mac Minis) can
-- share the same observability surface as the Render-side watchdog without
-- collisions on incident keys.

alter table public.infra_watchdog_events
  add column if not exists host_id text not null default 'render';

alter table public.infra_watchdog_incidents
  add column if not exists host_id text not null default 'render';

-- Switch incidents PK from (deploy_id) -> (host_id, deploy_id). For local
-- crash-loops, deploy_id is reused as an `incident_key` of the form
-- `<host>:pm2:<app>:<epoch_ms>`, so per-host uniqueness is required.
alter table public.infra_watchdog_incidents
  drop constraint if exists infra_watchdog_incidents_pkey;

alter table public.infra_watchdog_incidents
  add constraint infra_watchdog_incidents_pkey primary key (host_id, deploy_id);

create index if not exists infra_watchdog_events_host_idx
  on public.infra_watchdog_events (host_id, created_at desc);

create index if not exists infra_watchdog_incidents_host_idx
  on public.infra_watchdog_incidents (host_id, status, opened_at desc);
