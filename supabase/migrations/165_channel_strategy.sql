-- 165_channel_strategy.sql
-- CF2 Adaptive Growth Engine — Channel Strategy Layer (per-kanaal profiel).
-- ADDITIEF + idempotent. GEEN workers, GEEN cron → Engine Planner n.v.t.
-- HARDE GATE: niet automatisch op prod toepassen — los na review.
-- Modes: growth / authority / revenue (Rule 10: bereik bepaalt mode). Mode wordt LIVE
-- berekend in de view uit echte bereik-cijfers; de tabel houdt de bewerkbare strategie.

create table if not exists public.channel_strategy (
  channel_id       uuid primary key references public.media_holding_channels(id) on delete cascade,
  niche            text,
  topics           text[]  not null default '{}',
  own_cta          text[]  not null default '{}',
  funnel_strategy  jsonb   not null default '{}'::jsonb,
  content_rules    jsonb   not null default '{}'::jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- Seed: per kanaal een profiel met niche-gebaseerde topics + standaard CTA's/regels.
insert into public.channel_strategy (channel_id, niche, topics, own_cta, content_rules)
select ch.id, ch.niche,
  case
    when ch.niche = 'vastgoed_education_nl' then array['vastgoed','transformaties','deals','rendement','marktrapporten']
    when ch.niche = 'finance_education_nl'  then array['rendement','cashflow','dividenden','beleggen','besparen','persoonlijke financien']
    when ch.niche = 'finance_education_es'  then array['inversion','rentabilidad','ahorro','dividendos','mercados']
    when ch.niche ilike '%satisfying%' or ch.niche ilike '%loop%' then array['seamless loops','satisfying','mini-world','asmr']
    else array[]::text[]
  end as topics,
  case
    when ch.niche ilike 'finance%' or ch.niche ilike 'vastgoed%'
      then array['Abonneer voor meer','Download het rapport','Word member']
    else array['Abonneer voor meer']
  end as own_cta,
  jsonb_build_object(
    'growth_priorities', array['views','retentie','abonneegroei'],
    'revenue_priorities', array['websiteverkeer','rapportverkopen','memberships'],
    'shorts_first', true
  ) as content_rules
from public.media_holding_channels ch
where ch.niche is not null and ch.niche <> 'youtube_cat_1'
on conflict (channel_id) do nothing;

-- View: strategie + LIVE mode + bereik + eigen content-tellingen.
create or replace view public.v_channel_strategy as
with reach as (
  select mh.id as channel_id, mh.name, mh.niche, mh.status,
         coalesce(yc.subscriber_count, 0) as subscribers,
         coalesce(yc.view_count, mh.current_views_10d, 0) as total_views,
         coalesce(yc.estimated_revenue, 0) as revenue
  from public.media_holding_channels mh
  left join public.youtube_channels yc on yc.id = mh.youtube_channel_id
),
counts as (
  select ci.channel_id,
         count(*) as creatives,
         count(distinct ci.hook) filter (where ci.hook is not null) as hooks
  from public.media_holding_content_items ci
  group by ci.channel_id
),
yt_counts as (
  select mh.id as channel_id, count(yv.*) as youtube_videos,
         count(yv.*) filter (where yv.youtube_video_id is not null) as with_thumb
  from public.media_holding_channels mh
  left join public.youtube_videos yv on yv.channel_id = mh.youtube_channel_id
  group by mh.id
)
select
  r.channel_id, r.name, r.niche, r.status, r.subscribers, r.total_views, r.revenue,
  -- Mode (Rule 10): bereik bepaalt groei → autoriteit → omzet
  case
    when r.revenue > 0 and r.total_views >= 500000 then 'revenue'
    when r.subscribers >= 1000 or r.total_views >= 50000 then 'authority'
    else 'growth'
  end as mode,
  coalesce(cs.topics, '{}')          as topics,
  coalesce(cs.own_cta, '{}')         as own_cta,
  coalesce(cs.funnel_strategy, '{}'::jsonb) as funnel_strategy,
  coalesce(cs.content_rules, '{}'::jsonb)   as content_rules,
  coalesce(c.creatives, 0)           as creatives,
  coalesce(c.hooks, 0)               as hooks,
  coalesce(y.youtube_videos, 0)      as youtube_videos,
  coalesce(y.with_thumb, 0)          as videos_with_thumb
from reach r
left join public.channel_strategy cs on cs.channel_id = r.channel_id
left join counts c on c.channel_id = r.channel_id
left join yt_counts y on y.channel_id = r.channel_id;

grant select on public.v_channel_strategy to authenticated, anon;
grant select, insert, update on public.channel_strategy to authenticated;
