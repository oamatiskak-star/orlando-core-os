-- ============================================================================
-- Migration 115: Daily Summary Generation & pg_cron Scheduling
-- ============================================================================
-- Depends on: 113 (build_daily_summary), 114 (priority calculation)
-- Doel: Generate pre-computed daily summaries at 08:00 AM CET
-- ============================================================================

-- ============================================================================
-- 1. GENERATE_DAILY_BUILD_SUMMARY — Main summary function
-- ============================================================================

create or replace function public.generate_daily_build_summary(
  p_company_id uuid,
  p_date date default current_date
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_queued_count integer := 0;
  v_in_progress_count integer := 0;
  v_completed_count integer := 0;
  v_blocked_count integer := 0;
  v_fully_autonomous_count integer := 0;
  v_partially_autonomous_count integer := 0;
  v_manual_count integer := 0;
  v_agent_deliveries_count integer := 0;
  v_snapshot_data jsonb;

  v_queued_builds record[];
  v_in_progress_builds record[];
  v_completed_builds record[];
  v_agent_deliveries record[];

  v_temp_queued jsonb := '[]'::jsonb;
  v_temp_in_progress jsonb := '[]'::jsonb;
  v_temp_completed jsonb := '[]'::jsonb;
  v_temp_deliveries jsonb := '[]'::jsonb;

begin
  -- Count builds by status
  select count(*)
  into v_queued_count
  from public.build_tracker
  where company_id = p_company_id
    and status in ('planned', 'paused');

  select count(*)
  into v_in_progress_count
  from public.build_tracker
  where company_id = p_company_id
    and status in ('building', 'testing', 'deploying');

  select count(*)
  into v_completed_count
  from public.build_tracker
  where company_id = p_company_id
    and status = 'live';

  select count(*)
  into v_blocked_count
  from public.build_tracker
  where company_id = p_company_id
    and status = 'failed';

  -- Count by autonomy level
  select count(*)
  into v_fully_autonomous_count
  from public.build_autonomy_score bas
  join public.build_tracker bt on bt.id = bas.build_id
  where bt.company_id = p_company_id
    and bas.autonomy_level = 'full';

  select count(*)
  into v_partially_autonomous_count
  from public.build_autonomy_score bas
  join public.build_tracker bt on bt.id = bas.build_id
  where bt.company_id = p_company_id
    and bas.autonomy_level = 'partial';

  select count(*)
  into v_manual_count
  from public.build_autonomy_score bas
  join public.build_tracker bt on bt.id = bas.build_id
  where bt.company_id = p_company_id
    and bas.autonomy_level = 'manual';

  -- Count agent deliveries today
  select count(*)
  into v_agent_deliveries_count
  from public.build_agent_delivery bad
  join public.build_tracker bt on bt.id = bad.build_id
  where bt.company_id = p_company_id
    and date(bad.created_at) = p_date;

  -- Build top queued builds snapshot (priority 1-5)
  with top_queued as (
    select
      bt.id,
      bt.name,
      bt.status,
      bt.progress_pct,
      bpq.current_priority,
      bas.autonomy_level
    from public.build_tracker bt
    join public.build_priority_queue bpq on bpq.build_id = bt.id
    left join public.build_autonomy_score bas on bas.build_id = bt.id
    where bt.company_id = p_company_id
      and bt.status in ('planned', 'paused')
    order by bpq.current_priority asc
    limit 5
  )
  select jsonb_agg(jsonb_build_object(
    'id', id::text,
    'name', name,
    'status', status,
    'progress', progress_pct,
    'priority', current_priority,
    'autonomy', autonomy_level
  ))
  into v_temp_queued
  from top_queued;

  -- Build in-progress builds snapshot
  with top_in_progress as (
    select
      bt.id,
      bt.name,
      bt.status,
      bt.progress_pct,
      bpq.current_priority,
      bas.autonomy_level,
      bt.updated_at
    from public.build_tracker bt
    join public.build_priority_queue bpq on bpq.build_id = bt.id
    left join public.build_autonomy_score bas on bas.build_id = bt.id
    where bt.company_id = p_company_id
      and bt.status in ('building', 'testing', 'deploying')
    order by bt.updated_at desc
    limit 5
  )
  select jsonb_agg(jsonb_build_object(
    'id', id::text,
    'name', name,
    'status', status,
    'progress', progress_pct,
    'priority', current_priority,
    'autonomy', autonomy_level
  ))
  into v_temp_in_progress
  from top_in_progress;

  -- Build completed builds snapshot (today only)
  with today_completed as (
    select
      bt.id,
      bt.name,
      bt.status,
      bt.updated_at
    from public.build_tracker bt
    where bt.company_id = p_company_id
      and bt.status = 'live'
      and date(bt.updated_at) = p_date
    order by bt.updated_at desc
    limit 5
  )
  select jsonb_agg(jsonb_build_object(
    'id', id::text,
    'name', name,
    'completed_at', updated_at
  ))
  into v_temp_completed
  from today_completed;

  -- Build agent deliveries snapshot
  with today_deliveries as (
    select
      bad.id,
      bad.agent_name,
      bad.action_type,
      bad.result_status,
      bt.name as build_name,
      bad.created_at
    from public.build_agent_delivery bad
    join public.build_tracker bt on bt.id = bad.build_id
    where bt.company_id = p_company_id
      and date(bad.created_at) = p_date
    order by bad.created_at desc
    limit 10
  )
  select jsonb_agg(jsonb_build_object(
    'agent', agent_name,
    'action', action_type,
    'status', result_status,
    'build', build_name,
    'at', created_at
  ))
  into v_temp_deliveries
  from today_deliveries;

  -- Combine into snapshot
  v_snapshot_data := jsonb_build_object(
    'queued', coalesce(v_temp_queued, '[]'::jsonb),
    'in_progress', coalesce(v_temp_in_progress, '[]'::jsonb),
    'completed', coalesce(v_temp_completed, '[]'::jsonb),
    'agent_deliveries', coalesce(v_temp_deliveries, '[]'::jsonb),
    'generated_at', now()::text
  );

  -- Insert or update summary
  insert into public.build_daily_summary (
    company_id, summary_date,
    queued_count, in_progress_count, completed_count, blocked_count,
    fully_autonomous_count, partially_autonomous_count, manual_count,
    agent_deliveries_count, snapshot_data, generated_at
  )
  values (
    p_company_id, p_date,
    v_queued_count, v_in_progress_count, v_completed_count, v_blocked_count,
    v_fully_autonomous_count, v_partially_autonomous_count, v_manual_count,
    v_agent_deliveries_count, v_snapshot_data, now()
  )
  on conflict (company_id, summary_date) do update set
    queued_count = excluded.queued_count,
    in_progress_count = excluded.in_progress_count,
    completed_count = excluded.completed_count,
    blocked_count = excluded.blocked_count,
    fully_autonomous_count = excluded.fully_autonomous_count,
    partially_autonomous_count = excluded.partially_autonomous_count,
    manual_count = excluded.manual_count,
    agent_deliveries_count = excluded.agent_deliveries_count,
    snapshot_data = excluded.snapshot_data,
    generated_at = excluded.generated_at;

end $$;

-- ============================================================================
-- 2. GENERATE_ALL_DAILY_SUMMARIES — Generate for all companies
-- ============================================================================

create or replace function public.generate_all_daily_summaries(p_date date default current_date)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company record;
begin
  for v_company in
    select id from public.companies
  loop
    perform public.generate_daily_build_summary(v_company.id, p_date);
  end loop;
end $$;

-- ============================================================================
-- 3. SQL VIEWS for Dashboard
-- ============================================================================

-- View: Current priority ordering
create or replace view public.v_build_priority_queue as
  select
    bpq.build_id,
    bt.company_id,
    bt.name,
    bt.status,
    bt.progress_pct,
    bpq.current_priority,
    bpq.calculated_priority,
    bpq.manual_priority_override,
    bpq.depends_on_count,
    bpq.blocked_by_count,
    bpq.autonomy_boost_applied,
    bas.autonomy_level,
    bas.autonomy_pct,
    bas.can_execute_today,
    bpq.last_recalc_at,
    bpq.recalc_reason
  from public.build_priority_queue bpq
  join public.build_tracker bt on bt.id = bpq.build_id
  left join public.build_autonomy_score bas on bas.build_id = bpq.build_id
  order by bpq.current_priority asc;

comment on view public.v_build_priority_queue is
  'Current priority ordering with dependency and autonomy info';

-- View: Daily overview summary
create or replace view public.v_daily_build_overview as
  select
    bds.company_id,
    c.name as company_name,
    bds.summary_date,
    bds.queued_count,
    bds.in_progress_count,
    bds.completed_count,
    bds.blocked_count,
    (bds.queued_count + bds.in_progress_count + bds.completed_count + bds.blocked_count) as total_count,
    bds.fully_autonomous_count,
    bds.partially_autonomous_count,
    bds.manual_count,
    bds.agent_deliveries_count,
    bds.snapshot_data,
    bds.generated_at
  from public.build_daily_summary bds
  join public.companies c on c.id = bds.company_id
  order by bds.summary_date desc, bds.company_id;

comment on view public.v_daily_build_overview is
  'Daily summary overview with counts by status and autonomy level';

-- ============================================================================
-- 4. PG_CRON SCHEDULING — Daily summary at 08:00 AM CET
-- ============================================================================

-- Create extension if not exists
create extension if not exists pg_cron;

-- Schedule daily summary generation
-- 08:00 AM CET = 07:00 AM UTC (standard) / 06:00 AM UTC (daylight)
-- Using 07:00 UTC as safe time (covers both DST scenarios)
select cron.schedule(
  'build-tracker-daily-summary',
  '0 7 * * *',  -- Every day at 07:00 UTC
  'select public.generate_all_daily_summaries(current_date);'
);

-- ============================================================================
-- 5. INITIAL RUN — Generate summaries for today
-- ============================================================================

select public.generate_all_daily_summaries(current_date);
