-- 193_s1_revenue_ctr_aggregation.sql
-- AUTONOMOUS GROWTH PHASE 1 — S1 (P0): Revenue + CTR ingestion, aggregatie-laag.
--
-- Context: de live ingestie (cron sync-video-analytics) schrijft vanaf nu echte
-- ctr/impressions/estimated_revenue/rpm per video naar youtube_video_analytics.
-- Deze migratie levert de AGGREGATIE + dashboard-bron + Engine Planner-registratie.
--
-- Veilig & additief: alleen views + één functie + engine_schedule-rijen.
-- Geen ALTER op bestaande kolommen (ctr is al numeric(5,2) — past voor CTR-percentages).
-- Joins geverifieerd op live schema (12-06):
--   youtube_video_analytics.channel_id  -> youtube_channels.id
--   media_holding_channels.youtube_channel_id (uuid) -> youtube_channels.id
--   monetization_metrics.channel_id     -> media_holding_channels.id

-- ── 1) Per-kanaal omzet/CTR (live berekend; bron voor dashboard) ─────────────
create or replace view public.v_channel_revenue as
select
  c.id                                                                              as channel_id,
  coalesce(c.naam, c.name, c.handle)                                                as channel_name,
  coalesce(sum(a.estimated_revenue) filter (where a.date >= current_date), 0)       as revenue_today,
  coalesce(sum(a.estimated_revenue) filter (where a.date >= current_date - 6), 0)   as revenue_7d,
  coalesce(sum(a.estimated_revenue) filter (where a.date >= current_date - 29), 0)  as revenue_30d,
  coalesce(sum(a.views)             filter (where a.date >= current_date), 0)        as views_today,
  coalesce(sum(a.views)             filter (where a.date >= current_date - 6), 0)    as views_7d,
  coalesce(sum(a.views)             filter (where a.date >= current_date - 29), 0)   as views_30d,
  round(avg(a.ctr) filter (where a.date >= current_date - 6  and a.ctr > 0), 2)      as avg_ctr_7d,
  round(avg(a.rpm) filter (where a.date >= current_date - 29 and a.rpm > 0), 2)      as avg_rpm_30d
from public.youtube_channels c
left join public.youtube_video_analytics a on a.channel_id = c.id
group by c.id, coalesce(c.naam, c.name, c.handle);

comment on view public.v_channel_revenue is
  'S1: per-kanaal omzet (vandaag/7d/30d), views en gem. CTR/RPM uit youtube_video_analytics.';

-- ── 2) Top videos op omzet (30d) ────────────────────────────────────────────
create or replace view public.v_top_videos_revenue as
select
  a.video_id,
  a.channel_id,
  coalesce(c.naam, c.name, c.handle)                       as channel_name,
  v.title,
  v.youtube_video_id,
  sum(a.estimated_revenue)                                 as revenue_30d,
  sum(a.views)                                             as views_30d,
  round(avg(a.ctr) filter (where a.ctr > 0), 2)            as avg_ctr,
  round(avg(a.rpm) filter (where a.rpm > 0), 2)            as avg_rpm
from public.youtube_video_analytics a
join public.youtube_videos   v on v.id = a.video_id
join public.youtube_channels c on c.id = a.channel_id
where a.date >= current_date - 29
group by a.video_id, a.channel_id, coalesce(c.naam, c.name, c.handle), v.title, v.youtube_video_id
order by sum(a.estimated_revenue) desc nulls last, sum(a.views) desc
limit 100;

comment on view public.v_top_videos_revenue is
  'S1: top-100 videos op geschatte omzet (30d), met views/CTR/RPM.';

-- ── 3) Writer voor monetization_metrics (per media_holding-kanaal × periode) ──
-- Geeft de tot nu toe lege monetization_metrics-tabel een bron. Idempotent per dag:
-- vervangt de youtube-snapshot van vandaag. Bedoeld om dagelijks aangeroepen te worden.
create or replace function public.aggregate_monetization_metrics()
returns integer
language plpgsql
as $$
declare
  v_count integer := 0;
begin
  delete from public.monetization_metrics
   where platform = 'youtube' and captured_at::date = current_date;

  with periods(days) as (values (1),(7),(30)),
  agg as (
    select
      m.id                                              as mh_channel_id,
      p.days                                            as days,
      coalesce(sum(a.views), 0)::bigint                 as views,
      coalesce(sum(a.estimated_revenue), 0)             as est_rev,
      coalesce(round(avg(a.rpm) filter (where a.rpm > 0), 2), 0) as rpm
    from public.media_holding_channels m
    join public.youtube_channels y on y.id = m.youtube_channel_id
    cross join periods p
    left join public.youtube_video_analytics a
      on a.channel_id = y.id and a.date >= current_date - (p.days - 1)
    group by m.id, p.days
  )
  insert into public.monetization_metrics
    (channel_id, platform, period_start, period_end, views, estimated_revenue, rpm, raw_payload, captured_at)
  select
    mh_channel_id, 'youtube', current_date - (days - 1), current_date, views, est_rev, rpm,
    jsonb_build_object('source', 'youtube_video_analytics', 'period_days', days), now()
  from agg;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

comment on function public.aggregate_monetization_metrics() is
  'S1: rollt youtube_video_analytics op naar monetization_metrics (periodes 1/7/30d, platform=youtube).';

-- ── 4) Engine Planner-registratie (verplicht per project-regel) ──────────────
-- Lichte read/aggregatie-jobs; delen het bestaande 'youtube'-blok.
insert into public.engine_schedule (engine_key, grp, label, block_key, enabled) values
  ('media:revenue-analytics-sync', 'media', 'S1 Revenue/CTR analytics-sync (Vercel cron sync-video-analytics)', 'youtube', true),
  ('media:monetization-aggregate', 'media', 'S1 Monetization aggregatie (youtube_video_analytics -> monetization_metrics)', 'youtube', true)
on conflict (engine_key) do nothing;
