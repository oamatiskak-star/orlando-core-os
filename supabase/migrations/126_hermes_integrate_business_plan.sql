-- ============================================================================
-- Migration 126: Integrate Business Plan into Hermes Partnership
-- ============================================================================
-- Update Hermes strategic response generation to include business plan context
-- Ensure all recommendations are aligned with master Aquier roadmap

-- ============================================================================
-- 1. UPDATE FUNCTION: Enhanced gather_partnership_context with plan data
-- ============================================================================

create or replace function hermes.gather_partnership_context(
  p_company_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = hermes
as $$
declare
  v_critical_alerts integer;
  v_high_alerts integer;
  v_pending_tasks integer;
  v_overdue_payments integer;
  v_memory_items integer;
  v_recent_conversations jsonb;
  v_business_plan_context jsonb;
  v_result jsonb;
begin
  -- Count critical and high severity alerts
  select count(*) into v_critical_alerts from proactive_alerts
  where company_id = p_company_id
    and severity = 'critical'
    and resolved_at is null;

  select count(*) into v_high_alerts from proactive_alerts
  where company_id = p_company_id
    and severity = 'high'
    and resolved_at is null;

  -- Count pending tasks
  select count(*) into v_pending_tasks from notifications
  where company_id = p_company_id
    and status = 'pending'
    and is_memory = false;

  -- Count overdue payment alerts specifically
  select count(*) into v_overdue_payments from proactive_alerts
  where company_id = p_company_id
    and alert_type = 'payment_overdue'
    and resolved_at is null;

  -- Count memory items
  select count(*) into v_memory_items from notifications
  where company_id = p_company_id
    and is_memory = true
    and status = 'pending';

  -- Get recent conversation context
  select jsonb_agg(jsonb_build_object(
    'speaker', speaker,
    'message', message,
    'context_type', context_type
  )) into v_recent_conversations
  from conversations
  where company_id = p_company_id
    and conversation_date = now()::date
  order by sequence desc
  limit 5;

  -- Get business plan context
  v_business_plan_context := gather_business_plan_context(p_company_id);

  v_result := jsonb_build_object(
    'critical_alerts', coalesce(v_critical_alerts, 0),
    'high_alerts', coalesce(v_high_alerts, 0),
    'pending_tasks', coalesce(v_pending_tasks, 0),
    'overdue_payments', coalesce(v_overdue_payments, 0),
    'memory_items', coalesce(v_memory_items, 0),
    'recent_conversations', coalesce(v_recent_conversations, '[]'::jsonb),
    'business_plan', v_business_plan_context,
    'health_status', case
      when coalesce(v_critical_alerts, 0) > 0 then 'critical'
      when coalesce(v_high_alerts, 0) > 2 then 'warning'
      when coalesce(v_pending_tasks, 0) > 10 then 'busy'
      else 'stable'
    end
  );

  return v_result;
end $$;

comment on function hermes.gather_partnership_context is
  'Collect operational and business plan intelligence to inform partnership responses';

-- ============================================================================
-- 2. UPDATE FUNCTION: Enhanced generate_strategic_response with plan awareness
-- ============================================================================

create or replace function hermes.generate_strategic_response(
  p_company_id uuid,
  p_message text,
  p_conversation_turn text default 'orlando_request'
)
returns jsonb
language plpgsql
security definer
set search_path = hermes
as $$
declare
  v_intent jsonb;
  v_context jsonb;
  v_response text;
  v_recommendation text;
  v_concerns text[];
  v_insights text[];
  v_tone text;
  v_business_plan jsonb;
  v_active_milestone jsonb;
  v_plan_health text;
  v_result jsonb;
begin
  -- Analyze intent and gather context
  v_intent := analyze_user_intent(p_company_id, p_message);
  v_context := gather_partnership_context(p_company_id);

  -- Extract business plan data
  v_business_plan := v_context->'business_plan';
  v_active_milestone := v_business_plan->'active_milestone';
  v_plan_health := v_business_plan->>'plan_health';

  -- Set tone based on health status - elevated if plan at risk
  v_tone := case
    when v_context->>'health_status' = 'critical' then 'urgent_advisor'
    when v_business_plan->>'plan_health' = 'at_risk' then 'urgent_advisor'
    when v_context->>'health_status' = 'warning' then 'attentive_partner'
    when v_business_plan->>'plan_health' = 'needs_attention' then 'attentive_partner'
    else 'collaborative_partner'
  end;

  -- Build concerns array based on context and plan
  v_concerns := array[]::text[];
  if (v_context->>('critical_alerts'))::int > 0 then
    v_concerns := array_append(v_concerns,
      'We have ' || (v_context->>('critical_alerts')) || ' critical issues that need immediate attention');
  end if;
  if (v_context->>('overdue_payments'))::int > 0 then
    v_concerns := array_append(v_concerns,
      (v_context->>('overdue_payments')) || ' payment(s) are overdue — this will impact cash flow');
  end if;
  if (v_context->>('pending_tasks'))::int > 10 then
    v_concerns := array_append(v_concerns,
      'You have ' || (v_context->>('pending_tasks')) || ' pending tasks — we need to prioritize');
  end if;
  if v_plan_health = 'at_risk' then
    v_concerns := array_append(v_concerns,
      'Our master plan has critical risks that need immediate action — ' ||
      (v_business_plan->>'critical_risks') || ' milestones at risk');
  end if;
  if v_plan_health = 'needs_attention' then
    v_concerns := array_append(v_concerns,
      'Several milestones need attention to stay on track for our business plan');
  end if;

  -- Build insights based on intent, context, and plan
  v_insights := array[]::text[];
  if v_active_milestone is not null then
    v_insights := array_append(v_insights,
      'Right now we''re focused on ' || (v_active_milestone->>'code') || ' — ' ||
      (v_active_milestone->>'name'));
  end if;
  if v_intent->>'intent' = 'status_check' then
    v_insights := array_append(v_insights, 'Based on what I''m seeing, we''re ' || v_context->>'health_status');
    if (v_context->>('high_alerts'))::int > 0 then
      v_insights := array_append(v_insights, 'I''ve detected ' || (v_context->>('high_alerts')) || ' issues brewing');
    end if;
  elsif v_intent->>'intent' = 'advice_request' then
    v_insights := array_append(v_insights, 'Here''s what I recommend based on our current situation and master plan...');
  elsif v_intent->>'intent' = 'alert_query' then
    v_insights := array_append(v_insights, 'The alerts I''m tracking suggest we should act on this today');
  end if;

  -- Build response
  if array_length(v_concerns, 1) > 0 then
    v_response := 'Orlando, I need to be direct: ' || array_to_string(v_concerns, '; ') || '. ';
  else
    v_response := '';
  end if;

  if array_length(v_insights, 1) > 0 then
    v_response := v_response || array_to_string(v_insights, ' ');
  end if;

  -- Add partnership tone
  if v_tone = 'urgent_advisor' then
    v_response := v_response || ' What do you want to do first?';
  elsif v_tone = 'attentive_partner' then
    v_response := v_response || ' I''m ready to help you navigate this.';
  else
    v_response := v_response || ' How can I support you today?';
  end if;

  -- Build recommendation based on most pressing issues - prioritize plan milestones
  if v_plan_health = 'at_risk' then
    v_recommendation := 'The master plan is at risk — let''s address the critical milestones first to get back on track';
  elsif (v_context->>('critical_alerts'))::int > 0 then
    v_recommendation := 'Address the critical alerts immediately — they''re affecting operations and the plan';
  elsif (v_context->>('overdue_payments'))::int > 0 then
    v_recommendation := 'Let''s tackle the overdue payments first — this impacts our financial health and funding for the plan';
  elsif v_active_milestone is not null then
    v_recommendation := 'Let''s focus on delivering ' || (v_active_milestone->>'code') ||
      ' on schedule — it''s critical for the roadmap';
  elsif (v_context->>('pending_tasks'))::int > 5 then
    v_recommendation := 'We should prioritize and close out the pending tasks to reduce load on the plan timeline';
  else
    v_recommendation := 'Everything looks manageable right now — let''s keep focus on the master plan milestones';
  end if;

  v_result := jsonb_build_object(
    'response', v_response,
    'tone', v_tone,
    'recommendation', v_recommendation,
    'concerns', v_concerns,
    'insights', v_insights,
    'context', v_context,
    'intent', v_intent->>'intent',
    'plan_focused', v_plan_health != 'on_track'
  );

  return v_result;
end $$;

comment on function hermes.generate_strategic_response is
  'Generate partnership-style responses with plan-aware insights, recommendations, and collaborative tone';

-- ============================================================================
-- MIGRATION NOTES
-- ============================================================================

comment on migration is
  'Hermes Business Plan Integration:
   - Updated gather_partnership_context() to include business_plan data from new monitoring functions
   - Enhanced generate_strategic_response() to surface plan milestones and risks in all recommendations
   - Adjusts tone and priorities based on master plan health status
   - Enables Hermes to proactively surface plan risks before being asked
   - All strategic responses now aligned with Aquier roadmap execution priorities
   - Foundation for seamless plan-driven conversation and decision support';
