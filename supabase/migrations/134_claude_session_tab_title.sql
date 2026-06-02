-- 134_claude_session_tab_title.sql
-- Tab-naam herkenbaar in het sessie-dashboard: de naam die Claude/de terminal aan
-- elke tab geeft (tmux pane/window-titel) wordt opgeslagen als claude_session_state.title.
-- De hook stuurt 'm mee in p_raw->>'title'; record_claude_event neemt 'm over.

alter table hermes.claude_session_state add column if not exists title text;

create or replace function hermes.record_claude_event(p_host text, p_session_id text, p_event_type text, p_cwd text DEFAULT NULL::text, p_project text DEFAULT NULL::text, p_tool_name text DEFAULT NULL::text, p_prompt_text text DEFAULT NULL::text, p_raw jsonb DEFAULT '{}'::jsonb)
returns bigint language plpgsql security definer set search_path to 'hermes' as $function$
declare v_id bigint; v_rate boolean := false; v_phase text; v_resume_at timestamptz := null; v_title text;
begin
  v_rate := coalesce(p_prompt_text,'') ~* '(rate.?limit|usage limit|limit reached|try again|overloaded|too many requests|429|resets? at|upgrade to)';
  v_title := nullif(trim(coalesce(p_raw->>'title','')), '');

  insert into claude_prompts (host, session_id, cwd, project, event_type, tool_name, prompt_text, rate_limited, raw)
  values (coalesce(p_host,'unknown'), p_session_id, p_cwd, p_project, p_event_type, p_tool_name, p_prompt_text, v_rate, coalesce(p_raw,'{}'::jsonb))
  returning id into v_id;

  v_phase := case when v_rate then 'rate_limited'
                  when p_event_type='stop' then 'idle'
                  when p_event_type='notification' then 'waiting_input'
                  else 'working' end;
  if v_rate then
    v_resume_at := coalesce(hermes.parse_resume_at(p_prompt_text), now() + interval '1 hour');
  end if;

  insert into claude_session_state as s
    (host, session_id, phase, cwd, project, title, last_event, last_prompt_text, last_prompt_id, last_event_at, resume_at, updated_at)
  values
    (coalesce(p_host,'unknown'), coalesce(p_session_id,'unknown'), v_phase, p_cwd, p_project, v_title,
     p_event_type, p_prompt_text, v_id, now(), v_resume_at, now())
  on conflict (host, session_id) do update set
    phase = excluded.phase, cwd = coalesce(excluded.cwd, s.cwd), project = coalesce(excluded.project, s.project),
    title = coalesce(excluded.title, s.title),
    last_event = excluded.last_event, last_prompt_text = excluded.last_prompt_text, last_prompt_id = excluded.last_prompt_id,
    last_event_at = now(),
    resume_at = case when v_rate then excluded.resume_at else null end,
    updated_at = now();

  return v_id;
end $function$;
