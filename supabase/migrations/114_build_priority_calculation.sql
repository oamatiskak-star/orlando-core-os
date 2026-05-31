-- ============================================================================
-- Migration 114: Topological Sort with Autonomy Weighting & Auto-Triggers
-- ============================================================================
-- Depends on: 113 (build_project_dependencies, build_priority_queue, build_autonomy_score)
-- Doel: Calculate project priority based on dependencies and autonomy level
-- ============================================================================

-- ============================================================================
-- 1. TOPOLOGICAL SORT with Autonomy Weighting (Kahn's algorithm)
-- ============================================================================

create or replace function public.calculate_project_priority_order(p_company_id uuid)
returns table (
  build_id uuid,
  calculated_priority integer,
  depends_on_count integer,
  blocked_by_count integer,
  autonomy_boost_applied integer,
  has_cycle boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_has_cycle boolean := false;
  v_max_iter integer := 1000;
  v_iter integer := 0;

  -- Result arrays
  v_build_ids uuid[] := array[]::uuid[];
  v_priorities integer[] := array[]::int[];
  v_depends_counts integer[] := array[]::int[];
  v_blocked_counts integer[] := array[]::int[];
  v_autonomy_boosts integer[] := array[]::int[];

  -- Working data
  v_in_degree record;
  v_queue_build_id uuid;
  v_queue_priority integer;
  v_edge record;
  v_idx integer;
  v_autonomy_level text;
  v_autonomy_boost integer;

begin
  -- Build in-degree map: count incoming edges (dependencies) per build
  create temp table temp_in_degree (
    build_id uuid primary key,
    in_degree integer not null default 0
  );

  create temp table temp_queue (
    build_id uuid not null,
    priority_num integer not null
  );

  -- Populate in-degree for all builds in company
  insert into temp_in_degree (build_id, in_degree)
  select bt.id, 0
  from public.build_tracker bt
  where bt.company_id = p_company_id;

  -- Update in-degree based on dependencies (count incoming edges)
  update temp_in_degree td
  set in_degree = (
    select count(*)
    from public.build_project_dependencies bpd
    where bpd.target_build_id = td.build_id
  );

  -- Start with builds that have no dependencies (in_degree = 0)
  insert into temp_queue (build_id, priority_num)
  select build_id, 1
  from temp_in_degree
  where in_degree = 0
  order by build_id;

  -- Process queue using Kahn's algorithm
  while (select count(*) from temp_queue) > 0 and v_iter < v_max_iter loop
    v_iter := v_iter + 1;

    -- Dequeue first item
    select build_id, priority_num into v_queue_build_id, v_queue_priority
    from temp_queue
    limit 1;

    delete from temp_queue where build_id = v_queue_build_id;

    -- Add build to result
    v_build_ids := array_append(v_build_ids, v_queue_build_id);
    v_priorities := array_append(v_priorities, v_queue_priority);

    -- Get autonomy level for this build (priority boost)
    select autonomy_level into v_autonomy_level
    from public.build_autonomy_score
    where build_id = v_queue_build_id;

    v_autonomy_boost := case
      when v_autonomy_level = 'full' then 10
      when v_autonomy_level = 'partial' then 5
      else 0
    end;

    v_autonomy_boosts := array_append(v_autonomy_boosts, v_autonomy_boost);

    -- Find all builds that depend on this one
    for v_edge in
      select target_build_id
      from public.build_project_dependencies
      where source_build_id = v_queue_build_id
        and relationship_type = 'blocks'
    loop
      -- Decrement in-degree for dependent build
      update temp_in_degree
      set in_degree = in_degree - 1
      where build_id = v_edge.target_build_id;

      -- If in-degree reaches 0, add to queue with higher priority
      if (select in_degree from temp_in_degree where build_id = v_edge.target_build_id) = 0 then
        insert into temp_queue (build_id, priority_num)
        values (v_edge.target_build_id, v_queue_priority + 1);
      end if;
    end loop;
  end loop;

  -- Check for cycles: if any build still has in_degree > 0, cycle exists
  v_has_cycle := (select count(*) from temp_in_degree where in_degree > 0) > 0;

  -- Return all builds with their calculated priorities
  -- Builds not in the topological order (due to cycles) get priority 30 (lowest)
  return query
  with sorted_builds as (
    select
      build_id,
      row_number() over (order by array_position(v_build_ids, build_id) asc) as seq,
      array_position(v_build_ids, build_id) as pos
    from temp_in_degree
  ),
  with_priority as (
    select
      build_id,
      case
        when pos is not null then
          least(30, greatest(1, pos + (v_autonomy_boosts[pos])::int))
        else 30  -- Cyclic builds get lowest priority
      end as calculated_priority,
      case when pos is not null then
        (select count(*) from public.build_project_dependencies
         where target_build_id = sb.build_id)
      else 0 end as depends_on_count,
      case when pos is not null then
        (select count(*) from public.build_project_dependencies
         where source_build_id = sb.build_id)
      else 0 end as blocked_by_count,
      coalesce(v_autonomy_boosts[pos], 0) as autonomy_boost_applied
    from sorted_builds sb
  )
  select
    build_id,
    calculated_priority,
    depends_on_count,
    blocked_by_count,
    autonomy_boost_applied,
    v_has_cycle
  from with_priority;

end $$;

-- ============================================================================
-- 2. EVALUATE BUILD AUTONOMY — Check Hermes capability
-- ============================================================================

create or replace function public.evaluate_build_autonomy(p_build_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_build_status text;
  v_hermes_workflow_exists boolean;
  v_workflow_id uuid;
  v_required_approvals text[];
  v_required_skills text[];
  v_external_integrations text[];
  v_risk_level text;
  v_autonomy_pct numeric(5,2);
  v_autonomy_level text;
  v_can_execute_today boolean;
  v_blocking_factors jsonb;
  v_confidence numeric(3,2);
  v_est_completion_hours integer;
begin
  -- Fetch build status
  select status into v_build_status
  from public.build_tracker
  where id = p_build_id;

  -- Check if Hermes workflow exists (look for hermes.workflows referencing this build)
  v_hermes_workflow_exists := exists (
    select 1 from hermes.workflows
    where metadata->>'build_id' = p_build_id::text
  );

  -- TODO: Check required approvals from metadata (if workflow exists)
  v_required_approvals := array[]::text[];

  -- TODO: Check required skills from workflow
  v_required_skills := array[]::text[];

  -- TODO: Check external integrations
  v_external_integrations := array[]::text[];

  -- Risk assessment (default medium, adjust based on build type/status)
  v_risk_level := case
    when v_build_status = 'failed' then 'high'
    when v_build_status = 'paused' then 'medium'
    when v_build_status = 'live' then 'low'
    else 'medium'
  end;

  -- Blocking factors
  v_blocking_factors := jsonb_build_object(
    'no_workflow', not v_hermes_workflow_exists,
    'status_blocked', v_build_status in ('paused', 'failed')
  );

  -- Autonomy scoring:
  -- - full (90-100%): workflow exists, no approvals, no blockers
  -- - partial (50-89%): workflow exists, some approvals needed
  -- - manual (0-49%): no workflow or critical blockers
  v_autonomy_pct := case
    when not v_hermes_workflow_exists then 10
    when v_build_status in ('paused', 'failed') then 20
    when v_build_status = 'building' then 70
    when v_build_status = 'live' then 95
    else 50
  end;

  v_autonomy_level := case
    when v_autonomy_pct >= 85 then 'full'
    when v_autonomy_pct >= 50 then 'partial'
    else 'manual'
  end;

  v_can_execute_today := (v_autonomy_level = 'full' and v_build_status = 'building');

  v_est_completion_hours := case
    when v_autonomy_level = 'full' then 4
    when v_autonomy_level = 'partial' then 8
    else 24
  end;

  v_confidence := 0.85::numeric(3,2);  -- Default confidence

  -- Update or insert autonomy score
  insert into public.build_autonomy_score (
    build_id, autonomy_level, autonomy_pct, hermes_workflow_exists,
    required_approvals, required_skills, external_integrations,
    risk_level, blocking_factors, can_execute_today,
    estimated_completion_time_hours, last_evaluated_at, confidence_score
  )
  values (
    p_build_id, v_autonomy_level, v_autonomy_pct, v_hermes_workflow_exists,
    v_required_approvals, v_required_skills, v_external_integrations,
    v_risk_level, v_blocking_factors, v_can_execute_today,
    v_est_completion_hours, now(), v_confidence
  )
  on conflict (build_id) do update set
    autonomy_level = excluded.autonomy_level,
    autonomy_pct = excluded.autonomy_pct,
    hermes_workflow_exists = excluded.hermes_workflow_exists,
    required_approvals = excluded.required_approvals,
    required_skills = excluded.required_skills,
    external_integrations = excluded.external_integrations,
    risk_level = excluded.risk_level,
    blocking_factors = excluded.blocking_factors,
    can_execute_today = excluded.can_execute_today,
    estimated_completion_time_hours = excluded.estimated_completion_time_hours,
    last_evaluated_at = excluded.last_evaluated_at,
    confidence_score = excluded.confidence_score,
    updated_at = now();

end $$;

-- ============================================================================
-- 3. RECALCULATE PRIORITIES — Main function called on changes
-- ============================================================================

create or replace function public.recalc_build_priorities(
  p_company_id uuid,
  p_reason text default 'manual'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result record;
  v_current_priority integer;
begin
  -- Calculate new priorities
  for v_result in
    select *
    from public.calculate_project_priority_order(p_company_id)
  loop
    -- Determine final priority (manual override takes precedence)
    select manual_priority_override into v_current_priority
    from public.build_priority_queue
    where build_id = v_result.build_id;

    if v_current_priority is null then
      v_current_priority := v_result.calculated_priority;
    end if;

    -- Update priority queue
    insert into public.build_priority_queue (
      build_id, company_id, calculated_priority, current_priority,
      depends_on_count, blocked_by_count, autonomy_boost_applied,
      last_recalc_at, recalc_reason
    )
    values (
      v_result.build_id,
      p_company_id,
      v_result.calculated_priority,
      v_current_priority,
      v_result.depends_on_count,
      v_result.blocked_by_count,
      v_result.autonomy_boost_applied,
      now(),
      p_reason
    )
    on conflict (build_id) do update set
      calculated_priority = excluded.calculated_priority,
      current_priority = coalesce(excluded.manual_priority_override, excluded.calculated_priority),
      depends_on_count = excluded.depends_on_count,
      blocked_by_count = excluded.blocked_by_count,
      autonomy_boost_applied = excluded.autonomy_boost_applied,
      last_recalc_at = excluded.last_recalc_at,
      recalc_reason = excluded.recalc_reason,
      updated_at = now();
  end loop;

end $$;

-- ============================================================================
-- 4. AUTO-TRIGGERS — Recalculate on changes
-- ============================================================================

-- Trigger on dependency change
create or replace function public.trg_dependency_changed()
returns trigger language plpgsql as $$
declare
  v_company_id uuid;
begin
  -- Get company_id from source build
  select company_id into v_company_id
  from public.build_tracker
  where id = coalesce(new.source_build_id, old.source_build_id);

  if v_company_id is not null then
    perform public.recalc_build_priorities(v_company_id, 'dependency_change');
  end if;

  return coalesce(new, old);
end $$;

drop trigger if exists trg_build_deps_changed on public.build_project_dependencies;
create trigger trg_build_deps_changed
  after insert or update or delete on public.build_project_dependencies
  for each row execute function public.trg_dependency_changed();

-- Trigger on build status change
create or replace function public.trg_build_status_changed()
returns trigger language plpgsql as $$
begin
  if old.status is distinct from new.status then
    -- Evaluate autonomy on status change
    perform public.evaluate_build_autonomy(new.id);

    -- Recalculate priorities for this company
    perform public.recalc_build_priorities(new.company_id, 'status_change');
  end if;

  return new;
end $$;

drop trigger if exists trg_build_tracker_status_changed on public.build_tracker;
create trigger trg_build_tracker_status_changed
  after update on public.build_tracker
  for each row execute function public.trg_build_status_changed();

-- Trigger on autonomy change
create or replace function public.trg_autonomy_changed()
returns trigger language plpgsql as $$
declare
  v_company_id uuid;
  v_autonomy_changed boolean;
begin
  v_autonomy_changed := (
    old.autonomy_level is distinct from new.autonomy_level or
    old.autonomy_pct is distinct from new.autonomy_pct
  );

  if v_autonomy_changed then
    select company_id into v_company_id
    from public.build_tracker
    where id = new.build_id;

    if v_company_id is not null then
      perform public.recalc_build_priorities(v_company_id, 'autonomy_change');
    end if;
  end if;

  return new;
end $$;

drop trigger if exists trg_autonomy_score_changed on public.build_autonomy_score;
create trigger trg_autonomy_score_changed
  after update on public.build_autonomy_score
  for each row execute function public.trg_autonomy_changed();

-- ============================================================================
-- 5. INITIAL CALCULATION — Run topological sort for all companies
-- ============================================================================

do $$
declare
  v_company record;
begin
  for v_company in select distinct id from public.companies loop
    perform public.recalc_build_priorities(v_company.id, 'initial');
  end loop;
end$$;
