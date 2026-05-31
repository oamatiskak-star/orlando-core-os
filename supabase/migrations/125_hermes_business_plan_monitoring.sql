-- ============================================================================
-- Migration 125: Hermes Business Plan Monitoring
-- ============================================================================
-- Enable Hermes to actively monitor progress against the Aquier master roadmap
-- Track milestone progress, identify risks, and proactively surface plan status

-- ============================================================================
-- 1. FUNCTION: Get current milestone status and progress
-- ============================================================================

create or replace function hermes.get_milestone_status(
  p_company_id uuid
)
returns table(
  milestone_id uuid,
  code text,
  name text,
  status text,
  priority text,
  month_index integer,
  mrr_target_eur numeric,
  customers_target integer,
  current_mrr numeric,
  current_customers integer,
  progress_percentage numeric,
  is_at_risk boolean,
  days_until_due integer
)
language plpgsql
security definer
set search_path = hermes
as $$
declare
  v_current_mrr numeric;
  v_current_customers integer;
  v_progress_percent numeric;
  v_at_risk boolean;
  v_days_due integer;
begin
  return query
  with milestones as (
    select
      id,
      code,
      name,
      status,
      priority,
      (metadata->>'month_index')::integer as month_index,
      (metadata->>'mrr_target_eur')::numeric as mrr_target_eur,
      (metadata->>'customers_target')::integer as customers_target,
      target_date
    from buildtracker.projects
    where company_id = p_company_id
      and module_ref = '25_IMPLEMENTATION_ROADMAP'
      and project_type = 'milestone'
  ),
  progress as (
    select
      m.id,
      m.code,
      m.name,
      m.status,
      m.priority,
      m.month_index,
      m.mrr_target_eur,
      m.customers_target,
      coalesce((select sum((metadata->>'mrr')::numeric)
        from hermes.metrics
        where company_id = p_company_id
          and metric_type = 'revenue'
          and recorded_at >= now()::date - interval '30 days'), 0) as current_mrr,
      coalesce((select count(*)
        from hermes.metrics
        where company_id = p_company_id
          and metric_type = 'customer_acquisition'
          and recorded_at >= now()::date - interval '30 days'), 0) as current_customers,
      case
        when m.mrr_target_eur > 0 then
          round((coalesce((select sum((metadata->>'mrr')::numeric)
            from hermes.metrics
            where company_id = p_company_id
              and metric_type = 'revenue'
              and recorded_at >= now()::date - interval '30 days'), 0) / m.mrr_target_eur) * 100, 1)
        else 0
      end as progress_pct,
      case
        when m.status = 'planned' and (m.target_date - now()::date) < interval '14 days' then true
        when m.status = 'in_progress' and (select count(*) from buildtracker.issues
          where project_id = m.id and status = 'blocked') > 0 then true
        when m.status = 'in_progress' and now()::date > m.target_date then true
        else false
      end as at_risk,
      extract(day from m.target_date - now()::date)::integer as days_due
    from milestones m
  )
  select
    p.id,
    p.code,
    p.name,
    p.status,
    p.priority,
    p.month_index,
    p.mrr_target_eur,
    p.customers_target,
    p.current_mrr,
    p.current_customers,
    p.progress_pct,
    p.at_risk,
    p.days_due
  from progress p
  order by p.month_index asc;
end $$;

comment on function hermes.get_milestone_status is
  'Fetch all milestones with current progress metrics and risk status';

-- ============================================================================
-- 2. FUNCTION: Identify milestones at risk and needing attention
-- ============================================================================

create or replace function hermes.identify_plan_risks(
  p_company_id uuid
)
returns table(
  milestone_code text,
  milestone_name text,
  risk_type text,
  risk_description text,
  severity text,
  recommended_action text
)
language plpgsql
security definer
set search_path = hermes
as $$
begin
  return query
  select
    m.code,
    m.name,
    case
      when m.status = 'in_progress' and m.days_until_due < 0 then 'overdue'
      when m.status = 'in_progress' and m.days_until_due between 0 and 7 then 'critical_deadline'
      when m.status = 'in_progress' and m.progress_percentage < 50 and m.days_until_due < 14 then 'slow_progress'
      when m.status = 'planned' and m.days_until_due < 14 then 'upcoming_milestone'
      when m.progress_percentage > 0 and m.progress_percentage < 25 then 'low_progress'
      else 'on_track'
    end as risk_type,
    case
      when m.status = 'in_progress' and m.days_until_due < 0 then 'Milestone ' || m.code || ' is overdue by ' || abs(m.days_until_due) || ' days'
      when m.status = 'in_progress' and m.days_until_due between 0 and 7 then 'Milestone ' || m.code || ' due in ' || m.days_until_due || ' days'
      when m.status = 'in_progress' and m.progress_percentage < 50 and m.days_until_due < 14 then 'Only ' || m.progress_percentage || '% progress on ' || m.code || ' with ' || m.days_until_due || ' days left'
      when m.status = 'planned' and m.days_until_due < 14 then 'Milestone ' || m.code || ' starts in ' || m.days_until_due || ' days'
      when m.progress_percentage > 0 and m.progress_percentage < 25 then 'Milestone ' || m.code || ' is ' || m.progress_percentage || '% complete but target is ' || m.mrr_target_eur || ' EUR'
      else 'On track'
    end as risk_description,
    case
      when m.status = 'in_progress' and m.days_until_due < 0 then 'critical'
      when m.status = 'in_progress' and m.days_until_due between 0 and 7 then 'high'
      when m.progress_percentage < 25 then 'high'
      when m.progress_percentage < 50 then 'medium'
      else 'low'
    end as severity,
    case
      when m.priority = 'critical' then 'Escalate immediately and assign additional resources'
      when m.days_until_due < 7 then 'Daily standup required, unblock any impediments'
      when m.progress_percentage < 50 then 'Review scope and timeline, consider phasing'
      else 'Continue as planned, monitor closely'
    end as recommended_action
  from hermes.get_milestone_status(p_company_id) m
  where m.is_at_risk = true
    or m.status = 'in_progress'
    or (m.status = 'planned' and m.days_until_due < 21)
  order by
    case when m.status = 'in_progress' and m.days_until_due < 0 then 1
         when m.status = 'in_progress' and m.days_until_due between 0 and 7 then 2
         when m.priority = 'critical' then 3
         else 4
    end,
    m.month_index asc;
end $$;

comment on function hermes.identify_plan_risks is
  'Analyze milestones for risks and recommend actions based on progress and timeline';

-- ============================================================================
-- 3. FUNCTION: Get next milestone focus
-- ============================================================================

create or replace function hermes.get_next_milestone_focus(
  p_company_id uuid
)
returns table(
  code text,
  name text,
  status text,
  days_until_due integer,
  target_mrr numeric,
  current_mrr numeric,
  target_customers integer,
  current_customers integer,
  priority text,
  focus_action text
)
language plpgsql
security definer
set search_path = hermes
as $$
begin
  return query
  select
    m.code,
    m.name,
    m.status,
    m.days_until_due,
    m.mrr_target_eur,
    m.current_mrr,
    m.customers_target,
    m.current_customers,
    m.priority,
    case
      when m.status = 'in_progress' and m.days_until_due < 7 then 'URGENT: ' || m.days_until_due || ' days to launch'
      when m.status = 'in_progress' then 'Executing: ' || round((m.current_mrr / nullif(m.mrr_target_eur, 0) * 100)::numeric, 0) || '% of target'
      when m.status = 'planned' and m.days_until_due <= 14 then 'Starting in ' || m.days_until_due || ' days'
      else 'Upcoming: ' || m.name
    end as focus_action
  from hermes.get_milestone_status(p_company_id) m
  order by
    case when m.status = 'in_progress' then 1 else 2 end,
    m.days_until_due asc
  limit 1;
end $$;

comment on function hermes.get_next_milestone_focus is
  'Get the most critical next milestone needing focus and attention';

-- ============================================================================
-- 4. FUNCTION: Generate plan-aware context for strategic responses
-- ============================================================================

create or replace function hermes.gather_business_plan_context(
  p_company_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = hermes
as $$
declare
  v_active_milestone jsonb;
  v_upcoming_milestone jsonb;
  v_risks jsonb;
  v_plan_health text;
  v_critical_count integer;
  v_result jsonb;
begin
  -- Get currently executing milestone
  select jsonb_build_object(
    'code', code,
    'name', name,
    'days_until_due', days_until_due,
    'progress_percentage', progress_percentage,
    'is_at_risk', is_at_risk
  ) into v_active_milestone
  from hermes.get_milestone_status(p_company_id)
  where status = 'in_progress'
  order by month_index asc
  limit 1;

  -- Get next upcoming milestone
  select jsonb_build_object(
    'code', code,
    'name', name,
    'days_until_due', days_until_due
  ) into v_upcoming_milestone
  from hermes.get_milestone_status(p_company_id)
  where status = 'planned'
    and days_until_due > 0
  order by month_index asc
  limit 1;

  -- Count risks
  select count(*) into v_critical_count
  from hermes.identify_plan_risks(p_company_id)
  where severity in ('critical', 'high');

  -- Collect risks
  select jsonb_agg(jsonb_build_object(
    'milestone', milestone_code,
    'type', risk_type,
    'severity', severity
  )) into v_risks
  from hermes.identify_plan_risks(p_company_id)
  where severity in ('critical', 'high');

  -- Determine plan health
  v_plan_health := case
    when v_critical_count > 0 then 'at_risk'
    when (select count(*) from hermes.get_milestone_status(p_company_id)
          where is_at_risk = true) > 0 then 'needs_attention'
    when (select count(*) from hermes.get_milestone_status(p_company_id)
          where status = 'in_progress') > 0 then 'executing'
    else 'on_track'
  end;

  v_result := jsonb_build_object(
    'active_milestone', coalesce(v_active_milestone, 'null'::jsonb),
    'upcoming_milestone', coalesce(v_upcoming_milestone, 'null'::jsonb),
    'critical_risks', v_critical_count,
    'risks', coalesce(v_risks, '[]'::jsonb),
    'plan_health', v_plan_health
  );

  return v_result;
end $$;

comment on function hermes.gather_business_plan_context is
  'Collect business plan status and milestone progress for strategic context';

-- ============================================================================
-- MIGRATION NOTES
-- ============================================================================

comment on migration is
  'Hermes Business Plan Monitoring:
   - get_milestone_status(): fetch all milestones with current progress, targets, and risk flags
   - identify_plan_risks(): analyze milestones for risks (overdue, slow progress, upcoming deadlines)
   - get_next_milestone_focus(): get the most critical next milestone requiring attention
   - gather_business_plan_context(): collect plan health, active/upcoming milestones, and identified risks
   - Enables Hermes to proactively surface plan status in strategic responses
   - Foundation for milestone-based prioritization and risk-driven recommendations
   - Integration point for dashboard milestones UI and progress tracking';
