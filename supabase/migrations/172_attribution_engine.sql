-- 172_attribution_engine.sql
-- CF2 Fase 5D — Attribution Engine. View → Click → Lead → Rapport → Membership → Sale →
-- Revenue, per kanaal en per niche, met VERPLICHTE confidence. Geen omzetclaims zonder
-- confidence. ADDITIEF + idempotent. HARDE GATE: niet auto-toepassen.
-- Views = echte youtube_video_analytics; commercieel = affiliate_* (nu 0 → "Geen data");
-- Rapport/Membership = geen bron-tabel → null.

create or replace view public.v_attribution_channel as
with vids as (
  select yv.id, yv.channel_id, mh.id as mh_channel_id, mh.name, mh.niche
  from public.youtube_videos yv
  join public.media_holding_channels mh on mh.youtube_channel_id = yv.channel_id
),
an as (
  select distinct on (video_id) video_id, views from public.youtube_video_analytics
  where video_id is not null order by video_id, recorded_at desc
),
viewsum as (
  select v.mh_channel_id, sum(coalesce(an.views,0)) as views
  from vids v left join an on an.video_id = v.id group by v.mh_channel_id
),
clk as (select channel_id, count(*) n from public.affiliate_clicks group by channel_id),
conv as (
  select channel_id, count(*) leads,
         count(*) filter (where lower(status)='confirmed') sales,
         coalesce(sum(commission_eur) filter (where lower(status)='confirmed'),0) revenue
  from public.affiliate_conversions group by channel_id
)
select
  mh.id as channel_id, mh.name, mh.niche,
  coalesce(vs.views, 0)        as views,
  coalesce(c.n, 0)             as clicks,
  null::bigint                 as rapport,      -- geen bron → "Geen data"
  coalesce(cv.leads, 0)        as leads,
  null::bigint                 as memberships,  -- geen bron → "Geen data"
  coalesce(cv.sales, 0)        as sales,
  coalesce(cv.revenue, 0)      as revenue,
  -- VERPLICHTE confidence: aandeel funnel dat echt gekoppeld is
  round((
     (case when coalesce(vs.views,0) > 0 then 0.34 else 0 end)
   + (case when coalesce(c.n,0) > 0 then 0.33 else 0 end)
   + (case when coalesce(cv.revenue,0) > 0 then 0.33 else 0 end))::numeric, 2) as confidence
from public.media_holding_channels mh
left join viewsum vs on vs.mh_channel_id = mh.id
left join clk c on c.channel_id = mh.id
left join conv cv on cv.channel_id = mh.id;

-- per niche-aggregaat
create or replace view public.v_attribution_niche as
select niche,
  sum(views) as views, sum(clicks) as clicks, sum(leads) as leads,
  null::bigint as rapport, null::bigint as memberships,
  sum(sales) as sales, sum(revenue) as revenue,
  round(avg(confidence)::numeric, 2) as confidence
from public.v_attribution_channel
group by niche order by views desc;

grant select on public.v_attribution_channel, public.v_attribution_niche to authenticated, anon;
