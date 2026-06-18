-- 221_hermes_session_cleanup.sql
-- Verwijder-/opschoon-knoppen voor het Sessie-dashboard (/dashboard/sessions).
-- Dode of oude Claude Code-sessies bleven voor altijd in hermes.claude_session_state
-- staan (niets ruimde ze op) → de lijst slibt dicht. Deze RPC's geven het dashboard
-- een "Verwijder"-knop per sessie en een "Ruim oude sessies op"-knop.
--
-- Veilig: een sessie die nog leeft schrijft bij het volgende event opnieuw zijn rij
-- via hermes.record_claude_event (upsert), dus echt-actieve sessies komen terug;
-- alleen dode rijen blijven weg.

-- 1. Eén sessie verwijderen (rij + eventuele tab-scope autopilot-override) ---------
create or replace function public.hermes_delete_session(p_host text, p_session_id text)
returns boolean
language plpgsql
security definer
set search_path to 'hermes','public'
as $function$
declare v_count int;
begin
  delete from hermes.claude_session_state
   where host = p_host and session_id = p_session_id;
  get diagnostics v_count = row_count;

  -- ruim de per-tab autopilot-override op zodat er geen weesrij achterblijft
  delete from hermes.autopilot_state
   where scope = 'session' and scope_id = p_session_id;

  perform public.log_to_hermes('hermes-sessions','info','session.delete',
    'Sessie verwijderd: '||coalesce(p_host,'?')||' / '||coalesce(p_session_id,'?'));
  return v_count > 0;
end; $function$;

-- 2. Oude/idle sessies in bulk opschonen ------------------------------------------
--    Verwijdert alle sessies waarvan het laatste event ouder is dan p_idle_minutes
--    EN die niet meer 'working' zijn. Default = 60 minuten. Geeft het aantal terug.
create or replace function public.hermes_clear_stale_sessions(p_idle_minutes int default 60)
returns int
language plpgsql
security definer
set search_path to 'hermes','public'
as $function$
declare v_count int;
begin
  with del as (
    delete from hermes.claude_session_state
     where last_event_at < now() - make_interval(mins => greatest(p_idle_minutes, 1))
       and phase <> 'working'
    returning session_id
  )
  select count(*) into v_count from del;

  -- bijbehorende tab-overrides van verwijderde sessies opruimen
  delete from hermes.autopilot_state a
   where a.scope = 'session'
     and not exists (
       select 1 from hermes.claude_session_state s where s.session_id = a.scope_id
     );

  perform public.log_to_hermes('hermes-sessions','info','session.clear_stale',
    v_count||' oude sessies opgeschoond (ouder dan '||p_idle_minutes||' min)');
  return v_count;
end; $function$;

grant execute on function public.hermes_delete_session(text,text) to service_role, authenticated;
grant execute on function public.hermes_clear_stale_sessions(int) to service_role, authenticated;
