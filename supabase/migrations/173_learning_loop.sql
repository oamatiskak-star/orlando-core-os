-- 173_learning_loop.sql
-- CF2 Fase 5E — Learning Loop. Waarom won/verloor deze video? Patronen afgeleid uit de
-- ECHTE winners/losers (v_hook_classified, migr 169). LIVE views — geen worker nodig.
-- Deze patronen voeden Hook Intelligence / Winner Intelligence / Content Horizon (de
-- gated producer leest ze). ADDITIEF + idempotent. HARDE GATE: niet auto-toepassen.

-- winnende patronen (wat wint): niche × categorie × lengte
create or replace view public.v_winner_patterns as
select niche, category,
       case when is_short then 'short' else 'long' end as length_bucket,
       count(*) as n, round(avg(hook_score)::numeric,0) as avg_score, round(avg(views)::numeric,0) as avg_views
from public.v_hook_classified
where winner_status in ('top_5pct','winner')
group by niche, category, (case when is_short then 'short' else 'long' end)
order by n desc, avg_score desc;

-- verliezende patronen (wat verliest)
create or replace view public.v_loser_patterns as
select niche, category,
       case when is_short then 'short' else 'long' end as length_bucket,
       count(*) as n, round(avg(views)::numeric,0) as avg_views
from public.v_hook_classified
where winner_status = 'loser'
group by niche, category, (case when is_short then 'short' else 'long' end)
order by n desc;

-- hook-patronen: win-rate per niche × categorie
create or replace view public.v_hook_patterns as
select niche, category,
       count(*) as total,
       count(*) filter (where winner_status in ('top_5pct','winner')) as winners,
       count(*) filter (where winner_status = 'loser') as losers,
       round((count(*) filter (where winner_status in ('top_5pct','winner'))::numeric
              / nullif(count(*) filter (where winner_status <> 'insufficient_data'),0) * 100), 1) as win_rate
from public.v_hook_classified
group by niche, category
having count(*) filter (where winner_status <> 'insufficient_data') > 0
order by win_rate desc nulls last;

-- thumbnail-patronen: heeft thumbnail vs win-rate
create or replace view public.v_thumbnail_patterns as
select (youtube_video_id is not null or thumbnail_url is not null) as has_thumbnail,
       count(*) as total,
       count(*) filter (where winner_status in ('top_5pct','winner')) as winners,
       round((count(*) filter (where winner_status in ('top_5pct','winner'))::numeric
              / nullif(count(*) filter (where winner_status <> 'insufficient_data'),0) * 100), 1) as win_rate
from public.v_hook_classified
group by (youtube_video_id is not null or thumbnail_url is not null);

-- kanaal-patronen: win-rate per kanaal
create or replace view public.v_channel_patterns as
select yc.name as channel, hc.niche,
       count(*) as total,
       count(*) filter (where hc.winner_status in ('top_5pct','winner')) as winners,
       round((count(*) filter (where hc.winner_status in ('top_5pct','winner'))::numeric
              / nullif(count(*) filter (where hc.winner_status <> 'insufficient_data'),0) * 100), 1) as win_rate
from public.v_hook_classified hc
join public.youtube_videos yv on yv.id = hc.id
left join public.youtube_channels yc on yc.id = yv.channel_id
group by yc.name, hc.niche
having count(*) filter (where hc.winner_status <> 'insufficient_data') > 0
order by win_rate desc nulls last;

-- campagne-patronen (niche als campagne-proxy)
create or replace view public.v_campaign_patterns as
select niche as campaign,
       count(*) as total,
       count(*) filter (where winner_status in ('top_5pct','winner')) as winners,
       round((count(*) filter (where winner_status in ('top_5pct','winner'))::numeric
              / nullif(count(*) filter (where winner_status <> 'insufficient_data'),0) * 100), 1) as win_rate
from public.v_hook_classified
group by niche
having count(*) filter (where winner_status <> 'insufficient_data') > 0
order by win_rate desc nulls last;

grant select on public.v_winner_patterns, public.v_loser_patterns, public.v_hook_patterns,
               public.v_thumbnail_patterns, public.v_channel_patterns, public.v_campaign_patterns
to authenticated, anon;
