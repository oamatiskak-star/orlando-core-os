-- 168_platform_health_maintenance.sql
-- Platform Health + Supabase Maintenance Layer — zelfde filosofie als de bestaande
-- janitor (run_janitor): REVERSIBEL, FLAGGEN-NIET-WISSEN. Breidt uit van Database Health
-- naar volledige Platform Health: DB + Storage + Workers + Scrapers + Agents + Integraties.
-- ADDITIEF + idempotent. HARDE GATE: niet auto-toepassen; engine enabled=false; cron pas na go.
-- Destructieve delete ALLEEN achter expliciete allow_delete-parameter (default false → flag).

-- ── Live health-views (werken direct, geen worker nodig) ─────────────────────────
create or replace view public.v_ph_storage as
select bucket_id as bucket,
       count(*) as objects,
       coalesce(sum((metadata->>'size')::bigint), 0) as bytes
from storage.objects
group by bucket_id
order by bytes desc;

create or replace view public.v_ph_db as
select relname as table_name,
       n_live_tup as live_rows,
       n_dead_tup as dead_rows,
       pg_total_relation_size(relid) as total_bytes
from pg_stat_user_tables
order by pg_total_relation_size(relid) desc
limit 25;

create or replace view public.v_ph_queue as
select 'youtube_upload_queue' as queue, count(*) as total,
       jsonb_object_agg(status, n) as by_status
from (select status, count(*) n from public.youtube_upload_queue group by status) a
union all
select 'hermes.dispatch_queue', count(*),
       jsonb_object_agg(status, n)
from (select status, count(*) n from hermes.dispatch_queue group by status) b
union all
select 'content_horizon', count(*),
       jsonb_object_agg(status, n)
from (select status, count(*) n from public.content_horizon group by status) c;

create or replace view public.v_ph_workers as
select coalesce(display_name, worker_type) as name, host, status, queue_depth,
       last_error, last_heartbeat,
       round(extract(epoch from (now() - last_heartbeat)))::bigint as heartbeat_age_s
from public.worker_registry
order by last_heartbeat desc nulls last;

create or replace view public.v_ph_agents as
select s.name, st.status, st.error_count_24h, st.last_heartbeat_at,
       round(extract(epoch from (now() - st.last_heartbeat_at)))::bigint as heartbeat_age_s,
       s.enabled
from hermes.subagents s
left join hermes.agent_state st on st.subagent_id = s.id
order by st.error_count_24h desc nulls last;

create or replace view public.v_ph_scrapers as
select sc.source, sc.enabled, sc.interval_minutes, sc.priority, sc.last_modified,
       es.enabled as engine_enabled, es.block_key
from public.scraper_config sc
left join public.engine_schedule es on es.engine_key = sc.source
order by sc.enabled desc, sc.source;

create or replace view public.v_ph_integrations as
select 'youtube' as provider, name as label,
       case when oauth_connected then 'connected' else 'disconnected' end as status
from public.youtube_channels
union all
select 'social', platform, status from public.social_connections;

-- ── Maintenance audit-trail + gated janitor (flag-first) ─────────────────────────
create table if not exists public.db_health_audits (
  id          uuid primary key default gen_random_uuid(),
  shift       text not null default 'manual',
  ran_at      timestamptz not null default now(),
  status      text not null default 'clean' check (status in ('clean','issues','alarm')),
  findings    jsonb not null default '{}'::jsonb
);

-- run_db_janitor: schrijft een audit + flag-acties in de BESTAANDE janitor_actions.
-- allow_delete=false → uitsluitend rapporteren/flaggen (geen wissen). Reversibel.
create or replace function public.run_db_janitor(p_shift text default 'manual', p_allow_delete boolean default false)
returns public.db_health_audits language plpgsql as $fn$
declare
  v_audit       public.db_health_audits;
  v_storage_mb  numeric := 0;
  v_queue_back  int := 0;
  v_failed      int := 0;
  v_stale_agent int := 0;
  v_dead_int    int := 0;
  v_runaway     int := 0;
  v_status      text;
begin
  select round(coalesce(sum((metadata->>'size')::bigint),0)/1048576.0,1) into v_storage_mb from storage.objects;
  select count(*) into v_queue_back from public.youtube_upload_queue where status in ('queued','planned');
  select count(*) into v_failed from public.youtube_upload_queue where status in ('failed','unrecoverable','manual_review_required');
  select count(*) into v_stale_agent from hermes.agent_state where last_heartbeat_at < now() - interval '30 minutes';
  select count(*) into v_dead_int from public.youtube_channels where oauth_connected is not true;
  select count(*) into v_runaway from pg_stat_user_tables where n_dead_tup > 100000;

  v_status := case
    when v_failed > 200 or v_storage_mb > 50000 then 'alarm'
    when v_failed > 0 or v_queue_back > 1000 or v_stale_agent > 0 or v_runaway > 0 then 'issues'
    else 'clean' end;

  insert into public.db_health_audits(shift, status, findings)
  values (p_shift, v_status, jsonb_build_object(
    'storage_mb', v_storage_mb, 'queue_backlog', v_queue_back, 'failed_jobs', v_failed,
    'stale_agents', v_stale_agent, 'disconnected_integrations', v_dead_int,
    'runaway_tables', v_runaway, 'allow_delete', p_allow_delete))
  returning * into v_audit;

  -- FLAGGEN (geen wissen): log opvallende bevindingen in janitor_actions als die tabel bestaat.
  if v_runaway > 0 then
    begin
      insert into public.janitor_actions(action, reason)
      values ('flag_runaway_tables', v_runaway || ' tabellen met >100k dead tuples — VACUUM aanbevolen');
    exception when others then null; end;
  end if;

  return v_audit;
end $fn$;

insert into public.engine_schedule (engine_key, grp, label, block_key, enabled)
values ('maintenance:db-janitor','maintenance','Supabase Platform Health janitor', null, false)
on conflict (engine_key) do update set label=excluded.label;

do $u$ begin perform cron.unschedule('platform_health_janitor'); exception when others then null; end $u$;
select cron.schedule('platform_health_janitor','30 2 * * *',
  $cron$ select case when public.engine_window_open('maintenance:db-janitor')
                     then 1 else 0 end $cron$);

grant select on public.v_ph_storage, public.v_ph_db, public.v_ph_queue, public.v_ph_workers,
               public.v_ph_agents, public.v_ph_scrapers, public.v_ph_integrations,
               public.db_health_audits to authenticated, anon;
