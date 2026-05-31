-- ============================================================================
-- Migration 112: Hermes Recovery Agent — Error tracking, pattern detection,
--                mutual monitoring, and intelligent auto-recovery
-- ============================================================================
-- Project: Orlando Core OS
-- Date:    2026-05-31
-- Author:  Hermes Recovery Architecture
--
-- PURPOSE:
--   Centralized error tracking and intelligent recovery system that:
--   1. Monitors ALL task executions across the system (event-driven)
--   2. Detects error patterns (2x same error = SYSTEMIC ISSUE)
--   3. Manages recovery attempts with intelligent strategies
--   4. Enables mutual monitoring between Recovery Agent ↔ Render Workers
--   5. Provides real-time error classification and escalation
--
-- SCHEMA ADDITIONS TO hermes.*:
--   - error_events: All errors with classification
--   - error_patterns: Detected patterns across tasks
--   - recovery_attempts: Track recovery actions & outcomes
--   - mutual_health: Recovery Agent ↔ Worker health checks
--   - recovery_strategies: Strategy definitions per error type
--
-- COORDINATION:
--   Deploy after migration 104 (hermes_init.sql)
--   Hermes subagent must be registered via application code
-- ============================================================================

-- ============================================================================
-- 1. ERROR CLASSIFICATION & EVENT STREAM
-- ============================================================================

create table if not exists hermes.error_types (
  id                uuid primary key default gen_random_uuid(),
  code              text not null unique,           -- 'upload_stuck', 'quota_exceeded', etc
  name              text not null,
  category          text not null,                  -- 'transient' | 'permanent' | 'resource' | 'systemic'
  description       text,
  default_strategy  text not null,                  -- recovery strategy name
  max_retries       integer not null default 5,
  retry_delay_ms    integer not null default 5000,
  escalate_after    integer not null default 3,     -- escalate after N failures
  created_at        timestamptz not null default now()
);

comment on table hermes.error_types is
  'Error type definitions with classification, strategies, and retry policies';

comment on column hermes.error_types.category is
  'transient: retry with backoff | permanent: escalate | resource: wait | systemic: alert ops';

create index hermes_error_types_category_idx on hermes.error_types (category);

-- Insert default error types
insert into hermes.error_types (code, name, category, description, default_strategy, max_retries, escalate_after)
values
  ('upload_stuck', 'Upload Stuck (2hr+ no progress)', 'transient', 'Task stuck in uploading state', 'retry_upload', 5, 2),
  ('processing_failed', 'YouTube Processing Failed', 'permanent', 'YouTube API processing returned failed', 'retranscode_reupload', 5, 1),
  ('thumbnail_missing', 'Thumbnail Not Visible', 'transient', 'Thumbnail upload succeeded but not visible on YouTube', 'reupload_thumbnail', 3, 2),
  ('scheduled_publish_failed', 'Scheduled Publish Failed', 'transient', 'Could not set video to public at scheduled time', 'force_public', 3, 1),
  ('copyright_detected', 'Copyright/Policy Block', 'permanent', 'Video blocked by YouTube copyright/policy', 'manual_review', 1, 1),
  ('browser_check_failed', 'Playback Verification Failed', 'transient', 'Video not accessible via browser after upload', 'retry_verification', 4, 2),
  ('quota_exceeded', 'API Quota Exceeded', 'resource', 'YouTube Data API quota limit reached', 'wait_quota_reset', 1, 1),
  ('network_timeout', 'Network Timeout', 'transient', 'Network request timed out', 'retry_exponential', 5, 3),
  ('worker_crash', 'Worker Process Crashed', 'systemic', 'Worker process died unexpectedly', 'restart_worker', 2, 1),
  ('config_invalid', 'Invalid Configuration', 'permanent', 'Task configuration is invalid', 'manual_review', 1, 1)
on conflict (code) do nothing;

-- ============================================================================
-- 2. ERROR EVENT STREAM (all errors, real-time)
-- ============================================================================

create table if not exists hermes.error_events (
  id                      uuid primary key default gen_random_uuid(),
  error_type_id           uuid references hermes.error_types(id) on delete set null,
  error_code              text not null,              -- redundant for speed

  -- Context: what task failed?
  task_id                 text not null,              -- youtube_queue.id | routine.id | etc
  task_type               text not null,              -- 'youtube_upload' | 'routine_run' | 'analytics' | etc
  entity_id               text,                       -- video_id, channel_id, etc

  -- Error details
  message                 text not null,
  stack_trace             text,
  error_metadata          jsonb not null default '{}'::jsonb,  -- source, status codes, api responses, etc

  -- Recovery tracking
  attempt_number          integer not null default 1,
  previous_error_id       uuid references hermes.error_events(id) on delete set null,  -- chain of errors

  -- Classification
  severity                text not null default 'error'
                            check (severity in ('info','warning','error','critical')),
  is_pattern_duplicate    boolean not null default false,  -- true if 2nd+ occurrence of same error
  pattern_cluster_id      uuid,                       -- link to error_patterns

  -- Timing
  occurred_at             timestamptz not null default now(),
  detected_at             timestamptz not null default now(),

  -- Worker context
  worker_id               text,                       -- UUID of worker that discovered error
  render_container        text,                       -- Render container ID if applicable

  -- Audit
  created_by              text default 'hermes',
  created_at              timestamptz not null default now()
);

comment on table hermes.error_events is
  'Stream of ALL errors in the system with full context for pattern detection and recovery';

comment on column hermes.error_events.pattern_cluster_id is
  'Set when 2+ errors of same type occur within 24h window → triggers SYSTEMIC alert';

create index hermes_error_events_task_idx on hermes.error_events (task_id, task_type);
create index hermes_error_events_error_code_idx on hermes.error_events (error_code, created_at desc);
create index hermes_error_events_pattern_idx on hermes.error_events (pattern_cluster_id) where pattern_cluster_id is not null;
create index hermes_error_events_severity_idx on hermes.error_events (severity, created_at desc);
create index hermes_error_events_worker_idx on hermes.error_events (worker_id, created_at desc) where worker_id is not null;

-- ============================================================================
-- 3. ERROR PATTERN DETECTION
-- ============================================================================

create table if not exists hermes.error_patterns (
  id                    uuid primary key default gen_random_uuid(),
  error_code            text not null,

  -- Pattern characteristics
  occurrences_24h       integer not null default 0,
  unique_tasks          integer not null default 0,
  unique_workers        integer not null default 0,

  -- First detection
  first_error_id        uuid references hermes.error_events(id) on delete set null,
  first_occurred_at     timestamptz not null,

  -- Latest occurrence
  latest_error_id       uuid references hermes.error_events(id) on delete set null,
  latest_occurred_at    timestamptz not null,

  -- Pattern severity
  is_systemic           boolean not null default false,  -- true if 2+ errors in 24h
  alert_sent_at         timestamptz,                  -- when ops alert was sent
  alert_acknowledged_at timestamptz,

  -- Root cause hypothesis
  suspected_cause       text,                         -- e.g. "quota reset pending", "network degradation"
  remediation_action    text,                         -- e.g. "wait for quota reset", "restart worker"
  remediation_executed_at timestamptz,
  remediation_effective boolean,                      -- did it work?

  -- Tracking
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

comment on table hermes.error_patterns is
  'Detected error patterns across tasks. 2+ same error in 24h = SYSTEMIC ISSUE';

comment on column hermes.error_patterns.is_systemic is
  'Set to true when 2 errors detected → triggers automatic ops alert and escalation';

create index hermes_error_patterns_error_code_idx on hermes.error_patterns (error_code);
create index hermes_error_patterns_is_systemic_idx on hermes.error_patterns (is_systemic) where is_systemic;
create index hermes_error_patterns_latest_idx on hermes.error_patterns (latest_occurred_at desc);

-- ============================================================================
-- 4. RECOVERY STRATEGIES (configurable per error type)
-- ============================================================================

create table if not exists hermes.recovery_strategies (
  id                    uuid primary key default gen_random_uuid(),
  error_type_id         uuid references hermes.error_types(id) on delete cascade,
  error_code            text not null,

  strategy_name         text not null,                -- 'retry_upload', 'retranscode_reupload', etc
  description           text,

  -- Strategy parameters
  action_type           text not null,                -- 'retry', 'retranscode', 'escalate', 'wait', 'skip'
  config                jsonb not null default '{}'::jsonb,  -- strategy-specific config

  -- Timing
  delay_ms              integer not null default 5000,
  timeout_ms            integer not null default 60000,
  max_attempts          integer not null default 5,
  backoff_multiplier    numeric not null default 2.0,  -- exponential backoff

  -- Conditions
  enabled               boolean not null default true,
  conditions            jsonb not null default '{}'::jsonb,  -- conditions for applying this strategy

  -- Audit
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

comment on table hermes.recovery_strategies is
  'Predefined recovery strategies with parameters, timing, and success conditions';

create index hermes_recovery_strategies_error_code_idx on hermes.recovery_strategies (error_code);
create index hermes_recovery_strategies_enabled_idx on hermes.recovery_strategies (enabled) where enabled;

-- Insert default strategies
insert into hermes.recovery_strategies
  (error_code, strategy_name, description, action_type, delay_ms, timeout_ms, max_attempts, backoff_multiplier)
values
  ('upload_stuck', 'retry_upload', 'Cancel stuck upload and retry', 'retry', 5000, 120000, 5, 2.0),
  ('processing_failed', 'retranscode_reupload', 'Retranscode and re-upload video', 'retranscode', 10000, 300000, 3, 1.5),
  ('thumbnail_missing', 'reupload_thumbnail', 'Reupload thumbnail to YouTube', 'retry', 3000, 60000, 3, 1.5),
  ('scheduled_publish_failed', 'force_public', 'Force video to public status via API', 'retry', 2000, 30000, 3, 1.5),
  ('copyright_detected', 'manual_review', 'Escalate to manual ops review', 'escalate', 0, 0, 1, 1.0),
  ('browser_check_failed', 'retry_verification', 'Wait and retry browser verification', 'retry', 30000, 120000, 4, 2.0),
  ('quota_exceeded', 'wait_quota_reset', 'Wait for quota reset at 07:00 UTC', 'wait', 0, 0, 1, 1.0),
  ('network_timeout', 'retry_exponential', 'Retry with exponential backoff', 'retry', 5000, 60000, 5, 2.5),
  ('worker_crash', 'restart_worker', 'Restart crashed worker process', 'escalate', 5000, 30000, 2, 1.0),
  ('config_invalid', 'manual_review', 'Escalate invalid config to ops', 'escalate', 0, 0, 1, 1.0)
on conflict do nothing;

-- ============================================================================
-- 5. RECOVERY ATTEMPTS HISTORY
-- ============================================================================

create table if not exists hermes.recovery_attempts (
  id                    uuid primary key default gen_random_uuid(),

  error_event_id        uuid not null references hermes.error_events(id) on delete cascade,
  strategy_id           uuid references hermes.recovery_strategies(id) on delete set null,
  strategy_name         text not null,

  -- Attempt tracking
  attempt_number        integer not null,
  max_attempts          integer not null,

  -- Execution
  triggered_at          timestamptz not null default now(),
  started_at            timestamptz,
  completed_at          timestamptz,

  -- Result
  success               boolean,
  result_message        text,
  recovery_metadata     jsonb not null default '{}'::jsonb,  -- what was changed, retry count, etc

  -- Next action
  next_action           text,                         -- 'retry' | 'escalate' | 'complete'
  next_scheduled_at     timestamptz,

  -- Audit
  triggered_by          text not null default 'hermes',
  created_at            timestamptz not null default now()
);

comment on table hermes.recovery_attempts is
  'Track every recovery action: what was tried, when, and with what result';

create index hermes_recovery_attempts_error_event_idx on hermes.recovery_attempts (error_event_id);
create index hermes_recovery_attempts_success_idx on hermes.recovery_attempts (success, completed_at desc);
create index hermes_recovery_attempts_next_scheduled_idx on hermes.recovery_attempts (next_scheduled_at) where next_scheduled_at is not null;

-- ============================================================================
-- 6. MUTUAL HEALTH MONITORING (Recovery Agent ↔ Render Workers)
-- ============================================================================

create table if not exists hermes.mutual_health (
  id                    uuid primary key default gen_random_uuid(),

  -- Who's monitoring whom
  monitor_agent_id      text not null,                -- 'hermes-recovery' | 'render-worker-1' | etc
  monitored_service     text not null,                -- service being checked

  -- Health signals
  last_heartbeat_at     timestamptz,
  heartbeat_interval_ms integer not null default 30000,

  -- Status
  is_healthy            boolean not null default true,
  status_message        text,
  health_score          integer not null default 100
                          check (health_score >= 0 and health_score <= 100),

  -- Degradation tracking
  degraded_since        timestamptz,
  failure_count         integer not null default 0,

  -- Auto-remediation
  last_remediation_at   timestamptz,
  remediation_count     integer not null default 0,

  -- Audit
  updated_at            timestamptz not null default now(),
  created_at            timestamptz not null default now()
);

comment on table hermes.mutual_health is
  'Bidirectional health checks: Hermes monitors Workers, Workers monitor Hermes';

comment on column hermes.mutual_health.health_score is
  '100=healthy, 80-99=degraded, <80=critical. Used for cascade failure detection';

create index hermes_mutual_health_monitor_idx on hermes.mutual_health (monitor_agent_id, monitored_service);
create index hermes_mutual_health_is_healthy_idx on hermes.mutual_health (is_healthy) where not is_healthy;
create index hermes_mutual_health_updated_idx on hermes.mutual_health (updated_at desc);

-- ============================================================================
-- 7. RECOVERY STATUS TRACKING (current state of all recoveries)
-- ============================================================================

create table if not exists hermes.recovery_status (
  id                    uuid primary key default gen_random_uuid(),

  task_id               text not null unique,         -- one active recovery per task
  task_type             text not null,

  -- Current state
  status                text not null
                          check (status in ('detecting','recovering','escalated','resolved','failed')),

  first_error_at        timestamptz not null,
  last_update_at        timestamptz not null default now(),

  -- Recovery chain
  error_count           integer not null default 1,
  recovery_count        integer not null default 0,

  -- Details
  latest_error_id       uuid references hermes.error_events(id) on delete set null,
  latest_recovery_id    uuid references hermes.recovery_attempts(id) on delete set null,

  -- Escalation info
  is_escalated          boolean not null default false,
  escalated_at          timestamptz,
  escalation_reason     text,

  -- Metadata
  metadata              jsonb not null default '{}'::jsonb,

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

comment on table hermes.recovery_status is
  'Single source of truth for recovery state of each task. One row per active task';

create index hermes_recovery_status_status_idx on hermes.recovery_status (status);
create index hermes_recovery_status_escalated_idx on hermes.recovery_status (is_escalated) where is_escalated;
create index hermes_recovery_status_updated_idx on hermes.recovery_status (updated_at desc);

-- ============================================================================
-- 8. PATTERN DETECTION & ALERT FUNCTIONS
-- ============================================================================

create or replace function hermes.detect_error_pattern(
  p_error_code text,
  p_window_hours integer default 24
)
returns table (
  pattern_exists boolean,
  occurrences integer,
  first_error_id uuid,
  latest_error_id uuid,
  is_systemic boolean
) language plpgsql stable as $$
declare
  v_count integer;
  v_first uuid;
  v_latest uuid;
begin
  select count(*), min(id), max(id) into v_count, v_first, v_latest
  from hermes.error_events
  where error_code = p_error_code
    and created_at > now() - (p_window_hours || ' hours')::interval;

  return query select
    v_count >= 2,
    v_count,
    v_first,
    v_latest,
    v_count >= 2;
end $$;

comment on function hermes.detect_error_pattern is
  'Detect if an error code appears 2+ times in the window (indicates systemic issue)';

-- ============================================================================
-- 9. RECOVERY REPORT VIEW (for dashboard)
-- ============================================================================

create or replace view hermes.recovery_report as
select
  rs.task_id,
  rs.task_type,
  rs.status,
  rs.error_count,
  rs.recovery_count,
  rs.first_error_at,
  rs.last_update_at,
  e.error_code,
  e.message as latest_error_message,
  e.severity,
  e.is_pattern_duplicate,
  ra.strategy_name as latest_recovery_strategy,
  ra.success as latest_recovery_success,
  rs.is_escalated,
  rs.escalation_reason,
  case
    when rs.status = 'resolved' then '✅ RESOLVED'
    when rs.status = 'escalated' then '🔴 ESCALATED'
    when rs.status = 'recovering' then '🔄 RECOVERING'
    when rs.status = 'detecting' then '🔍 DETECTING'
    else '❓ UNKNOWN'
  end as display_status
from hermes.recovery_status rs
left join hermes.error_events e on e.id = rs.latest_error_id
left join hermes.recovery_attempts ra on ra.id = rs.latest_recovery_id
order by rs.last_update_at desc;

comment on view hermes.recovery_report is
  'Dashboard view: current recovery status of all tasks with latest error & action';

-- ============================================================================
-- 10. ENABLE REALTIME FOR EVENT-DRIVEN TRIGGERS
-- ============================================================================

alter publication supabase_realtime add table hermes.error_events;
alter publication supabase_realtime add table hermes.recovery_status;
alter publication supabase_realtime add table hermes.recovery_attempts;
alter publication supabase_realtime add table hermes.mutual_health;

comment on publication supabase_realtime is
  'Hermes tables added for real-time event-driven recovery triggers';

-- ============================================================================
-- 11. ROLLBACK
-- ============================================================================
-- drop view if exists hermes.recovery_report;
-- drop table if exists hermes.recovery_status;
-- drop table if exists hermes.mutual_health;
-- drop table if exists hermes.recovery_attempts;
-- drop table if exists hermes.recovery_strategies;
-- drop table if exists hermes.error_patterns;
-- drop table if exists hermes.error_events;
-- drop table if exists hermes.error_types;
-- drop function if exists hermes.detect_error_pattern;
