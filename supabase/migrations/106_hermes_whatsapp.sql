-- ============================================================================
-- Migration 106: Hermes WhatsApp Escalation Layer + Build Tracker
-- ============================================================================
-- Depends on: 104 (hermes schema), 105 (workflows)
-- Doel: escalatie-tabel, allowlist-recipients (timezone-aware quiet hours),
--       webhook inbox (idempotency), + project_sections aligned op Aquier (R04).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. ESCALATIONS
--    Brein van de WhatsApp-laag. Trigger: na falende auto-recovery + dedup.
-- ----------------------------------------------------------------------------
create table hermes.escalations (
  id                  uuid primary key default gen_random_uuid(),
  source_alert_id     uuid references public.executive_alerts(id) on delete set null,
  company_slug        text not null,
  os_label            text not null,                -- 'Media Holding OS', 'OSM Advocaat OS', ...
  severity            text not null check (severity in ('critical','high')),
  alert_kind          text not null,
  resource_id         text,                         -- rendering verplicht non-null (fallback source_alert_id::text)
  correlation_id      text,                         -- voor cross-org incidenten (R17)
  title               text not null,
  diagnosis           text not null,
  options             jsonb not null,               -- [{key,label,action,action_on_timeout?}, ...]
  revenue_or_compliance_impact boolean not null default false,
  status              text not null default 'pending'
                        check (status in ('pending','sending','sent','answered','actioned','timed_out','cancelled')),
  whatsapp_message_id text,
  user_choice         text,
  user_choice_at      timestamptz,
  reply_from_phone    text,
  action_result       jsonb,
  created_at          timestamptz not null default now(),
  sent_at             timestamptz,
  resolved_at         timestamptz
);

create index hermes_escalations_status_idx on hermes.escalations (status, created_at desc);
create index hermes_escalations_company_idx on hermes.escalations (company_slug, created_at desc);
create index hermes_escalations_whatsapp_message_idx
  on hermes.escalations (whatsapp_message_id)
  where whatsapp_message_id is not null;

-- Dedup: 1 actieve escalatie per (slug, kind, resource_id). resource_id niet null
-- (R11: rendering vult source_alert_id::text als fallback).
create unique index hermes_escalations_dedup
  on hermes.escalations (company_slug, alert_kind, resource_id)
  where status in ('pending','sending','sent','answered');

-- Cross-org correlatie (R17).
create unique index hermes_escalations_correlation_dedup
  on hermes.escalations (correlation_id, alert_kind)
  where correlation_id is not null and status in ('pending','sending','sent','answered');

-- ----------------------------------------------------------------------------
-- 2. WHATSAPP_RECIPIENTS (allowlist, timezone-aware)
-- ----------------------------------------------------------------------------
create table hermes.whatsapp_recipients (
  id                  uuid primary key default gen_random_uuid(),
  phone_e164          text unique not null,
  display_name        text not null,
  timezone            text not null default 'Europe/Amsterdam',
  receive_severities  text[] not null default array['critical','high'],
  quiet_hours_start   time not null default '23:00',
  quiet_hours_end     time not null default '07:00',
  active              boolean not null default false,   -- R08: default OFF
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index hermes_whatsapp_recipients_active_idx on hermes.whatsapp_recipients (active) where active;

create or replace function hermes.is_within_quiet_hours(p_recipient_id uuid, p_at timestamptz)
returns boolean language plpgsql stable as $$
declare
  r record;
  local_time time;
begin
  select * into r from hermes.whatsapp_recipients where id = p_recipient_id;
  if not found then return false; end if;
  local_time := (coalesce(p_at, now()) at time zone r.timezone)::time;
  if r.quiet_hours_start < r.quiet_hours_end then
    return local_time >= r.quiet_hours_start and local_time < r.quiet_hours_end;
  else
    return local_time >= r.quiet_hours_start or local_time < r.quiet_hours_end;
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- 3. WHATSAPP_INBOX (ruwe webhook events, idempotency)
-- ----------------------------------------------------------------------------
create table hermes.whatsapp_inbox (
  id                      uuid primary key default gen_random_uuid(),
  meta_event_id           text unique not null,
  from_phone              text not null,
  message_type            text,
  body                    jsonb not null,
  matched_escalation_id   uuid references hermes.escalations(id) on delete set null,
  processed_at            timestamptz,
  processing_error        text,
  created_at              timestamptz not null default now()
);

create index hermes_whatsapp_inbox_unprocessed_idx
  on hermes.whatsapp_inbox (created_at)
  where processed_at is null;
create index hermes_whatsapp_inbox_from_phone_idx on hermes.whatsapp_inbox (from_phone, created_at desc);

-- ----------------------------------------------------------------------------
-- 4. BUILD TRACKER — hermes_projects + hermes_project_sections (R04)
--    Kolom-compatible met public.aquier_project_sections (mig 086):
--    section_key, name, position, status enum (live|building|pending|
--    blocked|waiting_for_source), error_count, live_workers, active_tasks,
--    pending_tasks, failed_tasks, success_ratio, live_data_sources,
--    api_status, growth_metrics, updated_at.
--    Extra Hermes-velden in metadata jsonb (description, dependencies, parent).
-- ----------------------------------------------------------------------------

create table public.hermes_projects (
  id                  uuid primary key default gen_random_uuid(),
  code                text unique not null,
  name                text not null,
  description         text,
  status              text not null default 'in_progress',
  metadata            jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create table public.hermes_project_sections (
  id                  uuid primary key default gen_random_uuid(),
  project_id          uuid not null references public.hermes_projects(id) on delete cascade,
  section_key         text not null,
  name                text not null,
  position            int not null default 0,
  status              text not null default 'pending'
                        check (status in ('live','building','pending','blocked','waiting_for_source')),
  error_count         int not null default 0,
  live_workers        int not null default 0,
  active_tasks        int not null default 0,
  pending_tasks       int not null default 0,
  failed_tasks        int not null default 0,
  success_ratio       numeric(5,2) not null default 0,
  live_data_sources   jsonb not null default '[]'::jsonb,
  api_status          jsonb not null default '{}'::jsonb,
  growth_metrics      jsonb not null default '{}'::jsonb,
  metadata            jsonb not null default '{}'::jsonb,   -- description, parent_key, dependencies
  updated_at          timestamptz not null default now(),
  unique (project_id, section_key)
);

create index hermes_project_sections_project_idx
  on public.hermes_project_sections (project_id, position);
create index hermes_project_sections_status_idx
  on public.hermes_project_sections (status);

-- View: UNION over Aquier + Hermes met identieke kolom-projectie
create or replace view public.project_sections as
  select 'aquier'::text as project,
         id, project_id, section_key, name, position, status,
         error_count, live_workers, active_tasks, pending_tasks, failed_tasks,
         success_ratio, live_data_sources, api_status, growth_metrics,
         '{}'::jsonb as metadata,
         updated_at
  from public.aquier_project_sections
  union all
  select 'hermes'::text as project,
         id, project_id, section_key, name, position, status,
         error_count, live_workers, active_tasks, pending_tasks, failed_tasks,
         success_ratio, live_data_sources, api_status, growth_metrics,
         metadata,
         updated_at
  from public.hermes_project_sections;

comment on view public.project_sections is
  'Generieke read-layer Build Tracker. Schrijven gaat naar project-specifieke tabel.';

-- Seed: Hermes Integration parent + 11 secties
insert into public.hermes_projects (code, name, description, status, metadata)
values (
  'HERMES_INTEGRATION',
  'Hermes Integration',
  'Additieve orchestration/memory/watchdog laag bovenop Orlando Core OS.',
  'in_progress',
  jsonb_build_object('no_mock_data', true, 'owner', 'orlando')
)
on conflict (code) do update set
  name        = excluded.name,
  description = excluded.description,
  status      = excluded.status,
  metadata    = excluded.metadata,
  updated_at  = now();

insert into public.hermes_project_sections
  (project_id, section_key, name, position, status, metadata)
select
  (select id from public.hermes_projects where code = 'HERMES_INTEGRATION'),
  v.section_key, v.name, v.position, v.status,
  jsonb_build_object('description', v.description, 'parent_key', v.parent_key, 'dependencies', v.dependencies)
from (values
  ('hermes-analysis',           'Fase 1 — Analyse & Mapping',            10, 'live',     'Architecture map, dep-graph, overlap matrix, risk register.',                'hermes-integration', '[]'::jsonb),
  ('hermes-core',               'Fase 2 — Core Service Skeleton',        20, 'building', 'services/hermes Node/TS skeleton + Dockerfile.',                             'hermes-integration', '["hermes-analysis"]'::jsonb),
  ('hermes-memory',             'Fase 3 — Memory Layer (mig 104+105)',   30, 'building', 'Hermes schema, foundation tables, workflows.',                               'hermes-integration', '["hermes-analysis"]'::jsonb),
  ('hermes-subagents',          'Fase 4 — Subagents',                    40, 'pending',  '15 gespecialiseerde agents (registry, agent_state).',                        'hermes-integration', '["hermes-core","hermes-memory"]'::jsonb),
  ('hermes-dashboard',          'Fase 5 — /dashboard/hermes',            50, 'pending',  'Realtime dashboard: agents, workers, logs, costs, controls.',                'hermes-integration', '["hermes-subagents"]'::jsonb),
  ('hermes-local-workers',      'Fase 6 — Lokale workers',               60, 'pending',  'CLI-L/CLI-R routing + watchdog cleanup.',                                    'hermes-integration', '["hermes-subagents"]'::jsonb),
  ('hermes-telegram',           'Fase 7 — Telegram bridge (passive)',    70, 'pending',  'Geen wijziging; Hermes registreert observer.',                               'hermes-integration', '["hermes-subagents"]'::jsonb),
  ('hermes-whatsapp-escalation','WhatsApp Escalation Bridge',            75, 'building', 'Mig 106 + subagent #16 + webhook + reply-handler.',                          'hermes-integration', '["hermes-memory"]'::jsonb),
  ('hermes-self-healing',       'Fase 8 — Self-healing met SLOs',        80, 'pending',  'Activeren NA 7 dagen observer-only.',                                        'hermes-integration', '["hermes-subagents","hermes-whatsapp-escalation"]'::jsonb),
  ('hermes-rollout',            'Fase 9 — Rollout + DoD-check',          90, 'pending',  'Chaos-test, cost-validatie, key-rotation deploy.',                           'hermes-integration', '["hermes-self-healing","hermes-dashboard"]'::jsonb)
) as v(section_key, name, position, status, description, parent_key, dependencies)
on conflict (project_id, section_key) do update set
  name       = excluded.name,
  position   = excluded.position,
  status     = excluded.status,
  metadata   = excluded.metadata,
  updated_at = now();

-- ----------------------------------------------------------------------------
-- 5. RLS
-- ----------------------------------------------------------------------------
alter table hermes.escalations             enable row level security;
alter table hermes.whatsapp_recipients     enable row level security;
alter table hermes.whatsapp_inbox          enable row level security;
alter table public.hermes_projects         enable row level security;
alter table public.hermes_project_sections enable row level security;

do $$
declare t text;
begin
  foreach t in array array['escalations','whatsapp_recipients','whatsapp_inbox'] loop
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

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='hermes_projects' and policyname='service_role_full') then
    create policy "service_role_full" on public.hermes_projects
      as permissive for all to service_role using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='hermes_project_sections' and policyname='service_role_full') then
    create policy "service_role_full" on public.hermes_project_sections
      as permissive for all to service_role using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='hermes' and tablename='escalations' and policyname='auth_read_escalations') then
    create policy "auth_read_escalations" on hermes.escalations
      for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='hermes' and tablename='whatsapp_recipients' and policyname='auth_read_recipients') then
    create policy "auth_read_recipients" on hermes.whatsapp_recipients
      for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='hermes_projects' and policyname='auth_read_projects') then
    create policy "auth_read_projects" on public.hermes_projects
      for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='hermes_project_sections' and policyname='auth_read_sections') then
    create policy "auth_read_sections" on public.hermes_project_sections
      for select to authenticated using (true);
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- 6. Triggers
-- ----------------------------------------------------------------------------
create trigger trg_whatsapp_recipients_touch
  before update on hermes.whatsapp_recipients
  for each row execute function hermes.touch_updated_at();

create or replace function public.touch_updated_at_public()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

create trigger trg_hermes_projects_touch
  before update on public.hermes_projects
  for each row execute function public.touch_updated_at_public();

create trigger trg_hermes_project_sections_touch
  before update on public.hermes_project_sections
  for each row execute function public.touch_updated_at_public();

-- ============================================================================
-- ROLLBACK
-- ============================================================================
-- drop view if exists public.project_sections;
-- drop table if exists public.hermes_project_sections;
-- drop table if exists public.hermes_projects;
-- drop table if exists hermes.whatsapp_inbox;
-- drop table if exists hermes.whatsapp_recipients;
-- drop table if exists hermes.escalations;
