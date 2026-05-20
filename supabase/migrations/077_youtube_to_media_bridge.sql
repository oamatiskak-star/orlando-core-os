-- Migration 077: YouTube → Media Holding bridge
-- Koppelt echte youtube_channels/youtube_videos data aan media_holding_*
-- tabellen zodat Executive Layer (ATLAS, Decision Engine, KPI view) niet
-- meer op een lege media_holding_metrics tabel werkt.
--
-- 1. Schema-koppeling: youtube_channel_id op media_holding_channels,
--    youtube_video_id op media_holding_metrics.
-- 2. Backfill: per youtube_channels OAuth-connected rij een
--    media_holding_channels record (of update existing match).
-- 3. Initial snapshot: per youtube_video met views > 0 een
--    media_holding_metrics rij voor now() — zodat agents direct data hebben.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Schema bridge
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.media_holding_channels
  add column if not exists youtube_channel_id uuid references public.youtube_channels(id) on delete set null;

create unique index if not exists idx_mh_channels_youtube_channel_unique
  on public.media_holding_channels (youtube_channel_id)
  where youtube_channel_id is not null;

alter table public.media_holding_metrics
  add column if not exists youtube_video_id text,
  add column if not exists channel_id uuid references public.media_holding_channels(id) on delete cascade;

create index if not exists idx_mh_metrics_channel_snapshot
  on public.media_holding_metrics (channel_id, snapshot_at desc);
create index if not exists idx_mh_metrics_yt_video_snapshot
  on public.media_holding_metrics (youtube_video_id, snapshot_at desc)
  where youtube_video_id is not null;

-- Backfill channel_id op metrics uit content_item_id link (voor bestaande rijen, mocht er ooit data zijn)
update public.media_holding_metrics m
   set channel_id = ci.channel_id
  from public.media_holding_content_items ci
 where m.content_item_id = ci.id
   and m.channel_id is null;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Auto-koppel bestaande LoopForge Lab aan youtube_channels.LoopForge AI
-- ─────────────────────────────────────────────────────────────────────────────
update public.media_holding_channels mhc
   set youtube_channel_id = yc.id,
       updated_at = now()
  from public.youtube_channels yc
 where mhc.name ilike 'loopforge%'
   and yc.name ilike 'loopforge%'
   and mhc.youtube_channel_id is null;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Auto-create media_holding_channels per echte OAuth-verbonden YT channel
--    (alleen waar nog geen mapping bestaat)
-- ─────────────────────────────────────────────────────────────────────────────
insert into public.media_holding_channels (name, handle, niche, language, persona_owner, status, target_views_10d, youtube_channel_id)
select
  yc.name                                                                       as name,
  yc.handle                                                                     as handle,
  case
    when yc.name ilike '%vermogen%'      then 'finance_education_nl'
    when yc.name ilike '%spaar%'         then 'finance_education_nl'
    when yc.name ilike '%beleggings%'    then 'finance_education_nl'
    when yc.name ilike '%vastgoed%'      then 'vastgoed_education_nl'
    when yc.name ilike '%propertyinv%'   then 'vastgoed_education_nl'
    when yc.name ilike '%crypto%'        then 'crypto_education_nl'
    when yc.name ilike '%aquier%es%'     then 'finance_education_es'
    when yc.name ilike '%aquier%'        then 'finance_education_nl'
    when yc.name ilike '%brickpulse%'    then 'satisfying_brick_world'
    when yc.name ilike '%loopforge%'     then 'seamless_loops'
    when yc.name ilike '%slicetheory%'   then 'satisfying_cutting'
    else                                      'general'
  end                                                                           as niche,
  coalesce(yc.language, 'nl')                                                   as language,
  case
    when yc.name ilike '%brickpulse%' or yc.name ilike '%loopforge%' or yc.name ilike '%slicetheory%'
      then 'Nova'
    else 'Vortex'
  end                                                                           as persona_owner,
  case when yc.oauth_connected then 'live' else 'incubating' end                as status,
  case
    when yc.name ilike '%brickpulse%' or yc.name ilike '%loopforge%' or yc.name ilike '%slicetheory%'
      then 280000
    else 100000
  end                                                                           as target_views_10d,
  yc.id                                                                         as youtube_channel_id
from public.youtube_channels yc
where yc.oauth_connected
  and not exists (
    select 1 from public.media_holding_channels mhc where mhc.youtube_channel_id = yc.id
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Initial snapshot: per youtube_video met views > 0 een metrics-rij
--    (één snapshot per video, gemarkeerd nu — zodat ATLAS direct data ziet)
-- ─────────────────────────────────────────────────────────────────────────────
insert into public.media_holding_metrics
  (channel_id, youtube_video_id, platform, snapshot_at, views, likes, comments, shares, retention_pct, ctr_pct, revenue)
select
  mhc.id                                                              as channel_id,
  yv.youtube_video_id                                                 as youtube_video_id,
  'youtube'                                                           as platform,
  now()                                                               as snapshot_at,
  coalesce(yv.views, 0)                                               as views,
  coalesce(yv.likes, 0)                                               as likes,
  coalesce(yv.comments, 0)                                            as comments,
  0                                                                   as shares,
  coalesce(yv.retention, 0)                                           as retention_pct,
  coalesce(yv.ctr, 0)                                                 as ctr_pct,
  coalesce(yv.estimated_revenue, yv.revenue, 0)                       as revenue
from public.youtube_videos yv
join public.media_holding_channels mhc on mhc.youtube_channel_id = yv.channel_id
where yv.youtube_video_id is not null
  and (yv.views > 0 or yv.likes > 0 or yv.comments > 0);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Sync helper view: per kanaal aggregaat van laatste snapshot
-- ─────────────────────────────────────────────────────────────────────────────
create or replace view public.v_media_metrics_channel_latest as
select
  mhc.id                                                              as channel_id,
  mhc.name                                                            as channel_name,
  mhc.niche                                                           as niche,
  mhc.youtube_channel_id                                              as youtube_channel_id,
  count(distinct m.youtube_video_id) filter (where m.snapshot_at > now() - interval '24 hours')                          as videos_active_24h,
  coalesce(sum(m.views) filter (where m.snapshot_at > now() - interval '24 hours'), 0)                                   as views_24h,
  coalesce(sum(m.views) filter (where m.snapshot_at > now() - interval '7 days'), 0)                                     as views_7d,
  coalesce(avg(m.retention_pct) filter (where m.retention_pct > 0 and m.snapshot_at > now() - interval '7 days'), 0)     as retention_avg_7d,
  coalesce(avg(m.ctr_pct) filter (where m.ctr_pct > 0 and m.snapshot_at > now() - interval '7 days'), 0)                 as ctr_avg_7d,
  max(m.snapshot_at)                                                                                                      as latest_snapshot_at
from public.media_holding_channels mhc
left join public.media_holding_metrics m on m.channel_id = mhc.id
group by mhc.id, mhc.name, mhc.niche, mhc.youtube_channel_id;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Rebuild v_executive_kpis met live fallback naar youtube_videos
--    aggregaat zolang media_holding_metrics nog niet vol gevuld is
-- ─────────────────────────────────────────────────────────────────────────────
create or replace view public.v_executive_kpis as
with snap_24h as (
  select coalesce(sum(views), 0) as v from public.media_holding_metrics
   where snapshot_at > now() - interval '24 hours'
),
snap_7d as (
  select coalesce(sum(views), 0) as v from public.media_holding_metrics
   where snapshot_at > now() - interval '7 days'
),
yt_total as (
  select coalesce(sum(views), 0) as v from public.youtube_videos
)
select
  (select count(*) from public.media_holding_channels where status in ('live','scaling','incubating'))                            as channels_active,
  greatest((select v from snap_24h), 0)                                                                                            as views_24h,
  case
    when (select v from snap_7d) > 0 then (select v from snap_7d)
    else (select v from yt_total)
  end                                                                                                                              as views_7d,
  (select count(*) from public.executive_alerts where acknowledged_at is null and severity = 'critical')                          as critical_alerts_open,
  (select count(*) from public.executive_alerts where acknowledged_at is null)                                                    as alerts_open_total,
  (select count(*) from public.executive_recommendations where status = 'pending')                                                as recs_pending,
  coalesce((select avg(retention_pct) from public.media_holding_metrics where snapshot_at > now() - interval '7 days' and retention_pct > 0), 0) as retention_avg_7d,
  (select coalesce(sum(revenue_attributed),0) from public.content_fund_allocations where period_end >= current_date - interval '30 days') as revenue_30d,
  (select coalesce(sum(allocated_eur),0) from public.content_fund_allocations where period_end >= current_date - interval '30 days')      as spend_30d;
