-- ============================================================================
-- Migration 104: Hermes Init — schema + foundation tables
-- ============================================================================
-- Project: Hermes Integration (orlando-core-os)
-- Datum:   2026-05-28 (draft)
-- Auteur:  Orlando + Hermes plan
--
-- COORDINATIE-VEREIST VÓÓR DEPLOY:
--   1. Supabase service_role JWT rotation (memory: project_supabase_key_rotation_pending)
--      → roteer EERST, deploy migratie 104 met nieuwe key in Render/Vercel envs.
--   2. Geen wijziging op public.* tabellen behalve nieuwe view project_sections (R04).
--   3. Bestaande RLS-policies blijven onaangetast.
--
-- ROLLBACK: zie laatste sectie. DROP SCHEMA hermes CASCADE + DROP VIEW.
-- ============================================================================

create schema if not exists hermes;

comment on schema hermes is
  'Hermes orchestration/memory/watchdog layer. Additief, observer-first. Niet vervangen van bestaande flows.';

-- ----------------------------------------------------------------------------
-- 1. SUBAGENTS REGISTRY
--    Elke subagent registreert zich at-boot. healthcheck() schrijft naar
--    agent_state.last_heartbeat_at. status werpt warning bij stale heartbeat.
-- ----------------------------------------------------------------------------
create table hermes.subagents (
  id              uuid primary key default gen_random_uuid(),
  name            text not null unique,
  kind            text not null,            -- 'scheduler' | 'monitor' | 'bridge' | 'supervisor' | 'ops'
  description     text,
  schedule        text,                     -- cron expression OR 'realtime' OR 'event-driven'
  enabled         boolean not null default true,
  max_memory_mb   integer not null default 512,
  config          jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index hermes_subagents_enabled_idx on hermes.subagents (enabled) where enabled;

-- ----------------------------------------------------------------------------
-- 2. AGENT STATE (per-subagent runtime, 1-op-1)
-- ----------------------------------------------------------------------------
create table hermes.agent_state (
  subagent_id         uuid primary key references hermes.subagents(id) on delete cascade,
  status              text not null default 'starting'
                        check (status in ('starting','running','degraded','paused','stopped','crashed')),
  last_heartbeat_at   timestamptz,
  last_tick_at        timestamptz,
  current_task_id     uuid,
  error_count_24h     integer not null default 0,
  metrics             jsonb not null default '{}'::jsonb,   -- {cpu, mem, tasks_processed, ...}
  updated_at          timestamptz not null default now()
);

create index hermes_agent_state_status_idx on hermes.agent_state (status);

-- ----------------------------------------------------------------------------
-- 3. MEMORY (key/value, optional embedding for semantic recall, TTL)
-- ----------------------------------------------------------------------------
create table hermes.memory (
  id              uuid primary key default gen_random_uuid(),
  scope           text not null,            -- bv. 'agent:whatsapp-bridge', 'global', 'company:modiwe-media'
  key             text not null,
  value           jsonb not null,
  embedding_dim   integer,                  -- nullable; vector kolom toegevoegd in latere migratie indien pgvector aan
  importance      smallint not null default 5 check (importance between 1 and 10),
  expires_at      timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (scope, key)
);

create index hermes_memory_scope_idx on hermes.memory (scope);
create index hermes_memory_expires_idx on hermes.memory (expires_at) where expires_at is not null;

-- ----------------------------------------------------------------------------
-- 4. SKILLS (herbruikbare actie-modules, versioned + checksummed)
-- ----------------------------------------------------------------------------
create table hermes.skills (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  version         text not null,
  checksum        text not null,            -- sha256 van skill-implementatie
  description     text,
  input_schema    jsonb,                    -- JSONSchema
  output_schema   jsonb,
  enabled         boolean not null default true,
  created_at      timestamptz not null default now(),
  unique (name, version)
);

-- ----------------------------------------------------------------------------
-- 5. SESSIONS (LLM-token + cost tracking, één bron van waarheid)
-- ----------------------------------------------------------------------------
create table hermes.sessions (
  id                  uuid primary key default gen_random_uuid(),
  subagent_id         uuid references hermes.subagents(id) on delete set null,
  company_slug        text,                                 -- voor cost-allocatie per BV
  model               text not null,                        -- 'claude-opus-4-7', 'claude-sonnet-4-6', ...
  started_at          timestamptz not null default now(),
  ended_at            timestamptz,
  input_tokens        bigint not null default 0,
  output_tokens       bigint not null default 0,
  cache_read_tokens   bigint not null default 0,
  cache_write_tokens  bigint not null default 0,
  cost_usd_total      numeric(12,6) not null default 0,
  status              text not null default 'active'
                        check (status in ('active','completed','aborted','timed_out')),
  context             jsonb not null default '{}'::jsonb,
  notes               text
);

create index hermes_sessions_subagent_idx on hermes.sessions (subagent_id, started_at desc);
create index hermes_sessions_company_idx on hermes.sessions (company_slug, started_at desc);

-- ----------------------------------------------------------------------------
-- 6. DECISIONS (audit-log voor elke beslissing met reden + alternatieven)
-- ----------------------------------------------------------------------------
create table hermes.decisions (
  id              uuid primary key default gen_random_uuid(),
  subagent_id     uuid references hermes.subagents(id) on delete set null,
  session_id      uuid references hermes.sessions(id) on delete set null,
  kind            text not null,            -- 'auto_recovery' | 'escalation' | 'route_select' | 'user_choice' | 'security'
  subject         text not null,
  decision        text not null,
  reason          text not null,
  alternatives    jsonb not null default '[]'::jsonb,
  outcome         text,                     -- 'success' | 'failed' | 'pending'
  outcome_at      timestamptz,
  created_at      timestamptz not null default now()
);

create index hermes_decisions_kind_idx on hermes.decisions (kind, created_at desc);
create index hermes_decisions_subagent_idx on hermes.decisions (subagent_id, created_at desc);

-- ----------------------------------------------------------------------------
-- 7. LOGS (gepartitioneerd per maand, structured)
--    PK = (id, created_at) — partition key verplicht in unique constraint.
-- ----------------------------------------------------------------------------
create table hermes.logs (
  id              bigint generated always as identity,
  subagent_id     uuid,
  session_id      uuid,
  level           text not null check (level in ('debug','info','warn','error','fatal')),
  event           text not null,
  message         text,
  context         jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  primary key (id, created_at)
) partition by range (created_at);

-- 12 maanden vooruit-seeded (mei 2026 t/m april 2027). Subagent #1 maakt vanaf
-- maart 2027 nieuwe partities aan (pg_cron maandelijks). Bij missen → inserts
-- vallen terug op default-partition (zie laatste).
do $$
declare
  m int;
  start_dt date;
  end_dt date;
  pname text;
begin
  for m in 0..11 loop
    start_dt := (date '2026-05-01' + (m || ' months')::interval)::date;
    end_dt   := (start_dt + interval '1 month')::date;
    pname    := format('logs_%s', to_char(start_dt, 'YYYY_MM'));
    execute format(
      'create table if not exists hermes.%I partition of hermes.logs for values from (%L) to (%L);',
      pname, start_dt, end_dt
    );
  end loop;
end $$;

-- Default-partition vangt inserts op buiten gedefinieerde range (anders 23514 error).
create table if not exists hermes.logs_default partition of hermes.logs default;

create index hermes_logs_subagent_idx on hermes.logs (subagent_id, created_at desc);
create index hermes_logs_level_idx on hermes.logs (level, created_at desc);

-- Sliding window: maandelijks 6 maanden vooruit partities zekerstellen
-- (belt-and-suspenders bovenop 12-mnd seed + default partition).
create or replace function hermes.ensure_logs_partitions()
returns integer language plpgsql security definer
set search_path = hermes, pg_catalog as $$
declare
  m int;
  start_dt date;
  end_dt   date;
  pname    text;
  created  int := 0;
begin
  for m in 0..5 loop
    start_dt := date_trunc('month', now() + (m || ' months')::interval)::date;
    end_dt   := (start_dt + interval '1 month')::date;
    pname    := format('logs_%s', to_char(start_dt, 'YYYY_MM'));
    if not exists (
      select 1 from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'hermes' and c.relname = pname
    ) then
      execute format(
        'create table hermes.%I partition of hermes.logs for values from (%L) to (%L);',
        pname, start_dt, end_dt
      );
      created := created + 1;
    end if;
  end loop;
  return created;
end $$;

-- pg_cron schedule: 5 min na middernacht, 1e van de maand.
-- pg_cron vereist superuser; in Supabase wordt schema 'cron' automatisch beheerd.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    begin
      perform cron.unschedule('hermes_ensure_logs_partitions');
    exception when others then null;
    end;
    perform cron.schedule(
      'hermes_ensure_logs_partitions',
      '5 0 1 * *',
      $cron$ select hermes.ensure_logs_partitions(); $cron$
    );
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- 8. SYSTEM_HEALTH (1-min snapshots, gebruikt door dashboard + alert-evaluatie)
-- ----------------------------------------------------------------------------
create table hermes.system_health (
  taken_at            timestamptz primary key default now(),
  cli_l_load          numeric(5,2),         -- CPU% laatste minuut
  cli_l_mem_mb        integer,
  cli_r_load          numeric(5,2),
  cli_r_mem_mb        integer,
  render_services_up  integer,
  render_services_total integer,
  supabase_p95_ms     integer,
  queue_depths        jsonb not null default '{}'::jsonb,   -- {youtube_upload_queue: 12, routine_runs: 0, ...}
  escalations_open    integer not null default 0,
  notes               text
);

-- ----------------------------------------------------------------------------
-- 9. PROJECT_SECTIONS VIEW (R04 — generieke read-layer voor Build Tracker)
--    aquier_project_sections blijft schrijvende canonical voor Aquier.
--    hermes_project_sections krijgt eigen tabel in migratie 106.
--    Frontend leest UNION view; Hermes-build tracker sectie zit in nieuwe tabel.
-- ----------------------------------------------------------------------------
-- View public.project_sections wordt aangemaakt in migratie 106 (na
-- introductie van hermes_projects + hermes_project_sections). De kolommen
-- mirror Aquier (geverifieerd tegen mig 086 regel 54-73): section_key, name,
-- position, status enum (live|building|pending|blocked|waiting_for_source),
-- error_count, live_workers, active_tasks, pending_tasks, failed_tasks,
-- success_ratio, live_data_sources, api_status, growth_metrics, updated_at.

-- ----------------------------------------------------------------------------
-- 10. RLS (deny-by-default; service_role volledige toegang)
-- ----------------------------------------------------------------------------
alter table hermes.subagents       enable row level security;
alter table hermes.agent_state     enable row level security;
alter table hermes.memory          enable row level security;
alter table hermes.skills          enable row level security;
alter table hermes.sessions        enable row level security;
alter table hermes.decisions       enable row level security;
alter table hermes.logs            enable row level security;
alter table hermes.system_health   enable row level security;

-- Idempotent: re-runnable bij failed-deploy + retry (R06).
do $$
declare t text;
begin
  foreach t in array array[
    'subagents','agent_state','memory','skills','sessions','decisions','logs','system_health'
  ] loop
    if not exists (
      select 1 from pg_policies
      where schemaname = 'hermes' and tablename = t and policyname = 'service_role_full'
    ) then
      execute format($p$
        create policy "service_role_full" on hermes.%I
        as permissive for all to service_role using (true) with check (true);
      $p$, t);
    end if;
  end loop;
end $$;

-- Authenticated users: alleen SELECT op subagents + agent_state + system_health
-- (voor /dashboard/hermes read-only views door ingelogde admins).
do $$
begin
  if not exists (select 1 from pg_policies where schemaname='hermes' and tablename='subagents' and policyname='auth_read_subagents') then
    create policy "auth_read_subagents" on hermes.subagents for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='hermes' and tablename='agent_state' and policyname='auth_read_agent_state') then
    create policy "auth_read_agent_state" on hermes.agent_state for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='hermes' and tablename='system_health' and policyname='auth_read_system_health') then
    create policy "auth_read_system_health" on hermes.system_health for select to authenticated using (true);
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- 11. updated_at trigger
-- ----------------------------------------------------------------------------
create or replace function hermes.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger trg_subagents_touch
  before update on hermes.subagents
  for each row execute function hermes.touch_updated_at();

create trigger trg_agent_state_touch
  before update on hermes.agent_state
  for each row execute function hermes.touch_updated_at();

create trigger trg_memory_touch
  before update on hermes.memory
  for each row execute function hermes.touch_updated_at();

-- ============================================================================
-- ROLLBACK (uncomment om te draaien)
-- ============================================================================
-- drop view if exists public.project_sections;
-- drop schema if exists hermes cascade;
