-- 098_worker_control.sql
-- Worker Control Center (OpenClaw) — command/actuation laag op worker_registry.
-- Dashboard schrijft desired_state / restart_requested_at; de local-watchdog
-- (PM2 fleet self-healer) leest deze kolommen, voert de echte pm2 actie uit en
-- schrijft het resultaat terug. Volledig idempotent.

alter table public.worker_registry
  add column if not exists desired_state        text        not null default 'running',
  add column if not exists restart_requested_at timestamptz,
  add column if not exists pm2_name             text,
  add column if not exists controllable         boolean     not null default true,
  add column if not exists last_command         text,
  add column if not exists last_command_at      timestamptz,
  add column if not exists last_command_by       text,
  add column if not exists last_command_result  text;

-- Borg geldige waarden voor desired_state.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'worker_registry_desired_state_chk'
  ) then
    alter table public.worker_registry
      add constraint worker_registry_desired_state_chk
      check (desired_state in ('running', 'stopped'));
  end if;
end $$;

-- Workers op host 'render' zijn niet lokaal via PM2 te besturen.
update public.worker_registry
   set controllable = false
 where controllable is true
   and coalesce(host, '') = 'render';

-- Index zodat de watchdog snel pending commando's vindt.
create index if not exists idx_worker_registry_pending_cmd
  on public.worker_registry (restart_requested_at)
  where restart_requested_at is not null;
