-- ============================================================================
-- Migration 120: Hermes CEO Orchestration System
-- ============================================================================
-- Purpose: Make Hermes the autonomous CEO agent that orchestrates all systems,
--          aggregates notifications, auto-resolves issues, and reports 6x daily
-- ============================================================================

-- ============================================================================
-- 1. HERMES_NOTIFICATIONS — Unified notification aggregation
-- ============================================================================

create table if not exists hermes.notifications (
  id                    uuid primary key default gen_random_uuid(),
  company_id            uuid not null references public.companies(id) on delete cascade,

  -- Source identification
  source_system         text not null, -- 'youtube_agent', 'build_tracker', 'mail_ops', 'workflow', etc.
  source_entity_type    text, -- 'video', 'build', 'email', etc.
  source_entity_id      uuid,

  -- Notification content
  title                 text not null,
  description           text,
  notification_type     text not null, -- 'error', 'warning', 'success', 'info'
  severity              text not null, -- 'critical', 'high', 'medium', 'low'

  -- Hermes action tracking
  status                text not null default 'pending', -- 'pending', 'acknowledged', 'auto_resolved', 'escalated', 'resolved'
  hermes_action         text, -- description of what Hermes did
  auto_resolution_type  text, -- 'retry', 'fallback', 'workaround', etc.

  -- Escalation
  escalated_to_ceo      boolean default false,
  escalation_reason     text,
  requires_manual_action boolean default false,
  manual_action_type    text,

  -- Metadata
  metadata              jsonb default '{}'::jsonb,
  created_at            timestamptz not null default now(),
  processed_at          timestamptz,
  resolved_at           timestamptz
);

create index if not exists idx_notifications_company on hermes.notifications (company_id);
create index if not exists idx_notifications_status on hermes.notifications (status);
create index if not exists idx_notifications_severity on hermes.notifications (severity);
create index if not exists idx_notifications_created on hermes.notifications (created_at);
create index if not exists idx_notifications_escalated on hermes.notifications (escalated_to_ceo);

comment on table hermes.notifications is
  'Unified notification aggregation — all system alerts flow through Hermes for orchestration';

-- ============================================================================
-- 2. HERMES_EXECUTIVE_REPORTS — CEO briefing reports (6x daily)
-- ============================================================================

create table if not exists hermes.executive_reports (
  id                    uuid primary key default gen_random_uuid(),
  company_id            uuid not null references public.companies(id) on delete cascade,

  -- Report metadata
  report_number         serial,
  report_period_start   timestamptz not null,
  report_period_end     timestamptz not null,
  scheduled_for         timestamptz not null, -- when this report was scheduled

  -- Summary statistics
  total_notifications   integer not null default 0,
  auto_resolved_count   integer not null default 0,
  escalated_count       integer not null default 0,
  manual_actions_needed integer not null default 0,

  -- Content
  summary_text          text,
  auto_resolved_items   jsonb default '[]'::jsonb, -- array of {title, action, timestamp}
  escalated_items       jsonb default '[]'::jsonb, -- array of {title, reason, timestamp}
  manual_actions        jsonb default '[]'::jsonb, -- array of {action_type, description, priority}

  -- Report status
  status                text not null default 'scheduled', -- 'scheduled', 'generated', 'delivered'
  delivered_at          timestamptz,
  ceo_acknowledged      boolean default false,
  ceo_acknowledged_at   timestamptz,

  created_at            timestamptz not null default now()
);

create index if not exists idx_reports_company on hermes.executive_reports (company_id);
create index if not exists idx_reports_period on hermes.executive_reports (report_period_start, report_period_end);
create index if not exists idx_reports_status on hermes.executive_reports (status);

comment on table hermes.executive_reports is
  'CEO executive briefing reports — generated 6x daily summarizing all system activity';

-- ============================================================================
-- 3. HERMES_AGENT_COMMANDS — Orchestration commands from Hermes to other agents
-- ============================================================================

create table if not exists hermes.agent_commands (
  id                    uuid primary key default gen_random_uuid(),
  company_id            uuid not null references public.companies(id) on delete cascade,

  -- Target agent
  target_agent          text not null, -- 'claude', 'chatgpt', 'youtube_agent', 'build_agent', etc.
  command_type          text not null, -- 'execute', 'retry', 'escalate', 'report', etc.

  -- Command
  command_description   text not null,
  command_parameters    jsonb,
  priority              text not null default 'normal', -- 'critical', 'high', 'normal', 'low'

  -- Status
  status                text not null default 'pending', -- 'pending', 'acknowledged', 'executing', 'completed', 'failed'
  initiated_by          text not null default 'hermes_orchestrator',

  -- Response
  response              jsonb,
  execution_time_ms     integer,
  completed_at          timestamptz,

  created_at            timestamptz not null default now()
);

create index if not exists idx_commands_company on hermes.agent_commands (company_id);
create index if not exists idx_commands_agent on hermes.agent_commands (target_agent);
create index if not exists idx_commands_status on hermes.agent_commands (status);

comment on table hermes.agent_commands is
  'Hermes orchestration commands sent to other agents (Claude, ChatGPT, build agents, etc.)';

-- ============================================================================
-- 4. FUNCTION: ROUTE_NOTIFICATION_TO_HERMES
-- ============================================================================

create or replace function hermes.route_notification_to_hermes(
  p_company_id uuid,
  p_source_system text,
  p_source_entity_type text,
  p_source_entity_id uuid,
  p_title text,
  p_description text,
  p_notification_type text,
  p_severity text,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = hermes
as $$
declare
  v_notification_id uuid;
begin
  -- Create notification record
  insert into notifications (
    company_id, source_system, source_entity_type, source_entity_id,
    title, description, notification_type, severity, metadata, status
  ) values (
    p_company_id, p_source_system, p_source_entity_type, p_source_entity_id,
    p_title, p_description, p_notification_type, p_severity, p_metadata, 'pending'
  )
  returning id into v_notification_id;

  -- Trigger async Hermes processing
  perform pg_notify('hermes_notifications', jsonb_build_object(
    'notification_id', v_notification_id,
    'company_id', p_company_id,
    'severity', p_severity
  )::text);

  return v_notification_id;
end $$;

comment on function hermes.route_notification_to_hermes is
  'Route system notifications to Hermes for orchestration and auto-resolution';

-- ============================================================================
-- 5. FUNCTION: GENERATE_EXECUTIVE_REPORT
-- ============================================================================

create or replace function hermes.generate_executive_report(
  p_company_id uuid,
  p_period_start timestamptz,
  p_period_end timestamptz
)
returns table (
  report_id uuid,
  total_notifications integer,
  auto_resolved integer,
  escalated integer,
  manual_actions integer
)
language plpgsql
security definer
set search_path = hermes
as $$
declare
  v_report_id uuid;
  v_total integer;
  v_auto_resolved integer;
  v_escalated integer;
  v_manual integer;
  v_auto_items jsonb;
  v_escalated_items jsonb;
  v_manual_items jsonb;
begin
  -- Collect statistics
  select
    count(*),
    count(*) filter (where status = 'auto_resolved'),
    count(*) filter (where escalated_to_ceo = true),
    count(*) filter (where requires_manual_action = true)
  into v_total, v_auto_resolved, v_escalated, v_manual
  from notifications
  where company_id = p_company_id
    and created_at >= p_period_start
    and created_at < p_period_end;

  -- Collect auto-resolved items
  select jsonb_agg(jsonb_build_object(
    'title', title,
    'action', hermes_action,
    'resolved_at', resolved_at
  ))
  into v_auto_items
  from notifications
  where company_id = p_company_id
    and status = 'auto_resolved'
    and created_at >= p_period_start
    and created_at < p_period_end
  limit 10;

  -- Collect escalated items
  select jsonb_agg(jsonb_build_object(
    'title', title,
    'reason', escalation_reason,
    'severity', severity,
    'escalated_at', created_at
  ))
  into v_escalated_items
  from notifications
  where company_id = p_company_id
    and escalated_to_ceo = true
    and created_at >= p_period_start
    and created_at < p_period_end
  limit 10;

  -- Collect manual actions needed
  select jsonb_agg(jsonb_build_object(
    'action_type', manual_action_type,
    'title', title,
    'priority', severity,
    'description', description
  ))
  into v_manual_items
  from notifications
  where company_id = p_company_id
    and requires_manual_action = true
    and created_at >= p_period_start
    and created_at < p_period_end
  limit 15;

  -- Create report
  insert into executive_reports (
    company_id, report_period_start, report_period_end, scheduled_for,
    total_notifications, auto_resolved_count, escalated_count, manual_actions_needed,
    auto_resolved_items, escalated_items, manual_actions, status
  ) values (
    p_company_id, p_period_start, p_period_end, now(),
    v_total, v_auto_resolved, v_escalated, v_manual,
    coalesce(v_auto_items, '[]'::jsonb),
    coalesce(v_escalated_items, '[]'::jsonb),
    coalesce(v_manual_items, '[]'::jsonb),
    'generated'
  )
  returning id into v_report_id;

  return query select v_report_id, v_total, v_auto_resolved, v_escalated, v_manual;
end $$;

comment on function hermes.generate_executive_report is
  'Generate CEO executive briefing report for a 4-hour period (6x daily)';

-- ============================================================================
-- 6. SCHEDULE HERMES EXECUTIVE REPORTS (6x Daily via pg_cron)
-- ============================================================================

-- 00:00 UTC
select cron.schedule(
  'hermes_executive_report_0000',
  '0 0 * * *',
  $$select hermes.generate_executive_report(c.id, (now() - interval '4 hours')::date, now())
    from public.companies c$$
);

-- 04:00 UTC
select cron.schedule(
  'hermes_executive_report_0400',
  '0 4 * * *',
  $$select hermes.generate_executive_report(c.id, (now() - interval '4 hours')::date, now())
    from public.companies c$$
);

-- 08:00 UTC
select cron.schedule(
  'hermes_executive_report_0800',
  '0 8 * * *',
  $$select hermes.generate_executive_report(c.id, (now() - interval '4 hours')::date, now())
    from public.companies c$$
);

-- 12:00 UTC
select cron.schedule(
  'hermes_executive_report_1200',
  '0 12 * * *',
  $$select hermes.generate_executive_report(c.id, (now() - interval '4 hours')::date, now())
    from public.companies c$$
);

-- 16:00 UTC
select cron.schedule(
  'hermes_executive_report_1600',
  '0 16 * * *',
  $$select hermes.generate_executive_report(c.id, (now() - interval '4 hours')::date, now())
    from public.companies c$$
);

-- 20:00 UTC
select cron.schedule(
  'hermes_executive_report_2000',
  '0 20 * * *',
  $$select hermes.generate_executive_report(c.id, (now() - interval '4 hours')::date, now())
    from public.companies c$$
);

-- ============================================================================
-- 7. INITIALIZATION: Enable Hermes as system orchestrator
-- ============================================================================

insert into public.build_cleanup_retention_policy (
  company_id, auto_archive_enabled, archive_instead_of_delete
)
select id, true, true
from public.companies c
where not exists (
  select 1 from public.build_cleanup_retention_policy p
  where p.company_id = c.id
)
on conflict do nothing;

-- ============================================================================
-- MIGRATION NOTES
-- ============================================================================

comment on migration is
  'Hermes CEO Orchestration System:
   - Unified notification aggregation (all system alerts → Hermes)
   - Auto-resolution with configurable decision logic
   - Escalation to CEO for manual action items
   - 6x daily executive briefings (every 4 hours)
   - Agent orchestration commands (Hermes controls other agents)
   - Real-time processing via LISTEN/NOTIFY
   - Full audit trail of all actions taken';
