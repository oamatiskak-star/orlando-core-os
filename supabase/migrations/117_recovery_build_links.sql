-- ============================================================================
-- Migration 117: Link hermes.recovery_status to build_tracker
-- ============================================================================
-- Depends on: 112 (hermes.recovery_status), 113 (build_tracker), 114 (priority calc)
-- Doel: Auto-trigger priority recalculation when recovery succeeds
-- ============================================================================

-- ============================================================================
-- 1. Add build_tracker_id to recovery_status
-- ============================================================================

alter table if exists hermes.recovery_status
  add column if not exists build_tracker_id uuid references public.build_tracker(id) on delete set null;

create index if not exists hermes_recovery_build_idx
  on hermes.recovery_status (build_tracker_id)
  where build_tracker_id is not null;

comment on column hermes.recovery_status.build_tracker_id is
  'Optional link to a build_tracker build; enables auto-reprioritization on recovery';

-- ============================================================================
-- 2. TRIGGER: Auto-evaluate autonomy on recovery completion
-- ============================================================================

create or replace function public.trg_recovery_completed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_build_id uuid;
  v_company_id uuid;
begin
  -- Only trigger on resolution
  if new.status = 'resolved' and old.status <> 'resolved' then
    v_build_id := new.build_tracker_id;

    if v_build_id is not null then
      -- Re-evaluate autonomy (recovery may have fixed blockers)
      perform public.evaluate_build_autonomy(v_build_id);

      -- Get company for recalculation
      select company_id into v_company_id
      from public.build_tracker
      where id = v_build_id;

      if v_company_id is not null then
        -- Recalculate priorities (recovered build may move up)
        perform public.recalc_build_priorities(v_company_id, 'recovery_completed');
      end if;
    end if;
  end if;

  return new;
end $$;

drop trigger if exists trg_recovery_completed on hermes.recovery_status;
create trigger trg_recovery_completed
  after update on hermes.recovery_status
  for each row execute function public.trg_recovery_completed();

-- ============================================================================
-- 3. HELPER: Link recovery to build by task_id
-- ============================================================================

create or replace function public.link_recovery_to_build(
  p_task_id text,
  p_build_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update hermes.recovery_status
  set build_tracker_id = p_build_id,
      updated_at = now()
  where task_id = p_task_id;
end $$;

comment on function public.link_recovery_to_build(text, uuid) is
  'Link a recovery task to a build (called when recovery is initiated for a build)';

-- ============================================================================
-- 4. HELPER: Get recovery status for a build
-- ============================================================================

create or replace function public.get_build_recovery_status(p_build_id uuid)
returns table (
  id uuid,
  task_id text,
  status text,
  error_count integer,
  recovery_count integer,
  first_error_at timestamptz,
  last_update_at timestamptz,
  resolved_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select
    rs.id,
    rs.task_id,
    rs.status,
    rs.error_count,
    rs.recovery_count,
    rs.first_error_at,
    rs.last_update_at,
    case when rs.status = 'resolved' then rs.last_update_at else null end
  from hermes.recovery_status rs
  where rs.build_tracker_id = p_build_id
  order by rs.last_update_at desc;
end $$;

comment on function public.get_build_recovery_status(uuid) is
  'Get recovery status history for a build';

-- ============================================================================
-- 5. HELPER: Auto-deprioritize failed builds
-- ============================================================================

create or replace function public.deprioritize_failed_build(p_build_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company_id uuid;
begin
  -- Set priority to 30 (lowest) for failed builds
  update public.build_priority_queue
  set current_priority = 30,
      recalc_reason = 'build_failed'
  where build_id = p_build_id;

  -- Trigger full company recalculation
  select company_id into v_company_id
  from public.build_tracker
  where id = p_build_id;

  if v_company_id is not null then
    perform public.recalc_build_priorities(v_company_id, 'build_failed');
  end if;
end $$;

comment on function public.deprioritize_failed_build(uuid) is
  'Manually deprioritize a failed build (priority 30)';

-- ============================================================================
-- 6. INTEGRATION NOTES FOR HERMES
-- ============================================================================

/*
  INTEGRATION CHECKLIST FOR HERMES:

  1. When Recovery Agent detects a failed task on a build:
     - Call link_recovery_to_build(task_id, build_id)
     - This links recovery tracking to the build

  2. When Recovery Agent resolves (recovery succeeds):
     - Update hermes.recovery_status.status = 'resolved'
     - Auto-trigger trg_recovery_completed
     - This re-evaluates autonomy and bumps priority back up

  3. When a build fails (status = 'failed'):
     - Optionally call deprioritize_failed_build(build_id)
     - Sets priority to 30 (lowest)
     - Auto-trigger on build status change handles this via trg_build_status_changed

  4. Dashboard can show:
     - get_build_recovery_status(build_id) to show recovery history
     - Priority changes via build_priority_queue.last_recalc_at
     - Autonomy changes via build_autonomy_score.last_evaluated_at
*/

-- ============================================================================
-- 7. VERSIONING: Record migration date
-- ============================================================================

comment on schema public is
  'Build Tracker and dependencies: migrations 113-117 (2026-05-31)
   - 113: Core tables (dependencies, priority_queue, autonomy_score, time_windows, agent_delivery, daily_summary)
   - 114: Topological sort with autonomy weighting + auto-triggers
   - 115: Daily summary generation + pg_cron (08:00 UTC)
   - 116: Hermes dispatch_queue integration + delivery tracking
   - 117: Recovery system integration + auto-reprioritization';
