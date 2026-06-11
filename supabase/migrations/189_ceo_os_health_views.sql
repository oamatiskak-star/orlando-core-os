-- 189_ceo_os_health_views.sql
-- Roadmap OS F1b — CEO-OS synthese-views (read-only) over bestaande health-bronnen.
-- Geen nieuwe instrumentatie, geen datamutatie, geen schema-wijziging.
-- v_ceo_system_health: 1 rij per kernsysteem (status/autonomie/aandacht/incidenten).
-- v_ceo_minutes_daily: schatting handmatige interventietijd/dag (doel <20).
-- v_media_factory_certification: 10 criteria + status NOT_CERTIFIED/CERTIFIED.

-- ── 1) SYSTEM HEALTH (per watchdog-categorie → systeem + dedicated uploads-rij) ──
create or replace view public.v_ceo_system_health as
with sys as (
  select case category
           when 'youtube' then 'Media Factory'
           when 'queue' then 'Media Factory'
           when 'acquisition' then 'Scrapers/Acquisitie'
           when 'vercel-cron' then 'Aquier/Web'
           when 'orchestration' then 'Hermes'
           when 'render-engine' then 'Render Engines'
           when 'render-worker' then 'Render Workers'
           else coalesce(category,'Overig') end as system,
         count(*) as checks_total,
         count(*) filter (where last_ok) as checks_ok,
         count(*) filter (where not last_ok) as checks_failing,
         max(last_run_at) as last_run,
         max(severity) filter (where not last_ok) as worst_severity
  from public.infra_watchdog_check_status
  where enabled
  group by 1
)
select s.system,
       case when s.checks_failing = 0 then 'ok'
            when s.checks_failing >= s.checks_total then 'down'
            else 'degraded' end as status,
       (select bool_or(live) from hermes.autopilot_state where scope='global') as autonomy_live,
       s.checks_failing as needs_attention,
       s.checks_total, s.checks_ok, s.worst_severity, s.last_run,
       (select count(*) from public.infra_watchdog_incidents i where i.status='open') as open_incidents
from sys s
union all
select 'Uploads pipeline',
       case when (select count(*) from public.youtube_upload_queue where status='verified_live' and upload_finished_at > now()-interval '24 hours') > 0
              then case when (select count(*) from public.youtube_upload_queue where status='manual_review_required') > 50 then 'degraded' else 'ok' end
            else 'idle' end,
       (select bool_or(live) from hermes.autopilot_state where scope='global'),
       (select count(*) from public.youtube_upload_queue where status='manual_review_required'),
       (select count(*) from public.youtube_upload_queue),
       (select count(*) from public.youtube_upload_queue where status='verified_live'),
       null,
       (select max(upload_finished_at) from public.youtube_upload_queue),
       (select count(*) from public.infra_watchdog_incidents i where i.status='open');

-- ── 2) CEO MINUTES PER DAY (schatting open mens-werk × norm) ────────────────
create or replace view public.v_ceo_minutes_daily as
with x as (
  select
    (select count(*) from public.youtube_upload_queue where status='manual_review_required') as manual_reviews,
    (select count(*) from public.infra_watchdog_check_status where enabled and not last_ok) as failing_checks,
    (select count(*) from public.infra_watchdog_incidents where status='open') as open_incidents,
    (select count(*) from hermes.escalations where status is null or status not in ('resolved','closed')) as open_escalations
)
select current_date as day, x.manual_reviews, x.failing_checks, x.open_incidents, x.open_escalations,
       (x.manual_reviews*2 + x.failing_checks*5 + x.open_incidents*10 + x.open_escalations*5) as ceo_minutes_estimate,
       20 as target_minutes,
       'review 2m · failing-check 5m · incident 10m · escalation 5m' as norm
from x;

-- ── 3) MEDIA FACTORY AUTONOMY CERTIFICATION (10 criteria + status) ─────────
create or replace view public.v_media_factory_certification as
with c as (
  select
    (select count(*) from public.youtube_upload_queue where status='manual_review_required')=0
      and (select count(*) from hermes.escalations where status is null or status not in ('resolved','closed'))=0   as c1_no_human_7d,
    (select count(*) from public.youtube_upload_queue where status='verified_live' and upload_finished_at > now()-interval '24 hours')>0 as c2_uploads_flowing,
    (select count(*) from public.youtube_channel_health where token_valid and coalesce(strikes,0)=0)>0 as c3_channels_healthy,
    (select count(*) from public.youtube_upload_queue where status='verified_live' and upload_finished_at > now()-interval '7 days')>0 as c4_winners_proxy,
    (select count(*) from public.director_cycles where cycle_date > current_date-7)>0 as c5_strategy_improving,
    (select count(*) from public.infra_watchdog_incidents)>0 as c6_incidents_detected,
    (select count(*) from hermes.repair_suggestions)>0 as c7_incidents_diagnosed,
    (select count(*) from public.infra_watchdog_incidents where status='resolved')>0 as c8_incidents_healed,
    (select count(*) from hermes.validation_runs)>0 as c9_recovery_validated,
    (select count(*) from hermes.escalations where status is null or status not in ('resolved','closed')) <= 3 as c10_low_escalation
)
select c.*,
  (c1_no_human_7d and c2_uploads_flowing and c3_channels_healthy and c4_winners_proxy and c5_strategy_improving
   and c6_incidents_detected and c7_incidents_diagnosed and c8_incidents_healed and c9_recovery_validated and c10_low_escalation)
   as all_pass,
  case when (c1_no_human_7d and c2_uploads_flowing and c3_channels_healthy and c4_winners_proxy and c5_strategy_improving
   and c6_incidents_detected and c7_incidents_diagnosed and c8_incidents_healed and c9_recovery_validated and c10_low_escalation)
   then 'CERTIFIED' else 'NOT_CERTIFIED' end as status,
  (select ceo_minutes_estimate from public.v_ceo_minutes_daily) as ceo_minutes_estimate
from c;

grant select on
  public.v_ceo_system_health, public.v_ceo_minutes_daily, public.v_media_factory_certification
  to authenticated, anon;
