-- 099_storage_control.sql
-- Storage Control Center — status/heartbeat + command-laag voor de storage-guard
-- in de local-watchdog (CLI-R/CLI-L). Watchdog (service_role) schrijft status en
-- consumeert commando's; dashboard (authenticated) leest status en zet commando's.
-- Spiegelt het worker_registry/worker-control patroon (migratie 098).

-- ── Per-host storage status (één rij per host, geüpsert door de watchdog) ──
create table if not exists public.host_storage_status (
  host_id            text        primary key,
  disk_pct           int,
  free_gb            numeric,
  used_gb            numeric,
  size_gb            numeric,
  docker_raw_gb      numeric,
  tier               text,            -- ok | warning | aggressive | emergency
  last_actions       jsonb       not null default '[]'::jsonb,
  last_truncated     jsonb       not null default '[]'::jsonb,
  reclaimed_gb_total numeric     not null default 0,
  last_error         text,
  updated_at         timestamptz not null default now()
);

-- ── Command-queue (dashboard-knoppen → watchdog) ──
create table if not exists public.storage_commands (
  id           uuid        primary key default gen_random_uuid(),
  host_id      text        not null,
  command      text        not null,
  status       text        not null default 'pending',
  requested_by text        not null default 'dashboard',
  requested_at timestamptz not null default now(),
  started_at   timestamptz,
  finished_at  timestamptz,
  result       text
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'storage_commands_command_chk') then
    alter table public.storage_commands
      add constraint storage_commands_command_chk
      check (command in ('run-cleanup','aggressive-cleanup','emergency-cleanup','reclaim-space','restart-docker'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'storage_commands_status_chk') then
    alter table public.storage_commands
      add constraint storage_commands_status_chk
      check (status in ('pending','running','done','error'));
  end if;
end $$;

-- Index zodat de watchdog snel pending commando's per host vindt.
create index if not exists idx_storage_commands_pending
  on public.storage_commands (host_id, requested_at)
  where status = 'pending';

-- ── RLS: authenticated leest/schrijft; service_role (watchdog) bypasst RLS ──
alter table public.host_storage_status enable row level security;
alter table public.storage_commands    enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'host_storage_status' and policyname = 'host_storage_status_auth_all') then
    create policy host_storage_status_auth_all on public.host_storage_status
      for all to authenticated using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'storage_commands' and policyname = 'storage_commands_auth_all') then
    create policy storage_commands_auth_all on public.storage_commands
      for all to authenticated using (true) with check (true);
  end if;
end $$;
