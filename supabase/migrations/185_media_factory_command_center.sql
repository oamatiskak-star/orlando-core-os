-- 185_media_factory_command_center.sql
-- Media Factory Command Center — fundament (Fase 1 van het closure-plan).
-- ADDITIEF: bouwt UITSLUITEND voort op bestaande views (v_ctl_upload_pipeline, v_ceo_minutes_daily,
-- v_media_factory_certification, v_ceo_system_health, v_winner_intelligence). Niets herbouwd.
-- Levert: (1) v_mf_uploads, (2) v_mf_channels, (3) v_mf_health (één verdict + %),
--         (4) mf_classify_dead_queue() — eenmalige opschoning van dode wachtrij-records,
--         (5) hermes_supervisor() bijgewerkt: 'Scrapers stil' alleen bij ACTIEVE scrapers (ruis weg).
-- Geen datamutatie bij apply; mf_classify_dead_queue(true) is een aparte, expliciete actie.

-- =====================================================================================
-- (1) v_mf_uploads — uploads & publicaties op één rij (sectie 2 van het Command Center)
--     Upload = naar YouTube (verified_live, meestal private). Publicatie = daadwerkelijk public.
-- =====================================================================================
create or replace view public.v_mf_uploads as
with q as (
  select
    count(*) filter (where status='verified_live' and upload_finished_at::date = current_date)            as uploads_today,
    count(*) filter (where status='verified_live' and upload_finished_at >= now() - interval '7 days')      as uploads_week,
    count(*) filter (where status='verified_live' and upload_finished_at >= now() - interval '30 days')     as uploads_month,
    count(*) filter (where status = any(array['queued','retrying','preparing','normalizing','planned']))    as backlog,
    count(*) filter (where status='manual_review_required')                                                 as needs_attention,
    count(*) filter (where status='verified_live' and privacy_status = 'private')                           as uploaded_private_pending_public,
    min(created_at) filter (where status = any(array['queued','planned']))                                  as oldest_backlog_item,
    max(upload_finished_at) filter (where status='verified_live')                                           as last_upload_at
  from public.youtube_upload_queue
),
p as (
  select
    count(*) filter (where privacy_status='public' and published_at::date = current_date)                   as pubs_today,
    count(*) filter (where privacy_status='public' and published_at >= now() - interval '7 days')           as pubs_week,
    count(*) filter (where privacy_status='public' and published_at >= now() - interval '30 days')          as pubs_month,
    max(published_at) filter (where privacy_status='public')                                                as last_publication_at
  from public.youtube_videos
)
select
  q.uploads_today, q.uploads_week, q.uploads_month,
  p.pubs_today, p.pubs_week, p.pubs_month,
  q.backlog, q.needs_attention, q.uploaded_private_pending_public,
  q.oldest_backlog_item, q.last_upload_at, p.last_publication_at,
  -- publicatievertraging: hoe lang staat de oudste private-upload al te wachten op 'public'
  (select min(upload_finished_at) from public.youtube_upload_queue
     where status='verified_live' and privacy_status='private')                                            as oldest_private_since
from q, p;

-- =====================================================================================
-- (2) v_mf_channels — per kanaal: actief/stil + bereik (sectie 3 van het Command Center)
-- =====================================================================================
create or replace view public.v_mf_channels as
select
  c.id as channel_id,
  coalesce(c.naam, c.name)                              as kanaal,
  coalesce(c.subscriber_count, c.subscribers, 0)        as subscribers,
  c.last_upload_at,
  (select coalesce(sum(a.views),0)            from public.youtube_video_analytics a where a.channel_id=c.id and a.date >= current_date - 1)  as views_24u,
  (select coalesce(sum(a.views),0)            from public.youtube_video_analytics a where a.channel_id=c.id and a.date >= current_date - 7)  as views_7d,
  (select count(*) from public.youtube_upload_queue u where u.channel_id=c.id and u.status='verified_live' and u.upload_finished_at >= now() - interval '24 hours') as uploads_24u,
  (select count(*) from public.youtube_upload_queue u where u.channel_id=c.id and u.status='verified_live' and u.upload_finished_at >= now() - interval '7 days')  as uploads_7d,
  (select coalesce(sum(a.estimated_revenue),0) from public.youtube_video_analytics a where a.channel_id=c.id and a.date >= current_date - 30) as revenue_30d,
  c.oauth_connected,
  -- statuskleur + probleemreden
  case
    when c.oauth_connected is not true                                       then 'rood'
    when (select max(a.date) from public.youtube_video_analytics a where a.channel_id=c.id) < current_date - 7
         and coalesce(c.last_upload_at, '1970-01-01') < now() - interval '7 days' then 'grijs'
    when (select coalesce(sum(a.views),0) from public.youtube_video_analytics a where a.channel_id=c.id and a.date >= current_date - 7) > 0 then 'groen'
    else 'oranje'
  end                                                   as status_kleur,
  case
    when c.oauth_connected is not true                                       then 'OAuth niet verbonden'
    when coalesce(c.last_upload_at,'1970-01-01') < now() - interval '7 days'  then 'Geen recente upload (>7d)'
    else null
  end                                                   as probleem
from public.youtube_channels c
order by coalesce(c.subscriber_count, c.subscribers, 0) desc nulls last;

-- =====================================================================================
-- (3) v_mf_health — ÉÉN verdict + health% (sectie 1 van het Command Center)
--     Verdict-hiërarchie: MENSELIJKE ACTIE NODIG > INCIDENT > LET OP > GEZOND.
-- =====================================================================================
create or replace view public.v_mf_health as
with x as (
  select
    (select count(*) from public.infra_watchdog_incidents where status='open')                                      as open_incidents,
    (select open_critical from public.v_ctl_hermes_status)                                                          as open_critical,
    (select open_warning  from public.v_ctl_hermes_status)                                                          as open_warning,
    (select count(*) from hermes.escalations where status is null or status not in ('resolved','closed'))           as open_escalations,
    (select needs_attention from public.v_mf_uploads)                                                               as needs_attention,
    (select ceo_minutes_estimate from public.v_ceo_minutes_daily)                                                   as ceo_minutes,
    (select target_minutes from public.v_ceo_minutes_daily)                                                         as ceo_target,
    (select status from public.v_media_factory_certification)                                                       as certification,
    (select uploads_today from public.v_mf_uploads)                                                                 as uploads_today,
    (select bool_or(case when status='ok' then true else false end) from public.v_ceo_system_health)               as any_system_ok,
    (select count(*) from public.v_ceo_system_health where status in ('down','degraded'))                          as systems_degraded,
    (select count(*) from public.v_ceo_system_health)                                                               as systems_total
  from (select 1) s
)
select
  case
    when open_escalations > 0 or open_critical > 0 then 'MENSELIJKE ACTIE NODIG'
    when open_incidents > 0                        then 'INCIDENT'
    when needs_attention > 50 or ceo_minutes > ceo_target or open_warning > 0 then 'LET OP'
    else 'GEZOND'
  end                                                                                                               as verdict,
  -- health% = aandeel gezonde systemen, met aftrek voor open escalaties/incidenten
  greatest(0, least(100,
    round( 100.0 * (systems_total - systems_degraded) / nullif(systems_total,0) )
    - (open_escalations * 10) - (open_critical * 15) - (open_incidents * 5)
  ))::int                                                                                                           as health_pct,
  open_incidents, open_critical, open_warning, open_escalations,
  needs_attention, ceo_minutes, ceo_target, certification, uploads_today,
  systems_degraded, systems_total,
  now()                                                                                                             as berekend_op
from x;

-- =====================================================================================
-- (4) mf_classify_dead_queue() — eenmalige opschoning: dode wachtrij-records → 'archived'.
--     Dood = bronbestand_weg of quota op een rij die niet meer verwerkbaar is.
--     DEFAULT p_apply=false → telt alleen (dry-run). p_apply=true → muteert (expliciete actie).
--     Reuse: classificatie komt uit bestaande view v_ctl_upload_pipeline (fout_type).
-- =====================================================================================
create or replace function public.mf_classify_dead_queue(p_apply boolean default false)
 returns table(dood_bronbestand int, dood_quota int, totaal_gearchiveerd int)
 language plpgsql security definer set search_path to 'public'
as $function$
declare v_bron int; v_quota int;
begin
  with dood as (
    select p.id, p.fout_type
      from public.v_ctl_upload_pipeline p
     where p.fase in ('mislukt','afgeschreven','aandacht_nodig','in_wachtrij')
       and p.fout_type in ('bronbestand_weg','quota')
  )
  select count(*) filter (where fout_type='bronbestand_weg'),
         count(*) filter (where fout_type='quota')
    into v_bron, v_quota
    from dood;

  if p_apply then
    update public.youtube_upload_queue u
       set status='archived', updated_at=now(),
           last_error = coalesce(last_error,'')||' [mf-archived: dood, niet verwerkbaar]'
     where u.id in (
       select p.id from public.v_ctl_upload_pipeline p
        where p.fase in ('mislukt','afgeschreven','aandacht_nodig','in_wachtrij')
          and p.fout_type in ('bronbestand_weg','quota')
     );
  end if;

  dood_bronbestand := coalesce(v_bron,0);
  dood_quota := coalesce(v_quota,0);
  totaal_gearchiveerd := case when p_apply then coalesce(v_bron,0)+coalesce(v_quota,0) else 0 end;
  return next;
end $function$;

-- =====================================================================================
-- (5) hermes_supervisor() — bijgewerkt: 'Scrapers stil' alleen nog bij ACTIEVE scrapers.
--     Reden: alle 13 vastgoed-scrapers staan enabled=false (bewust). De oude check vuurde
--     op max(scraper_runs) ongeacht enabled → eindeloze valse 'Scrapers stil'-ruis.
--     Rest van de functie is 1-op-1 behouden (uit migratie 137).
-- =====================================================================================
create or replace function public.hermes_supervisor()
 returns void language plpgsql security definer
as $function$
declare
  v_oauth_blocked int; v_oauth_chan int;
  v_attention int; v_queue_in int; v_queue_last timestamptz;
  v_janitor_last timestamptz; v_scraper_last timestamptz; v_scrapers_enabled int;
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

  -- GEWIJZIGD: alleen alarmeren als er ÜBERHAUPT een actieve scraper is die stilstaat.
  select count(*) into v_scrapers_enabled from public.scraper_config where enabled = true;
  select max(sr.created_at) into v_scraper_last
    from public.scraper_runs sr
   where sr.source in (select source from public.scraper_config where enabled = true);
  if v_scrapers_enabled > 0 and (v_scraper_last is null or v_scraper_last < now() - interval '26 hours') then
    perform public.hermes_raise('scraper_idle','warning','scraper',null,
      'Scrapers stil','Laatste run van een actieve scraper: '||coalesce(v_scraper_last::text,'nooit')||'.');
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

-- =====================================================================================
-- (6) media_factory_daily_digest() — ÉÉN Telegram-digest per dag (sectie 10 Command Center).
--     Vat exact dezelfde waarheid samen als de pagina. Geen minuut-spam.
-- =====================================================================================
create or replace function public.media_factory_daily_digest()
 returns void language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_token text; v_chat text; v_msg text; v_winner text;
  v_inc_open int; v_inc_res int; v_ceo int; v_target int; v_mens text;
  h record; u record;
begin
  select * into h from public.v_mf_health;
  select * into u from public.v_mf_uploads;
  select title into v_winner from public.v_winner_intelligence order by views desc nulls last limit 1;
  select count(*) into v_inc_open from public.infra_watchdog_incidents where status='open';
  select count(*) into v_inc_res  from public.infra_watchdog_incidents where status='resolved' and resolved_at > now() - interval '24 hours';
  select ceo_minutes_estimate, target_minutes into v_ceo, v_target from public.v_ceo_minutes_daily;
  v_mens := case when coalesce(h.open_escalations,0) + coalesce(h.open_critical,0) > 0 then 'JA' else 'nee' end;

  v_msg := format(
    E'📊 <b>Media Factory · dagrapport</b>\nHealth: %s (%s%%) · CEO-min: %s/%s\nUploads vandaag: %s · publicaties vandaag: %s\nLaatste publicatie: %s · backlog: %s\nTop winner: %s\nOpen incidenten: %s · auto-opgelost 24u: %s\n<b>Menselijke actie nodig: %s</b>',
    h.verdict, h.health_pct, v_ceo, v_target,
    u.uploads_today, u.pubs_today,
    coalesce(u.last_publication_at::date::text,'—'), u.backlog,
    coalesce(left(v_winner,48),'geen'),
    v_inc_open, v_inc_res, v_mens);

  select value into v_token from public.hermes_config where key='telegram_bot_token';
  select value into v_chat  from public.hermes_config where key='telegram_chat_id';
  if v_token is not null and v_chat is not null then
    perform net.http_post(
      url  := 'https://api.telegram.org/bot'||v_token||'/sendMessage',
      body := jsonb_build_object('chat_id', v_chat, 'text', v_msg, 'parse_mode','HTML'));
  end if;
end $function$;

-- once-daily 06:00 UTC (~08:00 CET); idempotent (her-schedule veilig).
do $$ begin perform cron.unschedule('media-factory-daily-digest'); exception when others then null; end $$;
select cron.schedule('media-factory-daily-digest','0 6 * * *', $$ select public.media_factory_daily_digest(); $$);

-- Grants (consistent met bestaande controle-views; page draait via service_role/admin-client).
grant select on public.v_mf_uploads  to authenticated, service_role;
grant select on public.v_mf_channels to authenticated, service_role;
grant select on public.v_mf_health   to authenticated, service_role;
grant execute on function public.mf_classify_dead_queue(boolean) to service_role;
grant execute on function public.media_factory_daily_digest()    to service_role;
