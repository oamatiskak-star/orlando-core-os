-- ============================================================================
-- Migration 123: Hermes Proactive Detection Scheduler
-- ============================================================================
-- Enable automatic detection and alerting for payment delays, missed deadlines, unresolved tasks

-- ============================================================================
-- 1. FUNCTION: Detect payment delays (overdue invoices/payments)
-- ============================================================================

create or replace function hermes.detect_payment_delays(p_company_id uuid)
returns integer
language plpgsql
security definer
set search_path = hermes
as $$
declare
  v_count integer := 0;
begin
  -- Insert payment delay alerts for invoices not paid within 30 days
  with payment_data as (
    select distinct
      n.id,
      n.title,
      (n.metadata->>'due_date')::date as due_date,
      (n.metadata->>'amount')::numeric as amount
    from notifications n
    where n.company_id = p_company_id
      and n.notification_type = 'invoice'
      and n.status = 'pending'
      and (n.metadata->>'due_date')::date < now()::date - interval '5 days'
      and not exists (
        select 1 from proactive_alerts pa
        where pa.company_id = p_company_id
          and pa.alert_type = 'payment_overdue'
          and pa.metadata->>'source_notification_id' = n.id::text
          and pa.resolved_at is null
      )
  )
  insert into proactive_alerts (
    company_id,
    alert_type,
    severity,
    description,
    affected_entity,
    detected_at,
    metadata
  )
  select
    p_company_id,
    'payment_overdue',
    case
      when (now()::date - due_date) > interval '30 days' then 'critical'
      else 'high'
    end::text,
    format(
      'Payment overdue: %s (due %s, %s days late) - €%s',
      coalesce(title, 'Invoice'),
      due_date::text,
      (now()::date - due_date)::integer,
      coalesce(amount::text, '?')
    ),
    'invoice',
    now(),
    jsonb_build_object(
      'due_date', due_date::text,
      'amount', amount::text,
      'days_overdue', (now()::date - due_date)::integer,
      'source_notification_id', id::text
    )
  from payment_data;

  select count(*) into v_count
  from proactive_alerts
  where company_id = p_company_id
    and alert_type = 'payment_overdue'
    and presented_to_orlando is null;

  return v_count;
end $$;

comment on function hermes.detect_payment_delays is
  'Detect invoices/payments overdue by more than 5 days, mark as critical if >30 days';

-- ============================================================================
-- 2. FUNCTION: Detect approaching deadlines
-- ============================================================================

create or replace function hermes.detect_approaching_deadlines(p_company_id uuid)
returns integer
language plpgsql
security definer
set search_path = hermes
as $$
declare
  v_count integer := 0;
begin
  -- Insert deadline alerts for tasks due within next 2 days but not yet completed
  with deadline_data as (
    select distinct
      pi.id,
      pi.title,
      pi.deadline,
      (now()::date - pi.deadline)::integer as days_until_due
    from planning_items pi
    where pi.company_id = p_company_id
      and pi.status != 'gereed'
      and pi.deadline between now()::date and now()::date + interval '2 days'
      and not exists (
        select 1 from proactive_alerts pa
        where pa.company_id = p_company_id
          and pa.alert_type = 'deadline_approaching'
          and pa.metadata->>'planning_item_id' = pi.id::text
          and pa.resolved_at is null
      )
  )
  insert into proactive_alerts (
    company_id,
    alert_type,
    severity,
    description,
    affected_entity,
    affected_entity_id,
    detected_at,
    metadata
  )
  select
    p_company_id,
    'deadline_approaching',
    case
      when days_until_due <= 0 then 'critical'
      when days_until_due = 1 then 'high'
      else 'medium'
    end::text,
    format(
      'Deadline approaching: %s %s',
      title,
      case
        when days_until_due < 0 then format('(OVERDUE by %s day(s))', abs(days_until_due))
        when days_until_due = 0 then '(DUE TODAY)'
        when days_until_due = 1 then '(due tomorrow)'
        else format('(due in %s day(s))', days_until_due)
      end
    ),
    'planning_item',
    id,
    now(),
    jsonb_build_object(
      'planning_item_id', id::text,
      'deadline', deadline::text,
      'days_until_due', days_until_due
    )
  from deadline_data;

  select count(*) into v_count
  from proactive_alerts
  where company_id = p_company_id
    and alert_type = 'deadline_approaching'
    and presented_to_orlando is null;

  return v_count;
end $$;

comment on function hermes.detect_approaching_deadlines is
  'Detect tasks/projects with deadlines within next 2 days, mark critical if overdue';

-- ============================================================================
-- 3. FUNCTION: Detect unresolved items (stale tasks)
-- ============================================================================

create or replace function hermes.detect_unresolved_items(p_company_id uuid)
returns integer
language plpgsql
security definer
set search_path = hermes
as $$
declare
  v_count integer := 0;
begin
  -- Insert alerts for notifications pending >48 hours
  with stale_data as (
    select distinct
      n.id,
      n.title,
      n.notification_type,
      extract(hour from (now() - n.created_at))::integer as hours_pending
    from notifications n
    where n.company_id = p_company_id
      and n.status = 'pending'
      and n.is_memory = false
      and n.created_at < now() - interval '48 hours'
      and not exists (
        select 1 from proactive_alerts pa
        where pa.company_id = p_company_id
          and pa.alert_type = 'unresolved_task'
          and pa.metadata->>'notification_id' = n.id::text
          and pa.resolved_at is null
      )
  )
  insert into proactive_alerts (
    company_id,
    alert_type,
    severity,
    description,
    affected_entity,
    detected_at,
    metadata
  )
  select
    p_company_id,
    'unresolved_task',
    case
      when hours_pending > 168 then 'critical'
      when hours_pending > 72 then 'high'
      else 'medium'
    end::text,
    format(
      'Stale item: %s (%s pending for %s hours)',
      coalesce(title, 'Task'),
      notification_type,
      hours_pending
    ),
    notification_type,
    now(),
    jsonb_build_object(
      'notification_id', id::text,
      'hours_pending', hours_pending,
      'days_pending', (hours_pending / 24)::integer
    )
  from stale_data;

  select count(*) into v_count
  from proactive_alerts
  where company_id = p_company_id
    and alert_type = 'unresolved_task'
    and presented_to_orlando is null;

  return v_count;
end $$;

comment on function hermes.detect_unresolved_items is
  'Detect notifications pending >48 hours, mark critical if >7 days stale';

-- ============================================================================
-- 4. FUNCTION: Run all proactive detections for a company
-- ============================================================================

create or replace function hermes.run_proactive_detections(p_company_id uuid)
returns table(
  detection_type text,
  alerts_created integer
)
language plpgsql
security definer
set search_path = hermes
as $$
declare
  v_payment_count integer;
  v_deadline_count integer;
  v_stale_count integer;
begin
  -- Run all three detection functions
  v_payment_count := detect_payment_delays(p_company_id);
  v_deadline_count := detect_approaching_deadlines(p_company_id);
  v_stale_count := detect_unresolved_items(p_company_id);

  return query
  values
    ('payment_overdue'::text, v_payment_count),
    ('deadline_approaching'::text, v_deadline_count),
    ('unresolved_task'::text, v_stale_count);
end $$;

comment on function hermes.run_proactive_detections is
  'Execute all proactive detection functions and return results';

-- ============================================================================
-- 5. Schedule proactive detections to run 4x daily (every 6 hours)
-- ============================================================================

-- Note: pg_cron schedules are defined in migration 120
-- Add these if pg_cron is available:
-- SELECT cron.schedule('hermes-detect-payment-delays-00', '0 * * * *',
--   'SELECT hermes.detect_payment_delays(company_id) FROM public.companies');
-- SELECT cron.schedule('hermes-detect-deadlines-00', '0 * * * *',
--   'SELECT hermes.detect_approaching_deadlines(company_id) FROM public.companies');
-- SELECT cron.schedule('hermes-detect-stale-00', '0 * * * *',
--   'SELECT hermes.detect_unresolved_items(company_id) FROM public.companies');

-- ============================================================================
-- MIGRATION NOTES
-- ============================================================================

comment on migration is
  'Hermes Proactive Detection Scheduler:
   - hermes.detect_payment_delays(): find invoices overdue >5 days (critical if >30 days)
   - hermes.detect_approaching_deadlines(): find tasks due within 2 days (critical if overdue)
   - hermes.detect_unresolved_items(): find notifications stale >48 hours (critical if >7 days)
   - hermes.run_proactive_detections(): execute all detection functions for a company
   - Detections avoid duplicate alerts by checking existing unresolved proactive_alerts
   - Ready for pg_cron scheduling to run 4x daily
   - Populates proactive_alerts table with real-world business intelligence
   - Enables Hermes to autonomously detect issues and alert Orlando to action them';
