-- ============================================================================
-- Migration 124: Hermes Strategic Partnership Mode
-- ============================================================================
-- Transform Hermes from task executor to strategic business partner
-- Proactive insights, contextual analysis, collaborative tone

-- ============================================================================
-- 1. FUNCTION: Analyze user intent and context
-- ============================================================================

create or replace function hermes.analyze_user_intent(
  p_company_id uuid,
  p_message text
)
returns jsonb
language plpgsql
security definer
set search_path = hermes
as $$
declare
  v_intent text;
  v_keywords text[];
  v_is_question boolean;
  v_is_request boolean;
  v_result jsonb;
begin
  v_keywords := string_to_array(lower(p_message), ' ');
  v_is_question := p_message ilike '%?%';
  v_is_request := p_message ilike '%maak%' or p_message ilike '%doe%' or p_message ilike '%zet%';

  -- Detect intent type
  v_intent := case
    when p_message ilike '%onthoud%' or p_message ilike '%remember%' then 'memory'
    when p_message ilike '%waarschuwing%' or p_message ilike '%alert%' or p_message ilike '%problem%' then 'alert_query'
    when p_message ilike '%status%' or p_message ilike '%hoe gaat%' then 'status_check'
    when p_message ilike '%advies%' or p_message ilike '%wat moet%' or v_is_question then 'advice_request'
    when v_is_request then 'action_request'
    when p_message ilike '%bedankt%' or p_message ilike '%dank%' then 'acknowledgment'
    else 'general_inquiry'
  end;

  v_result := jsonb_build_object(
    'intent', v_intent,
    'is_question', v_is_question,
    'is_request', v_is_request,
    'keyword_count', array_length(v_keywords, 1)
  );

  return v_result;
end $$;

comment on function hermes.analyze_user_intent is
  'Parse user message to detect intent: memory, alert, status, advice, action, etc.';

-- ============================================================================
-- 2. FUNCTION: Gather contextual intelligence for response
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

  v_result := jsonb_build_object(
    'critical_alerts', coalesce(v_critical_alerts, 0),
    'high_alerts', coalesce(v_high_alerts, 0),
    'pending_tasks', coalesce(v_pending_tasks, 0),
    'overdue_payments', coalesce(v_overdue_payments, 0),
    'memory_items', coalesce(v_memory_items, 0),
    'recent_conversations', coalesce(v_recent_conversations, '[]'::jsonb),
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
  'Collect intelligence on current alerts, tasks, payments, memory to inform partnership response';

-- ============================================================================
-- 3. FUNCTION: Generate strategic partnership response
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
  v_result jsonb;
begin
  -- Analyze intent and gather context
  v_intent := analyze_user_intent(p_company_id, p_message);
  v_context := gather_partnership_context(p_company_id);

  -- Set tone based on health status
  v_tone := case
    when v_context->>'health_status' = 'critical' then 'urgent_advisor'
    when v_context->>'health_status' = 'warning' then 'attentive_partner'
    else 'collaborative_partner'
  end;

  -- Build concerns array based on context
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

  -- Build insights based on intent and context
  v_insights := array[]::text[];
  if v_intent->>'intent' = 'status_check' then
    v_insights := array_append(v_insights, 'Based on what I''m seeing, we''re ' || v_context->>'health_status');
    if (v_context->>('high_alerts'))::int > 0 then
      v_insights := array_append(v_insights, 'I''ve detected ' || (v_context->>('high_alerts')) || ' issues brewing');
    end if;
  elsif v_intent->>'intent' = 'advice_request' then
    v_insights := array_append(v_insights, 'Here''s what I recommend based on our current situation...');
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

  -- Build recommendation based on most pressing issues
  if (v_context->>('critical_alerts'))::int > 0 then
    v_recommendation := 'Address the critical alerts immediately — they''re affecting operations';
  elsif (v_context->>('overdue_payments'))::int > 0 then
    v_recommendation := 'Let''s tackle the overdue payments first — this impacts our financial health';
  elsif (v_context->>('pending_tasks'))::int > 5 then
    v_recommendation := 'We should prioritize and close out the pending tasks to reduce load';
  else
    v_recommendation := 'Everything looks manageable right now — focus on what matters most';
  end if;

  v_result := jsonb_build_object(
    'response', v_response,
    'tone', v_tone,
    'recommendation', v_recommendation,
    'concerns', v_concerns,
    'insights', v_insights,
    'context', v_context,
    'intent', v_intent->>'intent'
  );

  return v_result;
end $$;

comment on function hermes.generate_strategic_response is
  'Generate partnership-style responses with proactive insights, recommendations, and collaborative tone';

-- ============================================================================
-- 4. FUNCTION: Log conversation and extract actionable insights
-- ============================================================================

create or replace function hermes.log_conversation_turn(
  p_company_id uuid,
  p_speaker text,
  p_message text,
  p_context_type text default null,
  p_related_notifications jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = hermes
as $$
declare
  v_conversation_id uuid;
  v_date date := now()::date;
  v_sequence smallint;
begin
  -- Get next sequence number for today
  select coalesce(max(sequence), 0) + 1 into v_sequence
  from conversations
  where company_id = p_company_id
    and conversation_date = v_date;

  insert into conversations (
    company_id,
    conversation_date,
    sequence,
    speaker,
    message,
    context_type,
    related_notifications
  ) values (
    p_company_id,
    v_date,
    v_sequence,
    p_speaker,
    p_message,
    p_context_type,
    p_related_notifications
  )
  returning id into v_conversation_id;

  return v_conversation_id;
end $$;

comment on function hermes.log_conversation_turn is
  'Log each conversation turn with context for future analysis and continuity';

-- ============================================================================
-- MIGRATION NOTES
-- ============================================================================

comment on migration is
  'Hermes Strategic Partnership Mode:
   - analyze_user_intent(): detect whether user is asking, requesting, seeking advice
   - gather_partnership_context(): pull real-time intelligence on alerts, tasks, payments
   - generate_strategic_response(): create partnership-style responses with insights and recommendations
   - log_conversation_turn(): maintain conversation history for continuity and learning
   - Transforms Hermes from transactional to truly collaborative
   - Enables proactive problem surfacing, risk identification, and strategic guidance
   - Makes Hermes anticipate needs and recommend actions before being asked';
