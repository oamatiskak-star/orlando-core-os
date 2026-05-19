-- Infrastructure worker heartbeats from CLI-R monitoring agent
create table if not exists infra_workers (
  id           uuid        primary key default gen_random_uuid(),
  worker_id    text        not null unique,
  node         text        not null default 'cli-r',
  status       text        not null default 'online'
                           check (status in ('online', 'offline', 'degraded')),
  cpu_pct      numeric(5,2),
  ram_mb       int,
  ram_total_mb int,
  queue_depth  int         not null default 0,
  jobs_done    int         not null default 0,
  jobs_failed  int         not null default 0,
  last_error   text,
  version      text,
  updated_at   timestamptz not null default now()
);

create index if not exists idx_infra_workers_node   on infra_workers(node);
create index if not exists idx_infra_workers_status on infra_workers(status);

-- Realtime subscription for dashboard live updates
alter publication supabase_realtime add table infra_workers;

comment on table infra_workers is 'Live CLI-R worker metrics — updated every 30s by monitoring-agent';
