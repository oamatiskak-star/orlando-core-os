-- ─────────────────────────────────────────────────────────────────────────
-- Migration 225 — Wekelijkse SEO+backlink-rapportage
-- ─────────────────────────────────────────────────────────────────────────
-- public.seo_weekly_report() vat GSC (7d clicks/impressies), GA4 organic,
-- indexatie-snapshot en backlink-KPI (referring domains/vloer) samen en logt
-- het als hermes.log_event('seo-weekly','info',...) → zichtbaar in hermes.logs,
-- NIET naar Telegram gepusht (conform cadans-regel: alleen kritiek pusht).
-- pg_cron: elke maandag 09:45 (ná de dagelijkse GSC-sync 09:20).
-- Read-only rapportage → bewust niet in de Engine Planner (zoals de seo-connector).

create or replace function public.seo_weekly_report()
returns text
language plpgsql
security definer
set search_path = public, vastgoed_core, hermes
as $fn$
declare
  v_clicks bigint; v_impr bigint; v_organic bigint;
  v_idx int; v_total int; v_disc int; v_idx_at date;
  v_ref int; v_live int; v_queued int; v_todo int; v_msg text;
begin
  select coalesce(sum(clicks),0), coalesce(sum(impressions),0)
    into v_clicks, v_impr
  from vastgoed_core.seo_gsc_daily where date >= current_date - 7;

  select indexed, total, discovered_not_indexed, captured_at::date
    into v_idx, v_total, v_disc, v_idx_at
  from vastgoed_core.seo_index_snapshots order by captured_at desc limit 1;

  select coalesce(sum(organic_sessions),0) into v_organic
  from vastgoed_core.seo_ga4_daily where date >= current_date - 7;

  select referring_domains_live, live, in_progress, todo
    into v_ref, v_live, v_queued, v_todo
  from public.v_backlink_overview where site = 'aquier.com';

  v_msg := format(
    'SEO weekrapport aquier.com — GSC 7d: %s clicks / %s impressies · organic sessies 7d: %s · indexatie: %s/%s geindexeerd (%s discovered-not-indexed, peil %s) · backlinks: %s/25 referring domains live (%s live / %s in behandeling / %s todo).',
    v_clicks, v_impr, v_organic, coalesce(v_idx,0), coalesce(v_total,0), coalesce(v_disc,0),
    coalesce(v_idx_at::text,'n/a'), coalesce(v_ref,0), coalesce(v_live,0), coalesce(v_queued,0), coalesce(v_todo,0));

  perform hermes.log_event('seo-weekly', 'info', 'seo_weekly_report', v_msg,
    jsonb_build_object('clicks',v_clicks,'impressions',v_impr,'organic',v_organic,
      'indexed',coalesce(v_idx,0),'total',coalesce(v_total,0),'discovered_not_indexed',coalesce(v_disc,0),
      'referring_domains',coalesce(v_ref,0),'backlinks_live',coalesce(v_live,0),
      'backlinks_queued',coalesce(v_queued,0),'backlinks_todo',coalesce(v_todo,0)));
  return v_msg;
end$fn$;

select cron.unschedule('seo-weekly-report') where exists (select 1 from cron.job where jobname='seo-weekly-report');
select cron.schedule('seo-weekly-report', '45 9 * * 1', 'select public.seo_weekly_report();');
