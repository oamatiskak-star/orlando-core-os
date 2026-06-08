-- 133_claude_rate_limit_auto_resume.sql
-- Auto-resume na rate limit (capstone autopilot): rate-limit-melding wordt herkend,
-- de reset-tijd geparst -> resume_at gezet; een cron stuurt automatisch "ga verder"
-- zodra de limiet reset (en de machine actief is). Harde default-deny intact —
-- "ga verder" is veilig.

create or replace function hermes.parse_resume_at(p_text text, p_tz text default 'Europe/Amsterdam')
returns timestamptz language plpgsql as $function$
declare t text := lower(coalesce(p_text,'')); m text[]; v_h int; v_min int; v_ampm text; v_target timestamptz;
begin
  m := regexp_match(t, 'in\s+(\d+)\s*(hours?|hrs?|minutes?|mins?|h|m)\b');
  if m is not null then
    if m[2] ~ '^(h|hr)' then return now() + (m[1] || ' hours')::interval;
    else return now() + (m[1] || ' minutes')::interval; end if;
  end if;
  m := regexp_match(t, 'reset[s]?\s+at\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?');
  if m is not null then
    v_h := m[1]::int; v_min := coalesce(m[2]::int, 0); v_ampm := m[3];
    if v_ampm='pm' and v_h < 12 then v_h := v_h + 12; end if;
    if v_ampm='am' and v_h = 12 then v_h := 0; end if;
    v_target := (date_trunc('day', now() at time zone p_tz) + make_interval(hours => v_h, mins => v_min)) at time zone p_tz;
    if v_target <= now() then v_target := v_target + interval '1 day'; end if;
    return v_target;
  end if;
  return null;
end $function$;

create or replace function hermes.record_claude_event(p_host text, p_session_id text, p_event_type text, p_cwd text DEFAULT NULL::text, p_project text DEFAULT NULL::text, p_tool_name text DEFAULT NULL::text, p_prompt_text text DEFAULT NULL::text, p_raw jsonb DEFAULT '{}'::jsonb)
returns bigint language plpgsql security definer set search_path to 'hermes' as $function$
declare v_id bigint; v_rate boolean := false; v_phase text; v_resume_at timestamptz := null;
begin
  v_rate := coalesce(p_prompt_text,'') ~* '(rate.?limit|usage limit|limit reached|try again|overloaded|too many requests|429|resets? at|upgrade to)';

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
    (host, session_id, phase, cwd, project, last_event, last_prompt_text, last_prompt_id, last_event_at, resume_at, updated_at)
  values
    (coalesce(p_host,'unknown'), coalesce(p_session_id,'unknown'), v_phase, p_cwd, p_project,
     p_event_type, p_prompt_text, v_id, now(), v_resume_at, now())
  on conflict (host, session_id) do update set
    phase = excluded.phase, cwd = coalesce(excluded.cwd, s.cwd), project = coalesce(excluded.project, s.project),
    last_event = excluded.last_event, last_prompt_text = excluded.last_prompt_text, last_prompt_id = excluded.last_prompt_id,
    last_event_at = now(),
    resume_at = case when v_rate then excluded.resume_at else null end,
    updated_at = now();

  return v_id;
end $function$;

create or replace function hermes.dispatch_due_resumes()
returns integer language plpgsql security definer set search_path to 'hermes','public' as $function$
declare r record; v int := 0;
begin
  for r in
    select host, session_id, cwd from claude_session_state
    where phase = 'rate_limited' and resume_at is not null and resume_at <= now()
      and last_event_at > now() - interval '24 hours'
  loop
    if exists (select 1 from hermes.hosts where host_id = r.host and active and last_seen_at > now() - interval '10 minutes') then
      insert into public.osm_terminal_commands(machine_id, worktree_path, action, prompt, status, from_mobile)
      values (r.host, r.cwd, 'resume', 'ga verder', 'queued', false);
      update claude_session_state set phase='resuming', resume_at=null, updated_at=now()
        where host = r.host and session_id = r.session_id;
      perform public.log_to_hermes('claude-autopilot','info','autopilot.auto_resume',
        'Auto-resume na rate-limit: '||r.host||' / '||coalesce(r.cwd,'?'));
      v := v + 1;
    end if;
  end loop;
  return v;
end $function$;

grant execute on function hermes.parse_resume_at(text,text) to service_role;
grant execute on function hermes.dispatch_due_resumes() to service_role;

do $$
begin
  if exists (select 1 from pg_extension where extname='pg_cron') then
    perform cron.schedule('hermes-dispatch-resumes', '* * * * *', 'select hermes.dispatch_due_resumes();');
  end if;
end $$;
