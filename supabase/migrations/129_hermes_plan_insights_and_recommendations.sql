-- ============================================================================
-- Migration 129: Hermes Plan Insights and Recommendations
-- ============================================================================
-- Generate strategic insights and recommendations based on plan performance
-- Enhance Hermes' ability to suggest next steps aligned with business goals

-- ============================================================================
-- 1. FUNCTION: Generate plan performance summary
-- ============================================================================

create or replace function hermes.get_plan_performance_summary(p_company_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = hermes
as $$
declare
  v_total_milestones integer;
  v_completed_milestones integer;
  v_at_risk_count integer;
  v_critical_risks integer;
  v_on_track_count integer;
  v_completion_rate numeric;
  v_risk_level text;
  v_summary jsonb;
begin
  -- Get milestone counts
  select count(*) into v_total_milestones
  from buildtracker.projects
  where company_id = p_company_id
    and project_type = 'milestone';

  select count(*) into v_completed_milestones
  from buildtracker.projects
  where company_id = p_company_id
    and project_type = 'milestone'
    and status = 'completed';

  select count(*) into v_at_risk_count
  from hermes.get_milestone_status(p_company_id)
  where is_at_risk = true;

  select count(*) into v_critical_risks
  from hermes.identify_plan_risks(p_company_id)
  where severity = 'critical';

  select count(*) into v_on_track_count
  from hermes.get_milestone_status(p_company_id)
  where is_at_risk = false
    and status in ('in_progress', 'completed');

  v_completion_rate := case
    when v_total_milestones > 0 then round((v_completed_milestones::numeric / v_total_milestones) * 100, 1)
    else 0
  end;

  v_risk_level := case
    when v_critical_risks > 0 then 'critical'
    when v_at_risk_count > 2 then 'high'
    when v_at_risk_count > 0 then 'medium'
    else 'low'
  end;

  v_summary := jsonb_build_object(
    'total_milestones', v_total_milestones,
    'completed_milestones', v_completed_milestones,
    'completion_rate', v_completion_rate,
    'at_risk_count', v_at_risk_count,
    'critical_risks', v_critical_risks,
    'on_track_count', v_on_track_count,
    'overall_risk_level', v_risk_level,
    'health_trend', case
      when v_critical_risks = 0 and v_at_risk_count < 2 then 'improving'
      when v_critical_risks > 0 or v_at_risk_count > 3 then 'deteriorating'
      else 'stable'
    end
  );

  return v_summary;
end $$;

comment on function hermes.get_plan_performance_summary is
  'Get high-level summary of plan health, completion, and risk status';

-- ============================================================================
-- 2. FUNCTION: Generate strategic recommendations
-- ============================================================================

create or replace function hermes.get_strategic_recommendations(p_company_id uuid)
returns table(
  recommendation_id uuid,
  category text,
  priority text,
  title text,
  description text,
  rationale text,
  expected_impact text,
  effort_level text,
  owner_suggestion text
)
language plpgsql
security definer
set search_path = hermes
as $$
declare
  v_perf jsonb;
  v_next_milestone record;
  v_active_milestone record;
  v_high_risk_count integer;
begin
  -- Get performance summary
  v_perf := get_plan_performance_summary(p_company_id);

  -- Get active and next milestones
  select * into v_active_milestone from hermes.get_next_milestone_focus(p_company_id)
  where status = 'in_progress';

  select * into v_next_milestone from hermes.get_next_milestone_focus(p_company_id)
  where status = 'planned'
  limit 1;

  select count(*) into v_high_risk_count
  from hermes.identify_plan_risks(p_company_id)
  where severity in ('critical', 'high');

  -- Recommendation: Focus on active milestone
  if v_active_milestone is not null then
    return query select
      gen_random_uuid(),
      'execution'::text,
      'critical'::text,
      'Deliver ' || v_active_milestone.code || ' on schedule'::text,
      'Milestone ' || v_active_milestone.code || ' is currently executing with ' ||
        v_active_milestone.days_until_due || ' days remaining. Any delay will impact subsequent milestones.'::text,
      'Active milestones drive business momentum and fund future work'::text,
      'Successfully launching ' || v_active_milestone.code || ' unblocks ' || v_next_milestone.code ||
        ' and maintains market position'::text,
      'medium'::text,
      'Project Owner or VP Product'::text;
  end if;

  -- Recommendation: Address critical risks
  if (v_perf->>'critical_risks')::int > 0 then
    return query select
      gen_random_uuid(),
      'risk_management'::text,
      'critical'::text,
      'Resolve critical plan risks immediately'::text,
      'You have ' || (v_perf->>'critical_risks') || ' critical risks that could derail milestones. '::text ||
        'These require immediate escalation and resource allocation.'::text,
      'Unresolved critical risks compound and become impossible to recover from'::text,
      'Removing blockers and critical risks can accelerate delivery by 2-4 weeks per milestone'::text,
      'high'::text,
      'CEO / Executive Leadership'::text;
  end if;

  -- Recommendation: Prepare for upcoming milestone
  if v_next_milestone is not null and v_next_milestone.days_until_due <= 21 then
    return query select
      gen_random_uuid(),
      'planning'::text,
      'high'::text,
      'Begin preparation for ' || v_next_milestone.code || ' launch'::text,
      v_next_milestone.code || ' launches in ' || v_next_milestone.days_until_due ||
        ' days. Planning and prep work should start immediately.'::text,
      'Each milestone requires 2-3 weeks of preparation before execution'::text,
      'Early preparation prevents last-minute scrambles and quality issues'::text,
      'low'::text,
      'Project Lead'::text;
  end if;

  -- Recommendation: Stabilize operations
  if (v_perf->>'at_risk_count')::int > (v_perf->>'total_milestones')::int / 3 then
    return query select
      gen_random_uuid(),
      'stabilization'::text,
      'high'::text,
      'Stabilize plan execution across milestones'::text,
      'Over one-third of your milestones are at-risk. This indicates systemic issues with resource '::text ||
        'allocation, scope management, or dependencies.'::text,
      'Too many at-risk milestones suggests the plan itself may be overly ambitious or under-resourced'::text,
      'Stabilizing milestones improves predictability and builds confidence in planning'::text,
      'high'::text,
      'COO / Program Manager'::text;
  end if;

  -- Recommendation: Accelerate completion
  if (v_perf->>'completion_rate')::numeric > 50 then
    return query select
      gen_random_uuid(),
      'acceleration'::text,
      'medium'::text,
      'Accelerate remaining milestones'::text,
      'You''ve completed ' || (v_perf->>'completion_rate') || '% of planned milestones. '::text ||
        'With momentum, you can accelerate remaining work by 10-15%.'::text,
      'Momentum and team confidence increase delivery velocity in execution phases'::text,
      'Accelerating by 15% could advance final milestones by 3-6 weeks'::text,
      'low'::text,
      'Project Owner'::text;
  end if;
end $$;

comment on function hermes.get_strategic_recommendations is
  'Generate strategic recommendations based on current plan health and milestones';

-- ============================================================================
-- 3. Function to mark alerts as presented to Orlando
-- ============================================================================

create or replace function hermes.mark_alerts_presented(
  p_company_id uuid,
  p_milestone_id uuid default null
)
returns integer
language plpgsql
security definer
set search_path = hermes
as $$
declare
  v_count integer;
begin
  update hermes.milestone_alerts
  set presented_to_orlando = now()
  where company_id = p_company_id
    and presented_to_orlando is null
    and resolved_at is null
    and (p_milestone_id is null or milestone_id = p_milestone_id);

  get diagnostics v_count = row_count;
  return v_count;
end $$;

comment on function hermes.mark_alerts_presented is
  'Mark alerts as presented to Orlando to avoid duplicate surfacing';

-- ============================================================================
-- 4. Function to resolve an alert
-- ============================================================================

create or replace function hermes.resolve_milestone_alert(
  p_alert_id uuid,
  p_resolution_notes text default null
)
returns boolean
language plpgsql
security definer
set search_path = hermes
as $$
begin
  update hermes.milestone_alerts
  set
    resolved_at = now(),
    metadata = metadata || jsonb_build_object('resolution_notes', p_resolution_notes)
  where id = p_alert_id;

  return found;
end $$;

comment on function hermes.resolve_milestone_alert is
  'Mark an alert as resolved when the underlying issue is fixed';

-- ============================================================================
-- MIGRATION NOTES
-- ============================================================================

comment on migration is
  'Hermes Plan Insights and Recommendations:
   - get_plan_performance_summary(): health overview with completion rate and risk levels
   - get_strategic_recommendations(): AI-friendly list of actions based on plan state
   - mark_alerts_presented(): prevent duplicate alert surfacing to Orlando
   - resolve_milestone_alert(): track resolution of plan issues
   - Recommendations cover: execution focus, risk mitigation, prep work, stabilization, acceleration
   - Each recommendation includes rationale, expected impact, effort, and owner
   - Enables Hermes to suggest next steps and priorities aligned with business plan
   - Foundation for conversational planning and decision support';
