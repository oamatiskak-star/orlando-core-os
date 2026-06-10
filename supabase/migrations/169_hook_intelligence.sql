-- 169_hook_intelligence.sql
-- Hook Intelligence Engine — classificeert LEVENDE hooks (youtube_videos.title) in 14
-- psychologische categorieën met echte performance per niche/tijdvenster.
-- ADDITIEF + idempotent, GEEN tabellen/workers/cron → Engine Planner n.v.t.
-- HARDE GATE: niet auto-toepassen — los na review. Geen mock; ontbreekt data → null.
-- Niche via youtube_videos.channel_id → youtube_channels ← media_holding_channels.

create or replace view public.v_hook_classified as
with base as (
  select yv.id, yv.youtube_video_id, yv.title, yv.thumbnail_url,
         coalesce(mh.niche, 'overig') as niche,
         coalesce(yv.views, 0) as views,
         yv.ctr, yv.retention, coalesce(yv.estimated_revenue, yv.revenue) as revenue,
         yv.is_short, yv.duration_seconds,
         coalesce(yv.published_at, yv.created_at) as at
  from public.youtube_videos yv
  join public.media_holding_channels mh on mh.youtube_channel_id = yv.channel_id
  where yv.title is not null and yv.title <> ''
),
classified as (
  select b.*,
    case
      when b.title ~* '€|£|\$|inkomen|income|vermogen|geld|cash|winst|profit|dividend|rendement|return|rente' then 'money'
      when b.title ~* 'guaranteed|gegarandeerd|bewijs|proof|results|resultaat|case study|echte' then 'proof'
      when b.title ~* 'bewezen|proven|strategy|strateg|method|methode|blueprint|framework|system' then 'authority'
      when b.title ~* 'van .* naar|from .* to|word |become |bouw |build |transform|opbouw' then 'transformation'
      when b.title ~* 'in (3|5|7|10|30|60|90)|snel|fast|quick|minuten|seconden|in \\d+ dag' then 'speed'
      when b.title ~* '2026|nu |now|voordat|before|laatste kans|last chance|deadline|nog \\d+' then 'urgency'
      when b.title ~* 'fout|mistake|verlies|lose|crash|gevaar|danger|waarschuw|warning|avoid|vermijd|risk' then 'fear'
      when b.title ~* 'niet |don.?t |stop |nooit|never|against|tegen|niemand vertelt|geen ' then 'contrarian'
      when b.title ~* 'rijk|rich|miljonair|millionaire|elite|wealthy|luxe|vrijheid|freedom' then 'status'
      when b.title ~* 'unlock|ontgrendel|hidden|verborgen|secret|geheim|trick|truc|hack' then 'mystery'
      when b.title ~* 'ik |mijn |my |how i|hoe ik|verhaal|story' then 'story'
      when b.title ~* 'shocking|schok|insane|crazy|unbelievable|ongelofelijk|!{1,}$' then 'shock'
      when b.title ~* '\\?|why|waarom|what|wat |dit |this |revealed|onthuld' then 'curiosity'
      else 'education'
    end as category
  from base b
),
ranked as (
  select c.*,
    round((percent_rank() over (partition by c.niche order by c.views) * 100)::numeric, 0) as views_pct,
    round((percent_rank() over (partition by c.niche order by coalesce(c.ctr,0)) * 100)::numeric, 0) as ctr_pct,
    round((percent_rank() over (partition by c.niche order by coalesce(c.retention,0)) * 100)::numeric, 0) as ret_pct,
    count(*) over (partition by c.niche) as niche_n
  from classified c
)
select
  id, youtube_video_id, title, thumbnail_url, niche, category,
  views, ctr, retention, revenue, is_short, duration_seconds, at,
  -- winner-score = gewogen percentiel (CTR + retentie zwaarder dan pure views)
  round((0.35*coalesce(ctr_pct,0) + 0.35*coalesce(ret_pct,0) + 0.30*coalesce(views_pct,0))::numeric, 0) as hook_score,
  case
    when niche_n < 4 then 'insufficient_data'
    when (0.35*coalesce(ctr_pct,0) + 0.35*coalesce(ret_pct,0) + 0.30*coalesce(views_pct,0)) >= 95 then 'top_5pct'
    when (0.35*coalesce(ctr_pct,0) + 0.35*coalesce(ret_pct,0) + 0.30*coalesce(views_pct,0)) >= 75 then 'winner'
    when (0.35*coalesce(ctr_pct,0) + 0.35*coalesce(ret_pct,0) + 0.30*coalesce(views_pct,0)) >= 50 then 'runner_up'
    when (0.35*coalesce(ctr_pct,0) + 0.35*coalesce(ret_pct,0) + 0.30*coalesce(views_pct,0)) >= 25 then 'underperforming'
    else 'loser'
  end as winner_status,
  -- confidence: hoeveel signalen echt aanwezig zijn
  round(((case when views>0 then 0.34 else 0 end)
       + (case when ctr is not null then 0.33 else 0 end)
       + (case when retention is not null then 0.33 else 0 end))::numeric, 2) as confidence
from ranked;

-- Categorie-performance per niche (voor "waarom wint deze hook?": edge t.o.v. niche-gemiddelde)
create or replace view public.v_hook_category_perf as
select niche, category,
       count(*) as n,
       round(avg(coalesce(ctr,0))::numeric, 2) as avg_ctr,
       round(avg(coalesce(retention,0))::numeric, 2) as avg_retention,
       round(avg(hook_score)::numeric, 0) as avg_hook_score
from public.v_hook_classified
group by niche, category;

grant select on public.v_hook_classified, public.v_hook_category_perf to authenticated, anon;
