-- 207_ceo_system_attention_linkage.sql
-- Koppelt de Aandachtspunten (#206) aan het System Health Board: per systeem nu PER-SYSTEEM
-- open_incidents (via check_slug→categorie) + nieuwe kolom attention_items
-- (falende checks + open incidenten + Media Factory upload-reviews). Read-only, additief.
create or replace view public.v_ceo_system_health as
with inc as (
  select case c.category
           when 'youtube' then 'Media Factory' when 'queue' then 'Media Factory'
           when 'acquisition' then 'Scrapers/Acquisitie' when 'vercel-cron' then 'Aquier/Web'
           when 'orchestration' then 'Hermes' when 'render-engine' then 'Render Engines'
           when 'render-worker' then 'Render Workers' else coalesce(c.category,'Overig') end as system,
         count(*) as n
  from public.infra_watchdog_incidents i
  join public.infra_watchdog_check_status c on c.slug = i.check_slug
  where i.status = 'open'
  group by 1
),
mrev as (select count(*) as n from public.youtube_upload_queue where status='manual_review_required'),
sys as (
  select case category
           when 'youtube' then 'Media Factory' when 'queue' then 'Media Factory'
           when 'acquisition' then 'Scrapers/Acquisitie' when 'vercel-cron' then 'Aquier/Web'
           when 'orchestration' then 'Hermes' when 'render-engine' then 'Render Engines'
           when 'render-worker' then 'Render Workers' else coalesce(category,'Overig') end as system,
         count(*) as checks_total,
         count(*) filter (where last_ok) as checks_ok,
         count(*) filter (where not last_ok) as checks_failing,
         max(last_run_at) as last_run,
         max(severity) filter (where not last_ok) as worst_severity
  from public.infra_watchdog_check_status where enabled group by 1
)
select s.system,
       case when s.checks_failing = 0 then 'ok' when s.checks_failing >= s.checks_total then 'down' else 'degraded' end as status,
       (select bool_or(live) from hermes.autopilot_state where scope='global') as autonomy_live,
       s.checks_failing as needs_attention,
       s.checks_total, s.checks_ok, s.worst_severity, s.last_run,
       coalesce(inc.n,0) as open_incidents,
       s.checks_failing + coalesce(inc.n,0)
         + case when s.system='Media Factory' then (select n from mrev) else 0 end as attention_items
from sys s left join inc on inc.system = s.system
union all
select 'Uploads pipeline',
       case when (select count(*) from public.youtube_upload_queue where status='verified_live' and upload_finished_at > now()-interval '24 hours') > 0
              then case when (select n from mrev) > 50 then 'degraded' else 'ok' end
            else 'idle' end,
       (select bool_or(live) from hermes.autopilot_state where scope='global'),
       (select n from mrev),
       (select count(*) from public.youtube_upload_queue),
       (select count(*) from public.youtube_upload_queue where status='verified_live'),
       null,
       (select max(upload_finished_at) from public.youtube_upload_queue),
       0,
       (select n from mrev);

grant select on public.v_ceo_system_health to authenticated, anon;
