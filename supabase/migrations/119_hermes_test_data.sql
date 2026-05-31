-- ============================================================================
-- Migration 119: Hermes Test Data — Populate test records for Hermes monitoring
-- ============================================================================
-- Purpose: Create realistic test data for Hermes autonomous recovery system
--          to verify entity flow through error detection, recovery, and resolution
-- ============================================================================

-- Ensure we have test companies
do $$
declare
  v_company_id uuid;
  v_build_id uuid;
  v_delivery_id uuid;
begin
  -- Create or get test company
  insert into public.companies (name, slug, short, role, color, type)
  values ('Test Company', 'test-company', 'TST', 'werkmaatschappij', '#8b5cf6', 'real_estate')
  on conflict (slug) do nothing
  returning id into v_company_id;

  -- Get test company if insert didn't return it
  if v_company_id is null then
    select id into v_company_id from public.companies where slug = 'test-company';
  end if;

  -- Create test build tracker records
  insert into public.build_tracker (
    company_id, name, description, status, progress_pct, owner,
    current_milestone, started_at, target_at, requires_account_setup, account_status
  ) values
    (v_company_id, 'Feature: Payment Integration', 'Integrating Stripe payment processing', 'building', 45, 'John Dev', 'Phase 2: Testing', now() - interval '5 days', now() + interval '10 days', false, 'completed'),
    (v_company_id, 'Bugfix: Email Delivery', 'Fixing intermittent email failures', 'testing', 80, 'Jane QA', 'Final Validation', now() - interval '2 days', now() + interval '3 days', false, 'completed'),
    (v_company_id, 'Refactor: Database Layer', 'Optimizing query performance', 'paused', 25, null, 'Planning', now() - interval '7 days', now() + interval '21 days', true, 'pending')
  on conflict do nothing;

  -- Create test failed deliveries for Hermes recovery
  insert into public.build_agent_delivery (
    build_id, agent_name, agent_role, action_type, result_status, description,
    result_metadata, executed_at, completed_at
  )
  select
    id, 'DeployAgent', 'deployment', 'deploy_service', 'failed',
    'Service deployment timed out — connection refused to registry',
    jsonb_build_object('error', 'timeout', 'service', 'api-gateway', 'timestamp', now()::text),
    now() - interval '30 minutes', now() - interval '25 minutes'
  from public.build_tracker
  where company_id = v_company_id and status in ('building', 'testing')
  limit 2
  on conflict do nothing;

  -- Create test error records
  insert into hermes.error_records (
    company_id, entity_type, entity_id, error_code, error_message,
    error_context, severity, is_critical, created_at
  ) values
    (v_company_id, 'build_delivery', (select id from public.build_agent_delivery limit 1), 'DELIVERY_TIMEOUT',
     'Agent delivery exceeded timeout threshold',
     jsonb_build_object('agent', 'DeployAgent', 'action', 'deploy_service'), 'error', false, now() - interval '25 minutes'),
    (v_company_id, 'build_delivery', (select id from public.build_agent_delivery where result_status = 'failed' limit 1 offset 1), 'SERVICE_UNREACHABLE',
     'Cannot reach deployment service',
     jsonb_build_object('service', 'registry', 'host', 'registry.internal'), 'warning', false, now() - interval '22 minutes'),
    (v_company_id, 'workflow', null, 'WORKFLOW_VALIDATION_ERROR',
     'Workflow validation failed — missing required field',
     jsonb_build_object('field', 'timeout_ms', 'workflow', 'payment-processor'), 'warning', false, now() - interval '15 minutes')
  on conflict do nothing;

  -- Create test recovery status records — active and resolved
  insert into hermes.recovery_status (
    company_id, task_id, task_type, status, first_error_at, last_update_at,
    error_count, recovery_count, latest_error_id, is_escalated, metadata
  ) values
    (v_company_id, 'delivery_' || (select id from public.build_agent_delivery limit 1)::text, 'failed_delivery', 'active',
     now() - interval '25 minutes', now() - interval '2 minutes',
     3, 1, (select id from hermes.error_records limit 1), false,
     jsonb_build_object('last_attempt', 'retry_with_backoff', 'next_retry', (now() + interval '5 minutes')::text)),
    (v_company_id, 'wf_validation_001', 'workflow_validation', 'resolved',
     now() - interval '20 minutes', now() - interval '5 minutes',
     1, 1, (select id from hermes.error_records where error_code = 'WORKFLOW_VALIDATION_ERROR' limit 1), false,
     jsonb_build_object('resolution', 'auto_corrected', 'corrected_at', (now() - interval '5 minutes')::text)),
    (v_company_id, 'svc_unreachable_001', 'service_availability', 'active',
     now() - interval '22 minutes', now() - interval '1 minute',
     5, 2, (select id from hermes.error_records where error_code = 'SERVICE_UNREACHABLE' limit 1), true,
     jsonb_build_object('escalation_reason', 'max_retries_exceeded', 'escalated_at', (now() - interval '10 minutes')::text))
  on conflict do nothing;

  -- Create test recovery logs
  insert into hermes.recovery_logs (
    company_id, recovery_status_id, action_type, action_result, duration_ms,
    error_details, success, metadata
  )
  select
    v_company_id, id, 'auto_retry', 'partial_success', 8234,
    jsonb_build_object('attempt', 1, 'backoff_ms', 5000),
    false, jsonb_build_object('retry_count', 3)
  from hermes.recovery_status
  where company_id = v_company_id and status = 'active'
  limit 2
  on conflict do nothing;

  -- Create test escalation records
  insert into hermes.escalations (
    company_id, recovery_status_id, escalation_reason, assigned_to,
    priority, status, notes, created_at
  )
  select
    v_company_id, id, 'max_retries_exceeded', 'ops-team',
    'high', 'pending', 'Service registry appears to be down — manual intervention required',
    now() - interval '10 minutes'
  from hermes.recovery_status
  where company_id = v_company_id and is_escalated = true
  limit 1
  on conflict do nothing;

end $$;

-- Insert archive test data for completeness
do $$
declare
  v_company_id uuid;
begin
  select id into v_company_id from public.companies where slug = 'test-company' limit 1;

  if v_company_id is not null then
    -- Archive some old test recovery records
    insert into hermes.recovery_status_archive (
      task_id, task_type, status, first_error_at, last_update_at,
      error_count, recovery_count, is_escalated, metadata,
      archived_at, original_created_at, original_updated_at
    ) values
      ('archived_delivery_001', 'failed_delivery', 'resolved',
       now() - interval '45 days', now() - interval '44 days',
       8, 3, false, jsonb_build_object('final_status', 'resolved'),
       now(), now() - interval '45 days', now() - interval '44 days'),
      ('archived_task_002', 'workflow_validation', 'failed',
       now() - interval '50 days', now() - interval '49 days',
       12, 5, true, jsonb_build_object('final_status', 'escalated'),
       now(), now() - interval '50 days', now() - interval '49 days')
    on conflict do nothing;
  end if;
end $$;

-- Record audit
comment on migration is
  'Hermes Test Data:
   - 3 test builds with varying statuses (building, testing, paused)
   - 2 failed agent deliveries for recovery testing
   - 3 error records across different entity types
   - 3 recovery status records (2 active, 1 resolved)
   - Recovery logs showing retry attempts
   - Escalation records for critical issues
   - Archive records for testing cleanup workflows
   All data scoped to test-company entity for safe isolation';
