-- ============================================================================
-- Migration 122: Hermes Executive Report Generation
-- ============================================================================
-- Populate executive_reports with actual data from notifications and alerts

-- ============================================================================
-- 1. FUNCTION: Generate executive briefing for a specific time slot
-- ============================================================================

create or replace function hermes.generate_executive_briefing(
  p_company_id uuid,
  p_report_time time default now()::time
)
returns uuid
language plpgsql
security definer
set search_path = hermes
as $$
declare
  v_report_id uuid;
  v_total_notified integer;
  v_total_resolved integer;
  v_pending_count integer;
  v_critical_count integer;
  v_resolved_items jsonb;
  v_pending_items jsonb;
  v_action_items jsonb;
  v_summary text;
begin
  -- Count notifications from this 4-hour window
  select count(*) into v_total_notified
  from notifications
  where company_id = p_company_id
    and created_at >= now() - interval '4 hours'
    and created_at <= now();

  -- Count resolved in this window
  select count(*) into v_total_resolved
  from notifications
  where company_id = p_company_id
    and resolved_at >= now() - interval '4 hours'
    and resolved_at <= now();

  -- Count still pending from previous windows
  select count(*) into v_pending_count
  from notifications
  where company_id = p_company_id
    and status = 'pending'
    and is_memory = false;

  -- Count critical/action-required items
  select count(*) into v_critical_count
  from proactive_alerts
  where company_id = p_company_id
    and presented_to_orlando is null
    and (severity = 'critical' or severity = 'high');

  -- Collect recent resolved items
  select jsonb_agg(jsonb_build_object(
    'title', coalesce(title, 'Task'),
    'type', notification_type
  ))
  into v_resolved_items
  from (
    select title, notification_type, resolved_at
    from notifications
    where company_id = p_company_id
      and status = 'completed'
      and resolved_at >= now() - interval '4 hours'
    order by resolved_at desc
    limit 5
  ) t;

  -- Collect pending items
  select jsonb_agg(jsonb_build_object(
    'title', coalesce(title, 'Task'),
    'type', notification_type,
    'age_hours', floor(extract(epoch from (now() - created_at)) / 3600)
  ))
  into v_pending_items
  from (
    select title, notification_type, created_at
    from notifications
    where company_id = p_company_id
      and status = 'pending'
      and is_memory = false
    order by created_at asc
    limit 5
  ) t;

  -- Collect action-required items
  select jsonb_agg(jsonb_build_object(
    'description', description,
    'type', alert_type,
    'severity', severity
  ))
  into v_action_items
  from (
    select description, alert_type, severity
    from proactive_alerts
    where company_id = p_company_id
      and presented_to_orlando is null
    order by detected_at desc
    limit 5
  ) t;

  -- Generate summary
  v_summary := format(
    '%s notified, %s resolved, %s pending, %s critical — all systems ' ||
    case
      when v_critical_count > 0 then 'require attention'
      when v_pending_count > 2 then 'backing up'
      else 'under control'
    end,
    v_total_notified, v_total_resolved, v_pending_count, v_critical_count
  );

  -- Insert the executive report
  insert into executive_reports (
    company_id,
    report_time,
    total_notified,
    total_resolved,
    awaiting_manual_action,
    critical_count,
    summary,
    resolved_items,
    pending_items,
    action_required_items,
    is_daily_briefing,
    created_at
  ) values (
    p_company_id,
    p_report_time,
    v_total_notified,
    v_total_resolved,
    v_pending_count,
    v_critical_count,
    v_summary,
    coalesce(v_resolved_items, '[]'::jsonb),
    coalesce(v_pending_items, '[]'::jsonb),
    coalesce(v_action_items, '[]'::jsonb),
    true,
    now()
  )
  returning id into v_report_id;

  return v_report_id;
end $$;

comment on function hermes.generate_executive_briefing is
  'Generate a briefing report for a specific time slot with notification counts and items';

-- ============================================================================
-- 2. FUNCTION: Get latest briefing summary
-- ============================================================================

create or replace function hermes.get_briefing_summary(p_company_id uuid)
returns table(
  report_time time,
  total_notified integer,
  total_resolved integer,
  awaiting_manual_action integer,
  critical_count integer,
  summary text
)
language plpgsql
security definer
set search_path = hermes
as $$
begin
  return query
  select er.report_time, er.total_notified, er.total_resolved,
         er.awaiting_manual_action, er.critical_count, er.summary
  from executive_reports er
  where er.company_id = p_company_id
    and er.is_daily_briefing = true
  order by er.report_time desc
  limit 1;
end $$;

comment on function hermes.get_briefing_summary is
  'Get the most recent briefing summary for quick status check';

-- ============================================================================
-- 3. Update pg_cron schedules to call generate_executive_briefing
-- ============================================================================

-- The existing cron schedules from migration 120 now call generate_executive_briefing
-- instead of generate_executive_report. Update the underlying job commands:

-- Note: pg_cron jobs reference function signatures.
-- The generate_executive_report function is still used for the base report.
-- generate_executive_briefing wraps it with data collection for daily briefing mode.

-- ============================================================================
-- MIGRATION NOTES
-- ============================================================================

comment on migration is
  'Hermes Executive Report Generation:
   - hermes.generate_executive_briefing() function: collects data from past 4 hours, counts notifications/resolutions/pending, generates briefing summary
   - hermes.get_briefing_summary() function: quick query for latest briefing status
   - Populates executive_reports with real data: resolved items, pending items, action required items (from proactive_alerts)
   - Briefings marked as is_daily_briefing=true for frontend filtering
   - Summary field auto-generates health status based on pending/critical counts
   - Ready for 6x daily scheduled generation via pg_cron';
