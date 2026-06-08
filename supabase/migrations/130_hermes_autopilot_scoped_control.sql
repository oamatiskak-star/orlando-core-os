-- 130_hermes_autopilot_scoped_control.sql
-- Gescoopte autopilot-besturing (per machine + per tab) + "ga verder"-resume,
-- voor het Sessie-dashboard. Voorrang: sessie(tab) → host(machine) → globaal →
-- default ('aan op vertrouwde hosts').

create table if not exists hermes.autopilot_state (
  scope text not null check (scope in ('global','host','session')),
  scope_id text not null,
  live boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (scope, scope_id)
);

insert into public.hermes_config(key,value)
  values ('autopilot_trusted_hosts','mac,mac.home,cli-l,cli-r,cli-r.home')
  on conflict (key) do nothing;

create or replace function public.hermes_autopilot_set(p_scope text, p_scope_id text, p_on boolean)
returns boolean language plpgsql security definer set search_path to 'hermes','public' as $function$
begin
  insert into hermes.autopilot_state(scope, scope_id, live, updated_at)
  values (p_scope, coalesce(nullif(p_scope_id,''),'*'), p_on, now())
  on conflict (scope, scope_id) do update set live = excluded.live, updated_at = now();
  perform public.log_to_hermes('hermes-autopilot','info','autopilot.set',
    'Autopilot '||p_scope||':'||coalesce(p_scope_id,'*')||' = '||case when p_on then 'AAN' else 'UIT' end);
  return p_on;
end; $function$;

create or replace function public.hermes_autopilot_effective(p_host text, p_session text)
returns boolean language plpgsql security definer set search_path to 'hermes','public' as $function$
declare v boolean; v_trusted text;
begin
  select live into v from hermes.autopilot_state where scope='session' and scope_id = p_session;
  if found then return v; end if;
  select live into v from hermes.autopilot_state where scope='host' and scope_id = p_host;
  if found then return v; end if;
  select live into v from hermes.autopilot_state where scope='global' and scope_id='*';
  if found then return v; end if;
  select value into v_trusted from public.hermes_config where key='autopilot_trusted_hosts';
  if p_host is not null and v_trusted is not null
     and lower(p_host) = any (string_to_array(lower(v_trusted), ',')) then
    return true;
  end if;
  return false;
end; $function$;

create or replace function public.hermes_resume_session(p_host text, p_cwd text)
returns uuid language plpgsql security definer set search_path to 'public' as $function$
declare v_id uuid;
begin
  insert into public.osm_terminal_commands(machine_id, worktree_path, action, prompt, status, from_mobile)
  values (p_host, p_cwd, 'resume', 'ga verder', 'queued', false)
  returning id into v_id;
  return v_id;
end; $function$;

-- backwards-compat: oude Telegram-toggle "auto aan/uit" → globale scope
create or replace function public.hermes_set_autopilot(p_on boolean)
returns text language plpgsql security definer set search_path to 'public' as $function$
begin
  perform public.hermes_autopilot_set('global','*',p_on);
  return case when p_on then 'on' else 'off' end;
end; $function$;

grant execute on function public.hermes_autopilot_set(text,text,boolean) to service_role, authenticated;
grant execute on function public.hermes_autopilot_effective(text,text) to service_role, authenticated;
grant execute on function public.hermes_resume_session(text,text) to service_role, authenticated;
