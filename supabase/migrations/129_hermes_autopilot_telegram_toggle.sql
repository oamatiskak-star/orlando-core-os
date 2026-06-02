-- 129_hermes_autopilot_telegram_toggle.sql
-- "Auto mode aan/uit" voor Hermes via Telegram (equivalent van Claude Code's
-- shift+tab auto-accept). Toggle-state staat in hermes_config.autopilot_live;
-- hermes-autopilot.sh leest die vlag (60s-cache). Telegram-commando "auto aan/uit"
-- (alleen Orlando's chat) zet de vlag + bevestigt.

insert into public.hermes_config(key, value) values ('autopilot_live','0')
  on conflict (key) do nothing;

create or replace function public.hermes_set_autopilot(p_on boolean)
returns text language plpgsql security definer set search_path to 'public' as $function$
begin
  insert into public.hermes_config(key,value)
    values ('autopilot_live', case when p_on then '1' else '0' end)
    on conflict (key) do update set value = excluded.value, updated_at = now();
  perform public.log_to_hermes('hermes-autopilot','info','autopilot.toggle',
    'Autopilot '|| case when p_on then 'AAN' else 'UIT' end);
  return case when p_on then 'on' else 'off' end;
end; $function$;

grant execute on function public.hermes_set_autopilot(boolean) to service_role;

create or replace function hermes.tg_autopilot_toggle()
returns trigger language plpgsql security definer set search_path to 'hermes','public' as $function$
declare v_text text; v_on boolean; v_token text; v_chat text; v_reply text;
begin
  v_text := lower(coalesce(NEW.body->'message'->>'text',''));
  if NEW.from_chat_id is distinct from (select value from public.hermes_config where key='telegram_chat_id') then
    return NEW;
  end if;
  if v_text ~ '\mauto\M' and v_text ~ '\m(aan|on|uit|off|aus)\M' then
    v_on := (v_text ~ '\m(aan|on)\M') and (v_text !~ '\m(uit|off|aus)\M');
    perform public.hermes_set_autopilot(v_on);
    NEW.processed_at := now();
    v_reply := '🤖 Hermes autopilot staat nu ' ||
      case when v_on then 'AAN — keurt veilige read-only tools automatisch goed; risicovol blijft jou vragen.'
           else 'UIT — dry-run, jij beslist alles.' end;
    select value into v_token from public.hermes_config where key='telegram_bot_token';
    select value into v_chat  from public.hermes_config where key='telegram_chat_id';
    if v_token is not null and v_chat is not null then
      perform net.http_post(
        url := 'https://api.telegram.org/bot'||v_token||'/sendMessage',
        body := jsonb_build_object('chat_id', v_chat, 'text', v_reply));
    end if;
  end if;
  return NEW;
end; $function$;

drop trigger if exists trg_autopilot_toggle on hermes.telegram_inbox;
create trigger trg_autopilot_toggle before insert on hermes.telegram_inbox
  for each row execute function hermes.tg_autopilot_toggle();
