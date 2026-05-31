-- ============================================================================
-- Migration 128: Hermes Plan Monitoring Scheduler
-- ============================================================================
-- Set up automated plan monitoring to continuously check milestone health

-- ============================================================================
-- 1. FUNCTION: Monitor all company plans and generate alerts
-- ============================================================================

create or replace function hermes.monitor_all_plans()
returns void
language plpgsql
security definer
set search_path = hermes
as $$
declare
  v_company_id uuid;
  v_alert_count integer;
begin
  -- For each company, generate plan alerts
  for v_company_id in select distinct company_id from buildtracker.projects
  loop
    -- Run plan alert generation
    perform * from generate_plan_alerts(v_company_id);

    -- Log that monitoring ran
    insert into hermes.conversation_logs (
      company_id,
      log_type,
      log_entry,
      metadata
    ) values (
      v_company_id,
      'plan_monitoring',
      'Plan monitoring check completed',
      jsonb_build_object('timestamp', now())
    );
  end loop;

  raise notice 'Plan monitoring completed for all companies at %', now();
end $$;

comment on function hermes.monitor_all_plans is
  'Scan plans for all companies and generate alerts for at-risk milestones';

-- ============================================================================
-- 2. FUNCTION: Refresh plan context for Hermes
-- ============================================================================

create or replace function hermes.refresh_plan_context(p_company_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = hermes
as $$
declare
  v_context jsonb;
begin
  -- First generate any new alerts
  perform * from generate_plan_alerts(p_company_id);

  -- Then gather fresh context
  v_context := gather_business_plan_context(p_company_id);

  return v_context;
end $$;

comment on function hermes.refresh_plan_context is
  'Generate fresh alerts and gather updated business plan context';

-- ============================================================================
-- 3. Set up cron schedule for continuous monitoring
-- ============================================================================

-- Schedule plan monitoring to run hourly
select cron.schedule(
  'hermes-plan-monitoring',
  '0 * * * *',  -- Every hour at minute 0
  'select hermes.monitor_all_plans();'
);

-- Schedule a more aggressive check every 15 minutes during business hours
select cron.schedule(
  'hermes-plan-monitoring-business-hours',
  '*/15 7-18 * * 1-5',  -- Every 15 min, 7am-6pm, Mon-Fri
  'select hermes.monitor_all_plans();'
);

-- ============================================================================
-- 4. Helper view for current plan alerts
-- ============================================================================

create or replace view hermes.active_plan_alerts as
select
  ma.id,
  ma.company_id,
  ma.milestone_id,
  bp.code as milestone_code,
  bp.name as milestone_name,
  ma.alert_type,
  ma.severity,
  ma.description,
  ma.recommended_action,
  ma.detected_at,
  ma.presented_to_orlando,
  ma.resolved_at,
  case
    when ma.resolved_at is not null then 'resolved'
    when ma.presented_to_orlando is not null then 'presented'
    else 'pending'
  end as status
from hermes.milestone_alerts ma
join buildtracker.projects bp on ma.milestone_id = bp.id
where ma.resolved_at is null
  and ma.presented_to_orlando is null
order by
  case when ma.severity = 'critical' then 1
       when ma.severity = 'high' then 2
       when ma.severity = 'medium' then 3
       else 4
  end,
  ma.detected_at desc;

comment on view hermes.active_plan_alerts is
  'Real-time view of unpresented, unresolved plan alerts requiring attention';

-- ============================================================================
-- MIGRATION NOTES
-- ============================================================================

comment on migration is
  'Hermes Plan Monitoring Scheduler:
   - monitor_all_plans(): scan all companies'' plans and generate alerts hourly
   - refresh_plan_context(): on-demand plan health refresh for Hermes
   - Automated cron schedules:
     * Hourly checks (0 * * * *)
     * 15-min checks during business hours (*/15 7-18 * * 1-5)
   - active_plan_alerts view: real-time window into unpresented critical alerts
   - Enables continuous background monitoring and proactive surfacing
   - Hermes can call refresh_plan_context() before each response for latest data';
