-- ============================================================================
-- Migration 105: Hermes Workflows + Learning Events
-- ============================================================================
-- Depends on: 104 (hermes schema + foundation)
-- Doel: workflow-definities (XState-compatible), run-history, failure-patterns
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. WORKFLOWS (definities, versioned)
-- ----------------------------------------------------------------------------
create table hermes.workflows (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null,
  version         integer not null default 1,
  name            text not null,
  description     text,
  definition      jsonb not null,           -- XState-machine config
  inputs_schema   jsonb,
  outputs_schema  jsonb,
  enabled         boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (slug, version)
);

create index hermes_workflows_slug_idx on hermes.workflows (slug) where enabled;

-- ----------------------------------------------------------------------------
-- 2. WORKFLOW_RUNS (history per uitvoering)
-- ----------------------------------------------------------------------------
create table hermes.workflow_runs (
  id              uuid primary key default gen_random_uuid(),
  workflow_id     uuid not null references hermes.workflows(id) on delete restrict,
  subagent_id     uuid references hermes.subagents(id) on delete set null,
  triggered_by    text not null,            -- 'pg_cron' | 'realtime_event' | 'user' | 'subagent:<name>'
  trigger_payload jsonb,
  status          text not null default 'running'
                    check (status in ('running','succeeded','failed','timed_out','cancelled')),
  current_state   text,                     -- huidige state in machine
  retry_count     integer not null default 0,
  max_retries     integer not null default 3,
  started_at      timestamptz not null default now(),
  ended_at        timestamptz,
  duration_ms     integer generated always as (
                    case when ended_at is not null
                      then extract(epoch from (ended_at - started_at))::int * 1000
                    end
                  ) stored,
  error_summary   text,
  error_detail    jsonb,
  result          jsonb
);

create index hermes_workflow_runs_workflow_idx on hermes.workflow_runs (workflow_id, started_at desc);
create index hermes_workflow_runs_status_idx on hermes.workflow_runs (status) where status in ('running','failed');
create index hermes_workflow_runs_subagent_idx on hermes.workflow_runs (subagent_id, started_at desc);

-- ----------------------------------------------------------------------------
-- 3. LEARNING_EVENTS (failure-patterns + applied fixes voor predictive recovery)
-- ----------------------------------------------------------------------------
create table hermes.learning_events (
  id              uuid primary key default gen_random_uuid(),
  pattern_hash    text not null,            -- normalized hash van (alert_kind, error_signature)
  alert_kind      text not null,
  company_slug    text,
  occurrences     integer not null default 1,
  first_seen_at   timestamptz not null default now(),
  last_seen_at    timestamptz not null default now(),
  fix_applied     text,                     -- skill-naam OF decision-id
  fix_success_rate numeric(5,2),            -- 0.00 - 100.00
  notes           text,
  unique (pattern_hash, alert_kind)
);

create index hermes_learning_alert_kind_idx on hermes.learning_events (alert_kind);
create index hermes_learning_company_idx on hermes.learning_events (company_slug) where company_slug is not null;

-- ----------------------------------------------------------------------------
-- 4. RLS
-- ----------------------------------------------------------------------------
alter table hermes.workflows        enable row level security;
alter table hermes.workflow_runs    enable row level security;
alter table hermes.learning_events  enable row level security;

-- Idempotent: re-runnable bij failed-deploy + retry (R06).
do $$
declare t text;
begin
  foreach t in array array['workflows','workflow_runs','learning_events'] loop
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
  if not exists (select 1 from pg_policies where schemaname='hermes' and tablename='workflows' and policyname='auth_read_workflows') then
    create policy "auth_read_workflows" on hermes.workflows for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='hermes' and tablename='workflow_runs' and policyname='auth_read_workflow_runs') then
    create policy "auth_read_workflow_runs" on hermes.workflow_runs for select to authenticated using (true);
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- 5. Triggers
-- ----------------------------------------------------------------------------
create trigger trg_workflows_touch
  before update on hermes.workflows
  for each row execute function hermes.touch_updated_at();

-- ============================================================================
-- ROLLBACK
-- ============================================================================
-- drop table if exists hermes.learning_events;
-- drop table if exists hermes.workflow_runs;
-- drop table if exists hermes.workflows;
