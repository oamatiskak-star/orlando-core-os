-- 137_hermes_alert_autoresolve.sql
-- Hermes-alarmen ruimen zichzelf op zodra ze oud/behandeld zijn (geen handmatig opschonen meer).
-- Probleem: claude_autopilot-alarmen (stalled/rate_limited) werden door watch_claude_sessions
-- wél geopend maar nooit gesloten → orphan per-sessie dedup_keys bleven hangen; een verlaten
-- tab in 'waiting_input' bleef oneindig "vastgelopen" melden; en een vals-positieve rate-limit
-- (bash-commando matchte de regex) bleef staan.
-- Fix (2 niveaus):
--   1) watch_claude_sessions: verlaten waiting/stalled-sessies (>45m zonder event) → idle (stopt
--      alarmeren); claude-alarmen die 12m niet meer her-getriggerd zijn → auto-resolve.
--   2) hermes_supervisor: catch-all — elk open alarm dat 60m niet meer is waargenomen → resolve.
-- De 6 supervisor-checks her-triggeren elke run, dus echte aanhoudende condities blijven staan.

create or replace function hermes.watch_claude_sessions()
 returns integer language plpgsql security definer set search_path to 'hermes','public'
as $function$
declare r record; v_alerts integer := 0;
begin
  update claude_session_state set phase='stalled', updated_at=now()
   where phase='waiting_input' and last_event_at < now() - interval '15 minutes';

  update claude_session_state set phase='idle', updated_at=now()
   where phase='working' and last_event_at < now() - interval '60 minutes';

  -- ABANDONED: >45m in waiting/stalled zonder nieuw event ⇒ idle (verlaten tab) → stopt alarmeren
  update claude_session_state set phase='idle', updated_at=now()
   where phase in ('waiting_input','stalled') and last_event_at < now() - interval '45 minutes';

  for r in
    select host, session_id, project, phase, last_prompt_text
      from claude_session_state
     where phase in ('rate_limited','stalled')
       and last_event_at > now() - interval '2 hours'
  loop
    perform public.hermes_notify_now(
      'claude_'||r.phase||'_'||r.host||'_'||coalesce(r.session_id,'?'),
      case when r.phase='rate_limited' then 'error' else 'warning' end,
      'claude_autopilot',
      case when r.phase='rate_limited' then 'Claude Code zit aan de limiet'
           else 'Claude Code sessie vastgelopen (>15m wachtend)' end,
      format('Host %s · project %s%s', r.host, coalesce(r.project,'?'),
             case when r.last_prompt_text is not null then E'\n'||left(r.last_prompt_text,140) else '' end),
      r.project);
    v_alerts := v_alerts + 1;
  end loop;

  -- AUTO-RESOLVE: claude-alarmen 12m niet meer her-getriggerd ⇒ sessie niet meer vast ⇒ sluiten
  update public.hermes_alerts set status='resolved', resolved_at=now()
   where status='open' and alert_type='claude_autopilot'
     and last_seen_at < now() - interval '12 minutes';

  return v_alerts;
end $function$;

create or replace function public.hermes_supervisor()
 returns void language plpgsql security definer
as $function$
declare
  v_oauth_blocked int; v_oauth_chan int;
  v_attention int; v_queue_in int; v_queue_last timestamptz;
  v_janitor_last timestamptz; v_scraper_last timestamptz;
  v_worker_err int; v_worker_names text;
  v_token text; v_chat text; v_msg text; r record;
begin
  select coalesce(sum(oauth_geblokkeerde_uploads),0),
         count(*) filter (where echte_status <> 'gezond')
    into v_oauth_blocked, v_oauth_chan from public.v_ctl_oauth_health;
  if coalesce(v_oauth_blocked,0) > 0 then
    perform public.hermes_raise('oauth_blocked','critical','oauth',null,
      'OAuth blokkeert '||v_oauth_blocked||' uploads',
      v_oauth_chan||' kanalen niet gezond; uploads geweigerd. Kanalen opnieuw verbinden (handmatige input).');
  else perform public.hermes_resolve('oauth_blocked'); end if;

  select coalesce(aantal,0) into v_attention from public.v_ctl_upload_summary where fase='aandacht_nodig';
  if coalesce(v_attention,0) > 50 then
    perform public.hermes_raise('queue_attention',
      case when v_attention > 200 then 'critical' else 'warning' end,'queue',null,
      v_attention||' uploads vereisen aandacht','Fase aandacht_nodig in de upload-pipeline.');
  else perform public.hermes_resolve('queue_attention'); end if;

  select max(started_at) into v_janitor_last from public.janitor_runs;
  if v_janitor_last is null or v_janitor_last < now() - interval '14 hours' then
    perform public.hermes_raise('janitor_stale','warning','janitor',null,
      'Janitor-ronde te laat','Laatste schoonmaak: '||coalesce(v_janitor_last::text,'nooit')||'.');
  else perform public.hermes_resolve('janitor_stale'); end if;

  select max(created_at) into v_scraper_last from public.scraper_runs;
  if v_scraper_last is null or v_scraper_last < now() - interval '26 hours' then
    perform public.hermes_raise('scraper_idle','warning','scraper',null,
      'Scrapers stil','Laatste scraper-run: '||coalesce(v_scraper_last::text,'nooit')||'.');
  else perform public.hermes_resolve('scraper_idle'); end if;

  select coalesce(aantal,0) into v_queue_in from public.v_ctl_upload_summary where fase='in_wachtrij';
  select max(updated_at) into v_queue_last from public.youtube_upload_queue where status='queued';
  if v_queue_in > 100 and (v_queue_last is null or v_queue_last < now() - interval '2 days') then
    perform public.hermes_raise('queue_stuck','warning','queue',null,
      v_queue_in||' uploads staan stil in de wachtrij','Niets bewogen sinds '||coalesce(v_queue_last::text,'?')||'.');
  else perform public.hermes_resolve('queue_stuck'); end if;

  select count(*), string_agg(distinct name, ', ') into v_worker_err, v_worker_names
    from public.media_holding_workers where status='error';
  if coalesce(v_worker_err,0) > 0 then
    perform public.hermes_raise('mh_workers_error','warning','worker',null,
      v_worker_err||' media-workers op error','Workers: '||coalesce(v_worker_names,'?')||'.');
  else perform public.hermes_resolve('mh_workers_error'); end if;

  insert into public.hermes_config(key,value) values ('supervisor_last_run', now()::text)
    on conflict (key) do update set value = now()::text, updated_at = now();

  -- CATCH-ALL OPRUIMING: elk open alarm dat 60m niet meer is waargenomen ⇒ verouderd ⇒ resolve.
  update public.hermes_alerts set status='resolved', resolved_at=now()
   where status='open' and last_seen_at < now() - interval '60 minutes';

  select value into v_token from public.hermes_config where key='telegram_bot_token';
  select value into v_chat  from public.hermes_config where key='telegram_chat_id';
  if v_token is not null and v_chat is not null then
    for r in
      select * from public.hermes_alerts
       where status='open' and severity='critical'
         and (notified_at is null or last_seen_at > notified_at + interval '6 hours')
    loop
      v_msg := '🔴 <b>Hermes</b>: '||r.titel||E'\n'||coalesce(r.detail,'')||E'\n\n<i>Vereist jouw actie.</i>';
      perform net.http_post(
        url  := 'https://api.telegram.org/bot'||v_token||'/sendMessage',
        body := jsonb_build_object('chat_id', v_chat, 'text', v_msg, 'parse_mode','HTML'));
      update public.hermes_alerts set notified_at = now() where id = r.id;
    end loop;
  end if;
end; $function$;
