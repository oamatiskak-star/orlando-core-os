-- 127_hermes_central_telegram.sql
-- Hermes = centraal Telegram-brein. Regel (Orlando): max 6 rapportages/dag +
-- alleen kritiek (manuele input) als los bericht. Al het andere logt stil.
--
--  (1) hermes_daily_digest(): één compact rapport, pg_cron 6×/dag (elke 4u).
--  (2) hermes_notify_now: push ALLEEN bij 'critical' (was error+critical).
--      'error'/'warning' worden wél geregistreerd als alert (→ digest) maar
--      onderbreken Orlando niet meer.

-- ── (1) Daglijkse digest (max 6/dag) ─────────────────────────────────────────
create or replace function public.hermes_daily_digest()
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_token text; v_chat text; v_msg text;
  v_crit int; v_warn int; v_events int; v_titels text;
begin
  select value into v_token from public.hermes_config where key = 'telegram_bot_token';
  select value into v_chat  from public.hermes_config where key = 'telegram_chat_id';
  if v_token is null or v_chat is null then return; end if;

  select count(*) filter (where severity = 'critical'),
         count(*) filter (where severity = 'warning')
    into v_crit, v_warn
  from public.hermes_alerts where status = 'open';

  select count(*) into v_events
  from hermes.logs
  where level in ('error', 'warn') and created_at > now() - interval '4 hours';

  select string_agg('• [' || severity || '] ' || titel, E'\n')
    into v_titels
  from (
    select severity, titel from public.hermes_alerts
    where status = 'open'
    order by (severity = 'critical') desc, last_seen_at desc
    limit 8
  ) t;

  v_msg := '📊 Hermes rapport ' || to_char(now() at time zone 'Europe/Amsterdam', 'DD-MM HH24:MI') || E'\n'
        || 'Open: ' || coalesce(v_crit, 0) || ' kritiek, ' || coalesce(v_warn, 0) || ' warning' || E'\n'
        || 'Events 4u (warn/error): ' || coalesce(v_events, 0) || E'\n'
        || coalesce(E'\n' || v_titels, E'\nGeen open alerts — alles rustig.');

  perform net.http_post(
    url  := 'https://api.telegram.org/bot' || v_token || '/sendMessage',
    body := jsonb_build_object('chat_id', v_chat, 'text', v_msg)
  );
end;
$function$;

grant execute on function public.hermes_daily_digest() to service_role;

-- pg_cron: 6×/dag (elke 4u, UTC). Idempotent her-schedulen.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('hermes-daily-digest', '0 */4 * * *', 'select public.hermes_daily_digest();');
  end if;
end $$;

-- ── (2) hermes_notify_now: push ALLEEN bij kritiek ───────────────────────────
create or replace function public.hermes_notify_now(
  p_key     text,
  p_sev     text,
  p_type    text,
  p_titel   text,
  p_detail  text,
  p_fabriek text default null
) returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_token text;
  v_chat  text;
  v_msg   text;
  v_alert public.hermes_alerts%rowtype;
begin
  -- Altijd registreren als alert (zodat het in de digest verschijnt).
  perform public.hermes_raise(p_key, p_sev, p_type, p_fabriek, p_titel, p_detail);

  -- Direct pushen ALLEEN bij kritiek (manuele input nodig). Rest = stil.
  if lower(coalesce(p_sev, 'info')) <> 'critical' then
    return;
  end if;

  select * into v_alert from public.hermes_alerts where dedup_key = p_key;
  if not found then return; end if;

  if v_alert.notified_at is not null
     and v_alert.last_seen_at <= v_alert.notified_at + interval '6 hours' then
    return;
  end if;

  select value into v_token from public.hermes_config where key = 'telegram_bot_token';
  select value into v_chat  from public.hermes_config where key = 'telegram_chat_id';
  if v_token is null or v_chat is null then return; end if;

  v_msg := '🚨 <b>Hermes</b>: ' || p_titel || E'\n'
           || coalesce(p_detail, '') || E'\n\n<i>Vereist jouw actie.</i>';

  perform net.http_post(
    url  := 'https://api.telegram.org/bot' || v_token || '/sendMessage',
    body := jsonb_build_object('chat_id', v_chat, 'text', v_msg, 'parse_mode', 'HTML')
  );

  update public.hermes_alerts set notified_at = now() where id = v_alert.id;
end;
$function$;

grant execute on function public.hermes_notify_now(text, text, text, text, text, text) to service_role;
