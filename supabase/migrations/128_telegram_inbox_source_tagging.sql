-- 128_telegram_inbox_source_tagging.sql
-- Bron-tagging voor de Hermes Telegram-inbox: Hermes weet via WELKE bot (welk
-- systeem) een bericht binnenkwam. De webhook-URL per bot bevat ?src=<bot>
-- (os_vastgoed / orlando_os / yt_agent); de telegram-webhook edge function leest
-- die param en geeft 'm door aan ingest_telegram_update.

alter table hermes.telegram_inbox add column if not exists source_bot text;

drop function if exists public.ingest_telegram_update(jsonb);

create or replace function public.ingest_telegram_update(p_update jsonb, p_source text default null)
returns void
language plpgsql
security definer
set search_path to 'public', 'hermes'
as $function$
declare v_msg jsonb;
begin
  v_msg := coalesce(p_update->'message', p_update->'edited_message', p_update->'channel_post');
  insert into hermes.telegram_inbox(update_id, from_chat_id, message_type, body, source_bot)
  values(
    nullif(p_update->>'update_id','')::bigint,
    coalesce(v_msg->'chat'->>'id', v_msg->'from'->>'id'),
    case when v_msg is not null then 'message' else 'other' end,
    p_update,
    p_source
  );
end $function$;

grant execute on function public.ingest_telegram_update(jsonb, text) to service_role;
