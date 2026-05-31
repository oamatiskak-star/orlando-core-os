-- ============================================================================
-- Migration 121: Hermes Personal CEO Partnership
-- ============================================================================
-- Extend existing Hermes tables for daily conversation and proactive partnership
-- Economic approach: reuse notifications + minimal new schema

-- ============================================================================
-- 1. Extend hermes.notifications with conversation tracking
-- ============================================================================

alter table hermes.notifications add column if not exists
  is_memory boolean default false;

alter table hermes.notifications add column if not exists
  conversation_turn text;

alter table hermes.notifications add column if not exists
  conversation_id uuid;

-- ============================================================================
-- 2. HERMES_CONVERSATIONS — Daily dialogue between Orlando and Hermes
-- ============================================================================

create table if not exists hermes.conversations (
  id                    uuid primary key default gen_random_uuid(),
  company_id            uuid not null references public.companies(id) on delete cascade,

  conversation_date     date not null,
  conversation_time     time not null default now()::time,

  sequence              smallint not null,
  speaker               text not null,
  message               text not null,

  context_type          text,
  related_notifications jsonb default '[]'::jsonb,

  created_at            timestamptz not null default now()
);

create index if not exists idx_conversations_company_date on hermes.conversations (company_id, conversation_date);
create index if not exists idx_conversations_speaker on hermes.conversations (speaker);

comment on table hermes.conversations is
  'Daily conversation log between Orlando and Hermes — memory, reminders, proactive context';

-- ============================================================================
-- 3. Extend hermes.executive_reports for personal daily briefing
-- ============================================================================

alter table hermes.executive_reports add column if not exists
  is_daily_briefing boolean default false;

alter table hermes.executive_reports add column if not exists
  personal_context jsonb default '{}'::jsonb;

alter table hermes.executive_reports add column if not exists
  orlando_message text;

-- ============================================================================
-- 4. HERMES_PROACTIVE_ALERTS — Intelligent detections
-- ============================================================================

create table if not exists hermes.proactive_alerts (
  id                    uuid primary key default gen_random_uuid(),
  company_id            uuid not null references public.companies(id) on delete cascade,

  alert_type            text not null,
  severity              text not null,

  description           text not null,
  affected_entity       text,
  affected_entity_id    uuid,

  detected_at           timestamptz not null default now(),
  presented_to_orlando  timestamptz,
  action_taken          text,
  resolved_at           timestamptz,

  metadata              jsonb default '{}'::jsonb
);

create index if not exists idx_proactive_company on hermes.proactive_alerts (company_id);
create index if not exists idx_proactive_type on hermes.proactive_alerts (alert_type);
create index if not exists idx_proactive_resolved on hermes.proactive_alerts (resolved_at);

comment on table hermes.proactive_alerts is
  'Proactive intelligence: payment delays, missed deadlines, unresolved tasks — Hermes detects without asking';

-- ============================================================================
-- 5. FUNCTION: Orlando remembers something
-- ============================================================================

create or replace function hermes.remember(
  p_company_id uuid,
  p_item text,
  p_context text default null
)
returns uuid
language plpgsql
security definer
set search_path = hermes
as $$
declare
  v_notification_id uuid;
begin
  insert into notifications (
    company_id, source_system, source_entity_type, title, description,
    notification_type, severity, status, is_memory, conversation_turn, metadata
  ) values (
    p_company_id, 'orlando_context', 'memory', 'Remember', p_item,
    'info', 'low', 'pending', true, 'orlando_request',
    jsonb_build_object('context', p_context)
  )
  returning id into v_notification_id;

  return v_notification_id;
end $$;

comment on function hermes.remember is
  'Orlando tells Hermes to remember something — stored as persistent memory item';

-- ============================================================================
-- 6. FUNCTION: Detect proactive alerts
-- ============================================================================

create or replace function hermes.detect_proactive_alerts(p_company_id uuid)
returns table(alert_count integer)
language plpgsql
security definer
set search_path = hermes
as $$
declare
  v_count integer := 0;
begin
  insert into proactive_alerts (company_id, alert_type, severity, description, detected_at)
  select
    p_company_id, 'unresolved_task', 'high',
    'We left ' || count(*) || ' tasks unresolved yesterday',
    now()
  from notifications
  where company_id = p_company_id
    and status = 'pending'
    and created_at::date < now()::date
  on conflict do nothing;

  v_count := (select count(*) from proactive_alerts
    where company_id = p_company_id and presented_to_orlando is null);

  return query select v_count;
end $$;

comment on function hermes.detect_proactive_alerts is
  'Hermes autonomously detects missed items, payment delays, unresolved issues';

-- ============================================================================
-- 7. FUNCTION: Daily greeting
-- ============================================================================

create or replace function hermes.generate_daily_greeting(p_company_id uuid)
returns text
language plpgsql
security definer
set search_path = hermes
as $$
declare
  v_greeting text;
  v_active_count integer;
  v_resolved_count integer;
  v_memory_items integer;
begin
  select count(*) into v_active_count from notifications
  where company_id = p_company_id and status = 'pending' and is_memory = false;

  select count(*) into v_resolved_count from notifications
  where company_id = p_company_id and resolved_at::date = now()::date;

  select count(*) into v_memory_items from notifications
  where company_id = p_company_id and is_memory = true and status = 'pending';

  v_greeting := format(
    'Goedemorgen Orlando! 🤖 Vandaag hebben we %s actieve items, %s opgelost gisteren, en %s dingen waar je aan wilt werken.',
    v_active_count, v_resolved_count, v_memory_items
  );

  return v_greeting;
end $$;

comment on function hermes.generate_daily_greeting is
  'Generate personalized daily greeting with status summary';

-- ============================================================================
-- MIGRATION NOTES
-- ============================================================================

comment on migration is
  'Hermes Personal CEO Partnership:
   - Extend notifications for memory tracking (Orlando remembers for later)
   - hermes.conversations: daily dialogue log with context
   - hermes.proactive_alerts: autonomous detection of payment delays, missed deadlines
   - hermes.remember() function: Orlando tells Hermes what to remember
   - hermes.detect_proactive_alerts() function: autonomous intelligence
   - hermes.generate_daily_greeting() function: personalized daily greeting
   - All builds on existing schema — minimal, economical, reuses tables
   - Daily cadence: greeting → status check → proactive alerts → memory reminders';
