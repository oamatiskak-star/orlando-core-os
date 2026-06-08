-- 132_claude_telemetry_public_wrappers.sql
-- De Claude-telemetrie-hooks (hermes-hook.sh / hermes-autopilot.sh) POST'en naar
-- /rest/v1/rpc/<fn> = het PUBLIC schema. record_claude_event + log_autopilot_decision
-- stonden echter in 'hermes' -> PostgREST 404 -> telemetrie faalde stil
-- (claude_session_state/claude_prompts bleven leeg, sessie-dashboard leeg).
-- Public wrappers (zoals log_to_hermes) dichten dat.

create or replace function public.record_claude_event(
  p_host text, p_session_id text, p_event_type text, p_cwd text, p_project text,
  p_tool_name text, p_prompt_text text, p_raw jsonb default '{}'::jsonb
) returns void language plpgsql security definer set search_path to 'hermes','public' as $function$
begin
  perform hermes.record_claude_event(p_host, p_session_id, p_event_type, p_cwd, p_project,
                                     p_tool_name, p_prompt_text, p_raw);
end; $function$;

create or replace function public.log_autopilot_decision(
  p_host text, p_session_id text, p_cwd text, p_project text, p_tool_name text,
  p_kind text, p_prompt_text text, p_decision text, p_would_allow boolean,
  p_live boolean, p_reason text
) returns void language plpgsql security definer set search_path to 'hermes','public' as $function$
begin
  perform hermes.log_autopilot_decision(p_host, p_session_id, p_cwd, p_project, p_tool_name,
                                        p_kind, p_prompt_text, p_decision, p_would_allow, p_live, p_reason);
end; $function$;

grant execute on function public.record_claude_event(text,text,text,text,text,text,text,jsonb) to service_role, anon, authenticated;
grant execute on function public.log_autopilot_decision(text,text,text,text,text,text,text,text,boolean,boolean,text) to service_role, anon, authenticated;
