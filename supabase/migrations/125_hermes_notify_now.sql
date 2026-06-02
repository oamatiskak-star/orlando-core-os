-- 125_hermes_notify_now.sql
-- Directe ("scherpe") Hermes-alert: raise + ONMIDDELLIJKE Telegram-push voor
-- error/critical, zonder te wachten op de 5-minuten hermes_supervisor()-cyclus.
-- Reden: een failed Render-service moet Orlando DIRECT bereiken. Het oude pad
-- (log_to_hermes -> hermes.logs) was stil; alleen de supervisor pushte, en
-- alleen 'critical', elke 5 min. Dit dichtte het gat waardoor 3 services down
-- konden staan zonder waarschuwing.
--
-- Anti-spam: hergebruikt de dedup van hermes_raise + een 6u her-notify-venster,
-- identiek aan de supervisor-pushloop, zodat herhaalde ticks niet spammen.

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
  v_icon  text;
  v_msg   text;
  v_alert public.hermes_alerts%rowtype;
begin
  -- 1) Alert registreren/deduppen (zelfde gedrag als hermes_raise).
  perform public.hermes_raise(p_key, p_sev, p_type, p_fabriek, p_titel, p_detail);

  -- 2) Alleen error/critical gaan direct door; warning/info blijven stil loggen.
  if lower(coalesce(p_sev,'info')) not in ('critical','error') then
    return;
  end if;

  select * into v_alert from public.hermes_alerts where dedup_key = p_key;
  if not found then
    return;
  end if;

  -- 3) Her-notify-venster: niet vaker dan elke 6u voor hetzelfde open alert.
  if v_alert.notified_at is not null
     and v_alert.last_seen_at <= v_alert.notified_at + interval '6 hours' then
    return;
  end if;

  -- 4) Direct pushen via pg_net (zelfde mechaniek als hermes_supervisor).
  select value into v_token from public.hermes_config where key = 'telegram_bot_token';
  select value into v_chat  from public.hermes_config where key = 'telegram_chat_id';
  if v_token is null or v_chat is null then
    return;
  end if;

  v_icon := case when lower(p_sev) = 'critical' then '🚨' else '🔴' end;
  v_msg  := v_icon || ' <b>Hermes</b>: ' || p_titel || E'\n'
            || coalesce(p_detail, '') || E'\n\n<i>Failed service — vereist jouw actie.</i>';

  perform net.http_post(
    url  := 'https://api.telegram.org/bot' || v_token || '/sendMessage',
    body := jsonb_build_object('chat_id', v_chat, 'text', v_msg, 'parse_mode', 'HTML')
  );

  update public.hermes_alerts set notified_at = now() where id = v_alert.id;
end;
$function$;

grant execute on function public.hermes_notify_now(text, text, text, text, text, text) to service_role;
