-- ============================================================================
-- Migration 127: Hermes Claude Code Watchdog (Fase F1) — detectie + escalatie
-- ============================================================================
-- Bouwt voort op F0 (124: claude_session_state) en hergebruikt het bestaande
-- alarm-pad public.hermes_notify_now (125) i.p.v. een nieuwe worker te deployen
-- (LOCAL-FIRST). Draait 24/7 via pg_cron — services/hermes hoeft NIET gedeployed.
--
-- Gedrag:
--   - waiting_input > 15 min  → phase 'stalled'   (warning: stil loggen, geen push)
--   - working > 60 min        → phase 'idle'
--   - phase 'rate_limited'    → ERROR → directe Telegram-push (Claude zit aan limiet)
--   - phase 'stalled'         → warning (geen spam; alleen geregistreerd)
-- Dedup + 6u her-notify-venster zit in hermes_notify_now.

create or replace function hermes.watch_claude_sessions()
returns integer
language plpgsql
security definer
set search_path = hermes, public
as $$
declare
  r        record;
  v_alerts integer := 0;
begin
  -- 1) Fase-overgangen (read-only detectie)
  update claude_session_state
     set phase = 'stalled', updated_at = now()
   where phase = 'waiting_input'
     and last_event_at < now() - interval '15 minutes';

  update claude_session_state
     set phase = 'idle', updated_at = now()
   where phase = 'working'
     and last_event_at < now() - interval '60 minutes';

  -- 2) Escaleer actuele rate-limited/stalled sessies via het bestaande alarm-pad.
  for r in
    select host, session_id, project, phase, last_prompt_text
      from claude_session_state
     where phase in ('rate_limited', 'stalled')
       and last_event_at > now() - interval '2 hours'
  loop
    perform public.hermes_notify_now(
      'claude_' || r.phase || '_' || r.host || '_' || coalesce(r.session_id, '?'),
      case when r.phase = 'rate_limited' then 'error' else 'warning' end,
      'claude_autopilot',
      case when r.phase = 'rate_limited'
           then 'Claude Code zit aan de limiet'
           else 'Claude Code sessie vastgelopen (>15m wachtend)' end,
      format('Host %s · project %s%s',
             r.host,
             coalesce(r.project, '?'),
             case when r.last_prompt_text is not null
                  then E'\n' || left(r.last_prompt_text, 140) else '' end),
      r.project
    );
    v_alerts := v_alerts + 1;
  end loop;

  return v_alerts;
end $$;

comment on function hermes.watch_claude_sessions is
  'F1 watchdog: fase-overgangen + escalatie van rate_limited (push) / stalled (warning) via hermes_notify_now. Draait per minuut via pg_cron.';

grant execute on function hermes.watch_claude_sessions() to service_role, authenticated;

-- pg_cron: laat de bestaande minuut-job de nieuwe watchdog draaien (incl. de
-- oude stall-logica). Guarded zodat migratie niet faalt zonder pg_cron.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    begin
      perform cron.schedule('hermes-detect-claude-stalls', '* * * * *', 'select hermes.watch_claude_sessions();');
    exception when others then null;
    end;
  end if;
end $$;
