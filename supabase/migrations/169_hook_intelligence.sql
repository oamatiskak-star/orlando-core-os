-- 169_hook_intelligence.sql
-- Hook Intelligence Engine — classificeert LEVENDE hooks (youtube_videos.title) in 14
-- psychologische categorieën met echte performance per niche/tijdvenster.
-- ADDITIEF + idempotent, GEEN tabellen/workers/cron → Engine Planner n.v.t.
-- HARDE GATE: niet auto-toepassen — los na review. Geen mock; ontbreekt data → null.
-- Performance uit youtube_video_analytics (youtube_videos.views is grotendeels 0).
-- Retentie geclampt op 0..100 (analytics bevat onzin-waarden >100). Views-dominant
-- (groeifase-prioriteit). Winner-status = percentiel ONDER presterende video's (views>0)
-- per niche → de echte top komt naar boven; non-performers = insufficient_data.
-- TOEGEPAST OP PROD 2026-06-10 (deze definitieve versie).

create or replace view public.v_hook_classified as
with yt_an as (
  select distinct on (video_id)
         video_id, views as an_views, ctr as an_ctr, avg_view_percentage as an_ret, estimated_revenue as an_rev
  from public.youtube_video_analytics where video_id is not null
  order by video_id, recorded_at desc
),
base as (
  select yv.id, yv.youtube_video_id, yv.title, yv.thumbnail_url,
         coalesce(mh.niche, 'overig') as niche,
         coalesce(an.an_views, yv.views, 0) as views,
         coalesce(an.an_ctr, yv.ctr) as ctr,
         least(greatest(coalesce(an.an_ret, yv.retention), 0), 100)::numeric as retention,
         coalesce(an.an_rev, yv.estimated_revenue, yv.revenue)::numeric as revenue,
         yv.is_short, yv.duration_seconds,
         coalesce(yv.published_at, yv.created_at) as at
  from public.youtube_videos yv
  join public.media_holding_channels mh on mh.youtube_channel_id = yv.channel_id
  left join yt_an an on an.video_id = yv.id
  where yv.title is not null and yv.title <> ''
),
classified as (
  select b.*,
    case
      when b.title ~* '€|£|\$|inkomen|income|vermogen|geld|cash|winst|profit|dividend|rendement|return|rente' then 'money'
      when b.title ~* 'guaranteed|gegarandeerd|bewijs|proof|results|resultaat|case study|echte' then 'proof'
      when b.title ~* 'bewezen|proven|strategy|strateg|method|methode|blueprint|framework|system' then 'authority'
      when b.title ~* 'van .* naar|from .* to|word |become |bouw |build |transform|opbouw' then 'transformation'
      when b.title ~* 'in (3|5|7|10|30|60|90)|snel|fast|quick|minuten|seconden|in \d+ dag' then 'speed'
      when b.title ~* '2026|nu |now|voordat|before|laatste kans|last chance|deadline|nog \d+' then 'urgency'
      when b.title ~* 'fout|mistake|verlies|lose|crash|gevaar|danger|waarschuw|warning|avoid|vermijd|risk' then 'fear'
      when b.title ~* 'niet |don.?t |stop |nooit|never|against|tegen|niemand vertelt|geen ' then 'contrarian'
      when b.title ~* 'rijk|rich|miljonair|millionaire|elite|wealthy|luxe|vrijheid|freedom' then 'status'
      when b.title ~* 'unlock|ontgrendel|hidden|verborgen|secret|geheim|trick|truc|hack' then 'mystery'
      when b.title ~* 'ik |mijn |my |how i|hoe ik|verhaal|story' then 'story'
      when b.title ~* 'shocking|schok|insane|crazy|unbelievable|ongelofelijk|!{1,}$' then 'shock'
      when b.title ~* '\?|why|waarom|what|wat |dit |this |revealed|onthuld' then 'curiosity'
      else 'education'
    end as category
  from base b
),
perf as (
  -- rangschik ALLEEN onder presterende video's (echte views/ctr) per niche; views-dominant
  select id,
    count(*) over (partition by niche) as perf_n,
    round((percent_rank() over (partition by niche
      order by (ln(coalesce(views,0)+1)*10 + coalesce(ctr,0)*3 + coalesce(retention,0)*0.1)) * 100)::numeric, 0) as hs
  from classified
  where views > 0 or ctr is not null
)
select
  c.id, c.youtube_video_id, c.title, c.thumbnail_url, c.niche, c.category,
  c.views, c.ctr, c.retention, c.revenue, c.is_short, c.duration_seconds, c.at,
  coalesce(p.hs, 0) as hook_score,
  case
    when p.id is null or p.perf_n < 4 then 'insufficient_data'
    when p.hs >= 95 then 'top_5pct'
    when p.hs >= 80 then 'winner'
    when p.hs >= 50 then 'runner_up'
    when p.hs >= 25 then 'underperforming'
    else 'loser'
  end as winner_status,
  round(((case when c.views>0 then 0.34 else 0 end)
       + (case when c.ctr is not null then 0.33 else 0 end)
       + (case when c.retention is not null then 0.33 else 0 end))::numeric, 2) as confidence
from classified c
left join perf p on p.id = c.id;

create or replace view public.v_hook_category_perf as
select niche, category, count(*) as n,
       round(avg(coalesce(ctr,0))::numeric, 2) as avg_ctr,
       round(avg(coalesce(retention,0))::numeric, 2) as avg_retention,
       round(avg(hook_score)::numeric, 0) as avg_hook_score
from public.v_hook_classified group by niche, category;

grant select on public.v_hook_classified, public.v_hook_category_perf to authenticated, anon;
