-- ============================================================================
-- Migration 113: Build Project Dependencies, Priority Queue, Daily Summary,
--                Time Windows, Agent Delivery, and Autonomy Scoring
-- ============================================================================
-- Depends on: 087 (build_tracker), 104 (hermes schema)
-- Doel: Extend Build Tracker with dependency-based ordering, autonomy analysis,
--       time window constraints, and agent delivery tracking
-- ============================================================================

-- ============================================================================
-- 1. BUILD_PROJECT_DEPENDENCIES — Blocking relationships between builds
-- ============================================================================
create table if not exists public.build_project_dependencies (
  id                uuid primary key default gen_random_uuid(),
  source_build_id   uuid not null references public.build_tracker(id) on delete cascade,
  target_build_id   uuid not null references public.build_tracker(id) on delete cascade,
  relationship_type text not null default 'blocks'
                      check (relationship_type in ('blocks','depends_on')),
  description       text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint different_builds check (source_build_id != target_build_id),
  unique(source_build_id, target_build_id, relationship_type)
);

create index if not exists idx_build_deps_source on public.build_project_dependencies (source_build_id);
create index if not exists idx_build_deps_target on public.build_project_dependencies (target_build_id);
create index if not exists idx_build_deps_type on public.build_project_dependencies (relationship_type);

comment on table public.build_project_dependencies is
  'Dependency graph: source_build_id blocks target_build_id (or vice versa with depends_on)';

-- ============================================================================
-- 2. BUILD_PRIORITY_QUEUE — Calculated priority per build (1-30)
-- ============================================================================
create table if not exists public.build_priority_queue (
  id                        uuid primary key default gen_random_uuid(),
  build_id                  uuid not null unique references public.build_tracker(id) on delete cascade,
  company_id                uuid not null references public.companies(id) on delete cascade,

  -- Calculated priority
  calculated_priority       integer not null default 1 check (calculated_priority between 1 and 30),
  manual_priority_override  integer check (manual_priority_override between 1 and 30),

  -- Current priority (manual override takes precedence)
  current_priority          integer not null default 1 check (current_priority between 1 and 30),

  -- Metadata
  depends_on_count          integer not null default 0,
  blocked_by_count          integer not null default 0,
  autonomy_boost_applied    integer not null default 0,  -- +10, +5, or 0
  last_recalc_at            timestamptz,
  recalc_reason             text,  -- 'dependency_change', 'status_change', 'autonomy_change', 'recovery', etc.

  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

create index if not exists idx_build_priority_company on public.build_priority_queue (company_id);
create index if not exists idx_build_priority_current on public.build_priority_queue (current_priority);
create index if not exists idx_build_priority_build on public.build_priority_queue (build_id);

comment on table public.build_priority_queue is
  'Priority ordering (1-30) per build with autonomy weighting and manual overrides';

-- ============================================================================
-- 3. BUILD_AUTONOMY_SCORE — Hermes self-completion capability assessment
-- ============================================================================
create table if not exists public.build_autonomy_score (
  id                        uuid primary key default gen_random_uuid(),
  build_id                  uuid not null unique references public.build_tracker(id) on delete cascade,

  -- Autonomy level classification
  autonomy_level            text not null default 'manual'
                              check (autonomy_level in ('full', 'partial', 'manual')),
  autonomy_pct              numeric(5,2) not null default 0 check (autonomy_pct between 0 and 100),

  -- Hermes capability assessment
  hermes_workflow_exists    boolean not null default false,
  required_approvals        text[],                -- [phase1_approval, final_sign_off, etc]
  required_skills           text[],                -- Skills Hermes agents must have
  external_integrations     text[],                -- [github, youtube_api, slack, etc]

  -- Risk and blockers
  risk_level                text not null default 'medium'
                              check (risk_level in ('low', 'medium', 'high', 'critical')),
  blocking_factors          jsonb,                 -- {"human_review_required": true, "missing_skill": "video_encoding"}

  -- Execution capability
  can_execute_today         boolean not null default false,
  estimated_completion_time_hours integer,

  -- Confidence in assessment
  last_evaluated_at         timestamptz,
  confidence_score          numeric(3,2) check (confidence_score between 0 and 1),

  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

create index if not exists idx_autonomy_level on public.build_autonomy_score (autonomy_level);
create index if not exists idx_autonomy_can_execute on public.build_autonomy_score (can_execute_today);
create index if not exists idx_autonomy_risk on public.build_autonomy_score (risk_level);

comment on table public.build_autonomy_score is
  'Hermes autonomy assessment: can this build complete without human intervention?';

-- ============================================================================
-- 4. BUILD_TIME_WINDOWS — Upload/publish time constraints per build
-- ============================================================================
create table if not exists public.build_time_windows (
  id                        uuid primary key default gen_random_uuid(),
  build_id                  uuid not null unique references public.build_tracker(id) on delete cascade,

  -- Upload window (default: 22:00-08:00 UTC)
  upload_window_start       text not null default '22:00',  -- HH:MM format
  upload_window_end         text not null default '08:00',

  -- Publish window (default: 08:00-22:00 UTC)
  publish_window_start      text not null default '08:00',
  publish_window_end        text not null default '22:00',
  publish_weekdays_enabled  boolean[] not null default array[true,true,true,true,true,false,false],  -- Mon-Sun

  timezone                  text not null default 'UTC',

  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

create index if not exists idx_time_windows_build on public.build_time_windows (build_id);

comment on table public.build_time_windows is
  'Time constraints for upload and publish actions per build (timezone-aware)';

-- ============================================================================
-- 5. BUILD_AGENT_DELIVERY — Activity log of agent/Hermes work on builds
-- ============================================================================
create table if not exists public.build_agent_delivery (
  id                        uuid primary key default gen_random_uuid(),
  build_id                  uuid not null references public.build_tracker(id) on delete cascade,

  -- Link to Hermes task
  dispatch_task_id          uuid references hermes.dispatch_queue(id) on delete set null,

  -- Agent info
  agent_name                text not null,  -- e.g., 'hermes-youtube', 'hermes-recovery', etc.
  agent_role                text,           -- e.g., 'orchestrator', 'worker', 'recovery'

  -- Delivery details
  action_type               text not null,  -- 'code_commit', 'artifact_generated', 'task_completed', 'error_handled', etc.
  result_status             text not null default 'pending'
                              check (result_status in ('pending', 'success', 'partial', 'failed')),
  description               text,

  -- Deliverables
  result_metadata           jsonb,  -- {commits: [...], artifacts: [...], errors: [...]}

  executed_at               timestamptz,
  completed_at              timestamptz,

  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

create index if not exists idx_agent_delivery_build on public.build_agent_delivery (build_id);
create index if not exists idx_agent_delivery_dispatch on public.build_agent_delivery (dispatch_task_id);
create index if not exists idx_agent_delivery_agent on public.build_agent_delivery (agent_name);
create index if not exists idx_agent_delivery_date on public.build_agent_delivery (created_at);

comment on table public.build_agent_delivery is
  'Activity log: what agents delivered (commits, artifacts, etc.) and when';

-- ============================================================================
-- 6. BUILD_DAILY_SUMMARY — Pre-computed morning overview
-- ============================================================================
create table if not exists public.build_daily_summary (
  id                        uuid primary key default gen_random_uuid(),
  company_id                uuid not null references public.companies(id) on delete cascade,
  summary_date              date not null,

  -- Status counts
  queued_count              integer not null default 0,
  in_progress_count         integer not null default 0,
  completed_count           integer not null default 0,
  blocked_count             integer not null default 0,

  -- Autonomy insights
  fully_autonomous_count    integer not null default 0,  -- Can complete without review
  partially_autonomous_count integer not null default 0,
  manual_count              integer not null default 0,

  -- Deliverables today
  agent_deliveries_count    integer not null default 0,

  -- Full snapshot (for dashboard)
  snapshot_data             jsonb,  -- {top_queued: [...], in_progress: [...], completed: [...]}

  generated_at              timestamptz not null default now(),

  unique(company_id, summary_date)
);

create index if not exists idx_daily_summary_company on public.build_daily_summary (company_id);
create index if not exists idx_daily_summary_date on public.build_daily_summary (summary_date);

comment on table public.build_daily_summary is
  'Pre-computed daily overview of build status (queued, in-progress, completed, blocked, autonomy breakdown)';

-- ============================================================================
-- 7. UPDATED_AT TRIGGERS for new tables
-- ============================================================================
create or replace function public.set_updated_at_build_deps()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end$$;

drop trigger if exists trg_build_deps_updated_at on public.build_project_dependencies;
create trigger trg_build_deps_updated_at
  before update on public.build_project_dependencies
  for each row execute function public.set_updated_at_build_deps();

create or replace function public.set_updated_at_build_priority()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end$$;

drop trigger if exists trg_build_priority_updated_at on public.build_priority_queue;
create trigger trg_build_priority_updated_at
  before update on public.build_priority_queue
  for each row execute function public.set_updated_at_build_priority();

create or replace function public.set_updated_at_autonomy()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end$$;

drop trigger if exists trg_autonomy_updated_at on public.build_autonomy_score;
create trigger trg_autonomy_updated_at
  before update on public.build_autonomy_score
  for each row execute function public.set_updated_at_autonomy();

create or replace function public.set_updated_at_time_windows()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end$$;

drop trigger if exists trg_time_windows_updated_at on public.build_time_windows;
create trigger trg_time_windows_updated_at
  before update on public.build_time_windows
  for each row execute function public.set_updated_at_time_windows();

create or replace function public.set_updated_at_agent_delivery()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end$$;

drop trigger if exists trg_agent_delivery_updated_at on public.build_agent_delivery;
create trigger trg_agent_delivery_updated_at
  before update on public.build_agent_delivery
  for each row execute function public.set_updated_at_agent_delivery();

-- ============================================================================
-- 8. INITIALIZE: Create priority queue entries for existing builds
-- ============================================================================
insert into public.build_priority_queue (build_id, company_id, calculated_priority, current_priority)
select bt.id, bt.company_id, 1, 1
from public.build_tracker bt
where not exists (
  select 1 from public.build_priority_queue bpq where bpq.build_id = bt.id
)
on conflict (build_id) do nothing;

-- Initialize autonomy scores for existing builds
insert into public.build_autonomy_score (build_id, autonomy_level, autonomy_pct, confidence_score)
select bt.id, 'manual', 0, 0.5
from public.build_tracker bt
where not exists (
  select 1 from public.build_autonomy_score bas where bas.build_id = bt.id
)
on conflict (build_id) do nothing;

-- Initialize time windows for existing builds (all use defaults)
insert into public.build_time_windows (build_id)
select bt.id
from public.build_tracker bt
where not exists (
  select 1 from public.build_time_windows btw where btw.build_id = bt.id
)
on conflict (build_id) do nothing;

-- ============================================================================
-- 9. ENABLE RLS — service_role full access + authenticated read
-- ============================================================================
do $$
declare
  tables text[] := array[
    'build_project_dependencies',
    'build_priority_queue',
    'build_autonomy_score',
    'build_time_windows',
    'build_agent_delivery',
    'build_daily_summary'
  ];
  t text;
begin
  foreach t in array tables loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "%s_service_role" on public.%I for all using (true) with check (true) to service_role',
      t, t
    );
    execute format(
      'create policy "%s_select" on public.%I for select using (true) to authenticated',
      t, t
    );
  end loop;
end$$;
