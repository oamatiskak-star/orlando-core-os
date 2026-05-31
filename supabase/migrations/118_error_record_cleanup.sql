-- ============================================================================
-- Migration 118: Automatic Cleanup of Old Error/Failure Records
-- ============================================================================
-- Depends on: 113 (build_agent_delivery), 112 (hermes.recovery_status), 087 (build_tracker)
-- Doel: Automatically archive and clean up old failed/error records from the dashboard
--       after they've been resolved to keep the system lean
-- ============================================================================

-- ============================================================================
-- 1. ARCHIVE_AGENT_DELIVERY — Archive table for old failed deliveries
-- ============================================================================

create table if not exists public.build_agent_delivery_archive (
  id                        uuid primary key default gen_random_uuid(),
  build_id                  uuid not null,

  dispatch_task_id          uuid,

  agent_name                text not null,
  agent_role                text,

  action_type               text not null,
  result_status             text not null,
  description               text,

  result_metadata           jsonb,

  executed_at               timestamptz,
  completed_at              timestamptz,

  -- Archive metadata
  archived_at               timestamptz not null default now(),
  original_created_at       timestamptz not null,
  original_updated_at       timestamptz not null
);

create index if not exists idx_archive_delivery_build on public.build_agent_delivery_archive (build_id);
create index if not exists idx_archive_delivery_date on public.build_agent_delivery_archive (archived_at);
create index if not exists idx_archive_delivery_status on public.build_agent_delivery_archive (result_status);

comment on table public.build_agent_delivery_archive is
  'Archive of old failed/error agent deliveries (moved from build_agent_delivery after retention period)';

-- ============================================================================
-- 2. ARCHIVE_RECOVERY_STATUS — Archive table for resolved recovery attempts
-- ============================================================================

create table if not exists hermes.recovery_status_archive (
  id                    uuid primary key default gen_random_uuid(),

  task_id               text not null,
  task_type             text not null,

  status                text not null,

  first_error_at        timestamptz not null,
  last_update_at        timestamptz not null,

  error_count           integer not null,
  recovery_count        integer not null,

  latest_error_id       uuid,
  latest_recovery_id    uuid,

  is_escalated          boolean not null,
  escalated_at          timestamptz,
  escalation_reason     text,

  metadata              jsonb not null default '{}'::jsonb,

  -- Archive metadata
  archived_at           timestamptz not null default now(),
  original_created_at   timestamptz not null,
  original_updated_at   timestamptz not null
);

create index if not exists idx_archive_recovery_status on hermes.recovery_status_archive (status);
create index if not exists idx_archive_recovery_date on hermes.recovery_status_archive (archived_at);

comment on table hermes.recovery_status_archive is
  'Archive of resolved recovery attempts (moved from recovery_status after retention period)';

-- ============================================================================
-- 3. BUILD_CLEANUP_RETENTION_POLICY — Configuration table
-- ============================================================================

create table if not exists public.build_cleanup_retention_policy (
  id                        uuid primary key default gen_random_uuid(),
  company_id                uuid references public.companies(id) on delete cascade,

  -- Retention periods in days
  failed_delivery_retention_days   integer not null default 30,
  resolved_recovery_retention_days integer not null default 30,
  failed_build_retention_days      integer not null default 60,

  -- Cleanup settings
  auto_archive_enabled      boolean not null default true,
  archive_instead_of_delete boolean not null default true,

  -- Logging
  last_cleanup_at           timestamptz,
  last_cleanup_records      integer,

  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

create index if not exists idx_cleanup_policy_company on public.build_cleanup_retention_policy (company_id);

comment on table public.build_cleanup_retention_policy is
  'Configurable retention and cleanup policies per company (defaults: 30 days for failures, 60 for failed builds)';

-- ============================================================================
-- 4. CLEANUP_OLD_FAILED_DELIVERIES — Archive old failed agent deliveries
-- ============================================================================

create or replace function public.cleanup_old_failed_deliveries(
  p_company_id uuid default null,
  p_retention_days integer default 30
)
returns table (
  archived_count integer,
  deleted_count integer,
  company_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company_id uuid;
  v_retention_days integer;
  v_archived_count integer := 0;
  v_deleted_count integer := 0;
  v_cutoff_date timestamptz;
begin
  -- Get all companies if not specified
  for v_company_id in
    select c.id from public.companies c
    where (p_company_id is null or c.id = p_company_id)
  loop
    -- Get retention policy for this company
    select coalesce(failed_delivery_retention_days, p_retention_days)
    into v_retention_days
    from public.build_cleanup_retention_policy
    where company_id = v_company_id;

    if v_retention_days is null then
      v_retention_days := p_retention_days;
    end if;

    v_cutoff_date := now() - (v_retention_days || ' days')::interval;

    -- Archive failed deliveries older than retention period
    insert into public.build_agent_delivery_archive (
      build_id, dispatch_task_id, agent_name, agent_role,
      action_type, result_status, description, result_metadata,
      executed_at, completed_at,
      archived_at, original_created_at, original_updated_at
    )
    select
      bad.build_id, bad.dispatch_task_id, bad.agent_name, bad.agent_role,
      bad.action_type, bad.result_status, bad.description, bad.result_metadata,
      bad.executed_at, bad.completed_at,
      now(), bad.created_at, bad.updated_at
    from public.build_agent_delivery bad
    inner join public.build_tracker bt on bt.id = bad.build_id
    where bt.company_id = v_company_id
      and bad.result_status = 'failed'
      and bad.completed_at is not null
      and bad.completed_at < v_cutoff_date
    on conflict do nothing;

    get diagnostics v_archived_count = row_count;

    -- Delete archived records from active table
    delete from public.build_agent_delivery bad
    where exists (
      select 1 from public.build_tracker bt
      where bt.id = bad.build_id
        and bt.company_id = v_company_id
    )
      and bad.result_status = 'failed'
      and bad.completed_at is not null
      and bad.completed_at < v_cutoff_date;

    get diagnostics v_deleted_count = row_count;

    -- Update cleanup log
    insert into public.build_cleanup_retention_policy (
      company_id, auto_archive_enabled, archive_instead_of_delete,
      last_cleanup_at, last_cleanup_records
    )
    values (v_company_id, true, true, now(), v_archived_count + v_deleted_count)
    on conflict (company_id) do update
    set last_cleanup_at = now(),
        last_cleanup_records = (v_archived_count + v_deleted_count);

    -- Return results
    return query select v_archived_count, v_deleted_count, v_company_id;
  end loop;
end $$;

comment on function public.cleanup_old_failed_deliveries(uuid, integer) is
  'Archive and clean up failed agent delivery records older than retention period per company';

-- ============================================================================
-- 5. CLEANUP_OLD_RECOVERY_RECORDS — Archive resolved recovery attempts
-- ============================================================================

create or replace function public.cleanup_old_recovery_records(
  p_company_id uuid default null,
  p_retention_days integer default 30
)
returns table (
  archived_count integer,
  deleted_count integer,
  company_id uuid
)
language plpgsql
security definer
set search_path = hermes
as $$
declare
  v_company_id uuid;
  v_retention_days integer;
  v_archived_count integer := 0;
  v_deleted_count integer := 0;
  v_cutoff_date timestamptz;
begin
  -- Get all companies if not specified
  for v_company_id in
    select c.id from public.companies c
    where (p_company_id is null or c.id = p_company_id)
  loop
    -- Get retention policy for this company
    select coalesce(resolved_recovery_retention_days, p_retention_days)
    into v_retention_days
    from public.build_cleanup_retention_policy
    where company_id = v_company_id;

    if v_retention_days is null then
      v_retention_days := p_retention_days;
    end if;

    v_cutoff_date := now() - (v_retention_days || ' days')::interval;

    -- Archive resolved recovery records older than retention period
    insert into hermes.recovery_status_archive (
      task_id, task_type, status,
      first_error_at, last_update_at,
      error_count, recovery_count,
      latest_error_id, latest_recovery_id,
      is_escalated, escalated_at, escalation_reason,
      metadata, archived_at, original_created_at, original_updated_at
    )
    select
      rs.task_id, rs.task_type, rs.status,
      rs.first_error_at, rs.last_update_at,
      rs.error_count, rs.recovery_count,
      rs.latest_error_id, rs.latest_recovery_id,
      rs.is_escalated, rs.escalated_at, rs.escalation_reason,
      rs.metadata, now(), rs.created_at, rs.updated_at
    from hermes.recovery_status rs
    where rs.status in ('resolved', 'failed')
      and rs.updated_at < v_cutoff_date
    on conflict do nothing;

    get diagnostics v_archived_count = row_count;

    -- Delete archived records from active table
    delete from hermes.recovery_status
    where status in ('resolved', 'failed')
      and updated_at < v_cutoff_date;

    get diagnostics v_deleted_count = row_count;

    -- Return results
    return query select v_archived_count, v_deleted_count, v_company_id;
  end loop;
end $$;

comment on function public.cleanup_old_recovery_records(uuid, integer) is
  'Archive and clean up resolved/failed recovery records older than retention period per company';

-- ============================================================================
-- 6. CLEANUP_FAILED_BUILDS — Mark old failed builds as archived
-- ============================================================================

create or replace function public.cleanup_failed_builds(
  p_company_id uuid default null,
  p_retention_days integer default 60
)
returns table (
  archived_count integer,
  company_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company_id uuid;
  v_retention_days integer;
  v_archived_count integer := 0;
  v_cutoff_date timestamptz;
begin
  -- Get all companies if not specified
  for v_company_id in
    select c.id from public.companies c
    where (p_company_id is null or c.id = p_company_id)
  loop
    -- Get retention policy for this company
    select coalesce(failed_build_retention_days, p_retention_days)
    into v_retention_days
    from public.build_cleanup_retention_policy
    where company_id = v_company_id;

    if v_retention_days is null then
      v_retention_days := p_retention_days;
    end if;

    v_cutoff_date := now() - (v_retention_days || ' days')::interval;

    -- Archive old failed builds (if last_update_at is old)
    -- Note: This marks status as 'archived' instead of deleting
    update public.build_tracker
    set status = 'archived', last_update_at = now()
    where company_id = v_company_id
      and status = 'failed'
      and last_update_at < v_cutoff_date;

    get diagnostics v_archived_count = row_count;

    -- Return results
    return query select v_archived_count, v_company_id;
  end loop;
end $$;

comment on function public.cleanup_failed_builds(uuid, integer) is
  'Archive failed builds older than retention period by setting status to archived';

-- ============================================================================
-- 7. RUN_DAILY_CLEANUP — Master cleanup function (runs all cleanup tasks)
-- ============================================================================

create or replace function public.run_daily_cleanup(p_company_id uuid default null)
returns table (
  cleanup_stage text,
  count integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_archived integer;
  v_deleted integer;
  v_company_id uuid;
begin
  -- Clean up failed deliveries (30 days default)
  for v_company_id, v_archived, v_deleted in
    select company_id, archived_count, deleted_count
    from cleanup_old_failed_deliveries(p_company_id, 30)
  loop
    return query select 'failed_deliveries_archived'::text, v_archived;
    return query select 'failed_deliveries_deleted'::text, v_deleted;
  end loop;

  -- Clean up recovery records (30 days default)
  for v_company_id, v_archived, v_deleted in
    select company_id, archived_count, deleted_count
    from cleanup_old_recovery_records(p_company_id, 30)
  loop
    return query select 'recovery_archived'::text, v_archived;
    return query select 'recovery_deleted'::text, v_deleted;
  end loop;

  -- Archive old failed builds (60 days default)
  for v_company_id, v_archived in
    select company_id, archived_count
    from cleanup_failed_builds(p_company_id, 60)
  loop
    return query select 'builds_archived'::text, v_archived;
  end loop;
end $$;

comment on function public.run_daily_cleanup(uuid) is
  'Master cleanup function: runs all cleanup tasks (deliveries, recovery, builds) per company';

-- ============================================================================
-- 8. SCHEDULE DAILY CLEANUP via pg_cron
-- ============================================================================

-- Run cleanup every day at 02:00 UTC (03:00 CET, before daily summary generation)
select cron.schedule(
  'daily_error_cleanup',
  '0 2 * * *',
  'select public.run_daily_cleanup(null)'
);

-- Add record to track cleanup schedules
insert into public.build_cleanup_retention_policy (
  company_id, auto_archive_enabled, archive_instead_of_delete
)
select id, true, true
from public.companies c
where not exists (
  select 1 from public.build_cleanup_retention_policy p
  where p.company_id = c.id
)
on conflict do nothing;

-- ============================================================================
-- 9. VIEW: ACTIVE_AGENT_DELIVERIES (excludes archived records)
-- ============================================================================

create or replace view public.v_active_agent_deliveries as
select
  bad.id,
  bad.build_id,
  bad.dispatch_task_id,
  bad.agent_name,
  bad.agent_role,
  bad.action_type,
  bad.result_status,
  bad.description,
  bad.result_metadata,
  bad.executed_at,
  bad.completed_at,
  bad.created_at,
  bad.updated_at,
  bt.company_id
from public.build_agent_delivery bad
left join public.build_tracker bt on bt.id = bad.build_id
where bt.status != 'archived'
  or bt.status is null;

comment on view public.v_active_agent_deliveries is
  'Active agent deliveries (excludes records from archived builds)';

-- ============================================================================
-- 10. INITIALIZATION: Create default retention policies for all companies
-- ============================================================================

insert into public.build_cleanup_retention_policy (
  company_id,
  failed_delivery_retention_days,
  resolved_recovery_retention_days,
  failed_build_retention_days,
  auto_archive_enabled,
  archive_instead_of_delete
)
select
  c.id,
  30,  -- Keep failed deliveries for 30 days
  30,  -- Keep resolved recovery for 30 days
  60,  -- Keep failed builds for 60 days
  true,
  true
from public.companies c
where not exists (
  select 1 from public.build_cleanup_retention_policy p
  where p.company_id = c.id
)
on conflict do nothing;

-- ============================================================================
-- MIGRATION NOTES
-- ============================================================================

comment on migration is
  'Automatic cleanup of old error/failure records:
   - Archives failed agent deliveries after 30 days to keep dashboard lean
   - Archives resolved recovery attempts after 30 days
   - Marks old failed builds as archived after 60 days
   - Runs daily at 02:00 UTC via pg_cron (before daily summary generation)
   - Configurable per company via build_cleanup_retention_policy table
   - All deletions are reversible via archive tables (never permanent deletion)
   - View v_active_agent_deliveries excludes archived build records';
