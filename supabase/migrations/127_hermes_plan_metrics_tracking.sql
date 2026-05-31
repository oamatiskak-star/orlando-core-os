-- ============================================================================
-- Migration 127: Hermes Plan Metrics Tracking
-- ============================================================================
-- Track metrics against business plan targets
-- Enable proactive milestone risk detection

-- ============================================================================
-- 1. TABLE: Plan metrics tracking
-- ============================================================================

create table if not exists hermes.plan_metrics (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  milestone_id uuid not null references buildtracker.projects(id) on delete cascade,
  metric_type text not null check (metric_type in ('revenue', 'customers', 'churn', 'nps', 'implementation_progress')),
  metric_value numeric not null,
  target_value numeric,
  recorded_at timestamp with time zone default now(),
  notes text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create index idx_plan_metrics_company_id on hermes.plan_metrics(company_id);
create index idx_plan_metrics_milestone_id on hermes.plan_metrics(milestone_id);
create index idx_plan_metrics_recorded_at on hermes.plan_metrics(recorded_at desc);

-- ============================================================================
-- 2. TABLE: Plan milestone alerts
-- ============================================================================

create table if not exists hermes.milestone_alerts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  milestone_id uuid not null references buildtracker.projects(id) on delete cascade,
  alert_type text not null check (alert_type in ('overdue', 'at_risk', 'blocked', 'slow_progress', 'upcoming')),
  severity text not null check (severity in ('critical', 'high', 'medium', 'low')),
  description text not null,
  recommended_action text,
  detected_at timestamp with time zone default now(),
  presented_to_orlando timestamp with time zone,
  resolved_at timestamp with time zone,
  metadata jsonb default '{}'::jsonb,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create index idx_milestone_alerts_company_id on hermes.milestone_alerts(company_id);
create index idx_milestone_alerts_milestone_id on hermes.milestone_alerts(milestone_id);
create index idx_milestone_alerts_presented_to_orlando on hermes.milestone_alerts(presented_to_orlando);
create index idx_milestone_alerts_resolved_at on hermes.milestone_alerts(resolved_at);

-- ============================================================================
-- 3. FUNCTION: Log plan metric
-- ============================================================================

create or replace function hermes.log_plan_metric(
  p_company_id uuid,
  p_milestone_id uuid,
  p_metric_type text,
  p_metric_value numeric,
  p_target_value numeric default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = hermes
as $$
declare
  v_metric_id uuid;
begin
  insert into plan_metrics (
    company_id,
    milestone_id,
    metric_type,
    metric_value,
    target_value,
    notes
  ) values (
    p_company_id,
    p_milestone_id,
    p_metric_type,
    p_metric_value,
    p_target_value,
    p_notes
  )
  returning id into v_metric_id;

  return v_metric_id;
end $$;

comment on function hermes.log_plan_metric is
  'Record a metric against a milestone target (revenue, customers, progress, etc.)';

-- ============================================================================
-- 4. FUNCTION: Create milestone alert
-- ============================================================================

create or replace function hermes.create_milestone_alert(
  p_company_id uuid,
  p_milestone_id uuid,
  p_alert_type text,
  p_severity text,
  p_description text,
  p_recommended_action text default null
)
returns uuid
language plpgsql
security definer
set search_path = hermes
as $$
declare
  v_alert_id uuid;
  v_existing_alert uuid;
begin
  -- Check if similar unresolved alert exists
  select id into v_existing_alert
  from milestone_alerts
  where company_id = p_company_id
    and milestone_id = p_milestone_id
    and alert_type = p_alert_type
    and resolved_at is null
  limit 1;

  if v_existing_alert is not null then
    return v_existing_alert;
  end if;

  insert into milestone_alerts (
    company_id,
    milestone_id,
    alert_type,
    severity,
    description,
    recommended_action
  ) values (
    p_company_id,
    p_milestone_id,
    p_alert_type,
    p_severity,
    p_description,
    p_recommended_action
  )
  returning id into v_alert_id;

  return v_alert_id;
end $$;

comment on function hermes.create_milestone_alert is
  'Create or retrieve existing alert for a milestone issue';

-- ============================================================================
-- 5. FUNCTION: Generate plan-based proactive alerts
-- ============================================================================

create or replace function hermes.generate_plan_alerts(
  p_company_id uuid
)
returns table(
  milestone_id uuid,
  alert_id uuid,
  alert_type text,
  severity text,
  description text,
  action text
)
language plpgsql
security definer
set search_path = hermes
as $$
declare
  v_milestone record;
  v_alert_id uuid;
begin
  -- Check each milestone for risks
  for v_milestone in
    select
      m.id,
      m.code,
      m.name,
      m.status,
      m.target_date,
      (select count(*) from buildtracker.issues
       where project_id = m.id and status = 'blocked') as blocked_count,
      (select count(*) from buildtracker.issues
       where project_id = m.id and status = 'in_progress') as in_progress_count,
      (select sum((metadata->>'mrr')::numeric)
       from plan_metrics
       where milestone_id = m.id
       and metric_type = 'revenue'
       and recorded_at >= now()::date - interval '7 days') as current_mrr,
      (m.metadata->>'mrr_target_eur')::numeric as target_mrr
    from buildtracker.projects m
    where m.company_id = p_company_id
      and m.project_type = 'milestone'
  loop
    -- Overdue check
    if v_milestone.status = 'in_progress' and now()::date > v_milestone.target_date then
      v_alert_id := create_milestone_alert(
        p_company_id,
        v_milestone.id,
        'overdue',
        'critical',
        'Milestone ' || v_milestone.code || ' is overdue by ' ||
          extract(day from now()::date - v_milestone.target_date)::int || ' days',
        'Immediately escalate and review what''s blocking completion'
      );
      return query select v_milestone.id, v_alert_id, 'overdue'::text, 'critical'::text,
        'Overdue milestone requires immediate attention'::text, 'Escalate'::text;
    end if;

    -- Blocked check
    if v_milestone.blocked_count > 0 then
      v_alert_id := create_milestone_alert(
        p_company_id,
        v_milestone.id,
        'blocked',
        case when v_milestone.blocked_count > 2 then 'critical' else 'high' end,
        'Milestone ' || v_milestone.code || ' has ' || v_milestone.blocked_count || ' blocked tasks',
        'Unblock these tasks immediately to resume progress'
      );
      return query select v_milestone.id, v_alert_id, 'blocked'::text,
        (case when v_milestone.blocked_count > 2 then 'critical' else 'high' end)::text,
        'Multiple blocked tasks preventing progress'::text, 'Unblock immediately'::text;
    end if;

    -- Slow progress check (for in_progress milestones)
    if v_milestone.status = 'in_progress' and v_milestone.in_progress_count < 2 then
      v_alert_id := create_milestone_alert(
        p_company_id,
        v_milestone.id,
        'slow_progress',
        'medium',
        'Milestone ' || v_milestone.code || ' shows slow progress with only ' ||
          v_milestone.in_progress_count || ' tasks actively worked',
        'Increase focus and assign more resources if needed'
      );
      return query select v_milestone.id, v_alert_id, 'slow_progress'::text, 'medium'::text,
        'Low activity detected on milestone'::text, 'Increase focus'::text;
    end if;

    -- Revenue behind check (if we have target and current metrics)
    if v_milestone.target_mrr > 0 and v_milestone.current_mrr is not null then
      if v_milestone.current_mrr < (v_milestone.target_mrr * 0.5) then
        v_alert_id := create_milestone_alert(
          p_company_id,
          v_milestone.id,
          'at_risk',
          'high',
          'Milestone ' || v_milestone.code || ' at only ' ||
            round((v_milestone.current_mrr / v_milestone.target_mrr * 100)::numeric, 0) ||
            '% of revenue target',
          'Review pricing, customer acquisition, or adjust timeline if needed'
        );
        return query select v_milestone.id, v_alert_id, 'at_risk'::text, 'high'::text,
          'Milestone is behind on revenue targets'::text, 'Review strategy'::text;
      end if;
    end if;
  end loop;
end $$;

comment on function hermes.generate_plan_alerts is
  'Scan all milestones and generate alerts for risks, blockers, and slow progress';

-- ============================================================================
-- MIGRATION NOTES
-- ============================================================================

comment on migration is
  'Hermes Plan Metrics Tracking:
   - plan_metrics table: track revenue, customers, and other metrics against milestone targets
   - milestone_alerts table: store plan-based alerts with detection and resolution tracking
   - log_plan_metric(): record metric values from various sources
   - create_milestone_alert(): generate alerts for at-risk milestones, avoid duplicates
   - generate_plan_alerts(): scan all milestones and proactively identify risks
   - Foundation for automated milestone health monitoring and risk detection
   - Enables Hermes to surface plan risks before they become critical';
