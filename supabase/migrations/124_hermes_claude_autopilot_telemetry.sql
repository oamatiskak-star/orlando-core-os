-- ============================================================================
-- Migration 124: Hermes — Claude Code Autopilot TELEMETRIE (Fase F0, read-only)
-- ============================================================================
-- Doel: Hermes ziet wanneer Claude Code wacht op input, een tool wil draaien,
-- stopt, of tegen een rate-limit aanloopt. PUUR LOGGEN/observeren — geen acties,
-- geen auto-antwoorden (hard default-deny). Voedt later F1 watchdog / F3 governance.

create schema if not exists hermes;

-- 1. Event-log: elk Claude Code hook-event ----------------------------------
create table if not exists hermes.claude_prompts (
  id              bigint generated always as identity primary key,
  host            text not null default 'unknown',
  session_id      text,
  cwd             text,
  project         text,
  event_type      text not null,            -- notification | stop | pre_tool_use | user_prompt | session_start
  tool_name       text,                     -- bij pre_tool_use
  prompt_text     text,                     -- prompt/notificatie-tekst
  options         jsonb not null default '[]'::jsonb,   -- F3 vult genummerde opties; F0 leeg
  classified_kind text,                     -- F3; F0 null
  rate_limited    boolean not null default false,
  raw             jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);
create index if not exists idx_claude_prompts_session on hermes.claude_prompts (session_id, created_at desc);
create index if not exists idx_claude_prompts_created on hermes.claude_prompts (created_at desc);
create index if not exists idx_claude_prompts_ratelimit on hermes.claude_prompts (rate_limited, created_at desc) where rate_limited;

-- 2. Live sessie-status (1 rij per host+sessie) ------------------------------
create table if not exists hermes.claude_session_state (
  host              text not null,
  session_id        text not null,
  phase             text not null default 'unknown'
                      check (phase in ('working','waiting_input','rate_limited','stalled','idle','done','unknown')),
  cwd               text,
  project           text,
  last_event        text,
  last_prompt_text  text,
  last_prompt_id    bigint,
  last_event_at     timestamptz not null default now(),
  resume_at         timestamptz,            -- F2: gepland hervat-moment bij rate-limit
  updated_at        timestamptz not null default now(),
  primary key (host, session_id)
);
create index if not exists idx_claude_session_state_phase on hermes.claude_session_state (phase, last_event_at desc);

-- 3. RPC: hook schrijft één event + werkt sessie-status bij -------------------
create or replace function hermes.record_claude_event(
  p_host text,
  p_session_id text,
  p_event_type text,
  p_cwd text default null,
  p_project text default null,
  p_tool_name text default null,
  p_prompt_text text default null,
  p_raw jsonb default '{}'::jsonb
) returns bigint
language plpgsql
security definer
set search_path = hermes
as $$
declare
  v_id    bigint;
  v_rate  boolean := false;
  v_phase text;
begin
  -- rate-limit-herkenning (alleen een SIGNAAL, geen actie)
  v_rate := coalesce(p_prompt_text, '') ~*
    '(rate.?limit|usage limit|limit reached|try again|overloaded|too many requests|429|resets? at|upgrade to)';

  insert into claude_prompts (host, session_id, cwd, project, event_type, tool_name, prompt_text, rate_limited, raw)
  values (coalesce(p_host, 'unknown'), p_session_id, p_cwd, p_project, p_event_type, p_tool_name,
          p_prompt_text, v_rate, coalesce(p_raw, '{}'::jsonb))
  returning id into v_id;

  v_phase := case
    when v_rate                       then 'rate_limited'
    when p_event_type = 'stop'        then 'idle'
    when p_event_type = 'notification' then 'waiting_input'  -- Notification = Claude wacht meestal op input
    else 'working'
  end;

  insert into claude_session_state as s
    (host, session_id, phase, cwd, project, last_event, last_prompt_text, last_prompt_id, last_event_at, updated_at)
  values
    (coalesce(p_host, 'unknown'), coalesce(p_session_id, 'unknown'), v_phase, p_cwd, p_project,
     p_event_type, p_prompt_text, v_id, now(), now())
  on conflict (host, session_id) do update set
    phase            = excluded.phase,
    cwd              = coalesce(excluded.cwd, s.cwd),
    project          = coalesce(excluded.project, s.project),
    last_event       = excluded.last_event,
    last_prompt_text = excluded.last_prompt_text,
    last_prompt_id   = excluded.last_prompt_id,
    last_event_at    = now(),
    updated_at       = now();

  return v_id;
end $$;

comment on function hermes.record_claude_event is
  'F0 telemetrie: log één Claude Code hook-event en werk claude_session_state bij. Geen acties.';

-- 4. Watchdog (read-only): markeer vastgelopen sessies -----------------------
create or replace function hermes.detect_claude_stalls()
returns integer
language plpgsql
security definer
set search_path = hermes
as $$
declare v_count integer := 0;
begin
  -- >15 min wachtend op input zonder nieuw event → stalled
  update claude_session_state
     set phase = 'stalled', updated_at = now()
   where phase = 'waiting_input'
     and last_event_at < now() - interval '15 minutes';
  get diagnostics v_count = row_count;

  -- 'working' dat >60 min stil ligt en niet rate-limited → idle (sessie waarschijnlijk dood)
  update claude_session_state
     set phase = 'idle', updated_at = now()
   where phase = 'working'
     and last_event_at < now() - interval '60 minutes';

  return v_count;
end $$;

comment on function hermes.detect_claude_stalls is
  'F0 watchdog: promoot waiting_input→stalled (>15m) en working→idle (>60m). Read-only, geen auto-antwoord.';

-- 5. Grants (hook gebruikt service_role; dashboard authenticated) ------------
grant usage on schema hermes to service_role, authenticated;
grant execute on function hermes.record_claude_event(text, text, text, text, text, text, text, jsonb)
  to service_role, authenticated;
grant execute on function hermes.detect_claude_stalls() to service_role, authenticated;
grant select on hermes.claude_prompts, hermes.claude_session_state to service_role, authenticated;
grant insert, update on hermes.claude_prompts, hermes.claude_session_state to service_role;

-- 6. pg_cron: elke minuut stall-detectie (guarded; faalt niet als pg_cron mist)
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    begin
      perform cron.schedule('hermes-detect-claude-stalls', '* * * * *', 'select hermes.detect_claude_stalls();');
    exception when others then null;  -- al gepland / geen rechten → negeren
    end;
  end if;
end $$;

comment on migration is
  'Hermes Claude Code Autopilot F0 (telemetrie, read-only):
   - hermes.claude_prompts: event-log van Claude Code hooks (Notification/Stop/PreToolUse/UserPrompt)
   - hermes.claude_session_state: live status per host+sessie (working/waiting_input/rate_limited/stalled/idle)
   - hermes.record_claude_event(): RPC die de hook aanroept (1 event → log + status-upsert)
   - hermes.detect_claude_stalls(): watchdog die vastgelopen sessies markeert (pg_cron, elke minuut)
   - GEEN auto-antwoorden / GEEN acties — hard default-deny. Fundament voor F1/F2/F3.';
