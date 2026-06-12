-- 197_s5_director_repair.sql
-- AUTONOMOUS GROWTH PHASE 1 — S5 (P1): Director Repair.
--
-- DoD: Hermes kan zelfstandig bepalen: meer produceren / minder / stoppen / opschalen.
--
-- Probleem (geverifieerd live 12-06): director_cycles = 2 rijen (2026-06-02), plan-fase
-- llm_status='error' ("Claude 400: invalid_request_error"). De LLM-plan-call is kapot
-- (model/credits). De verify-fase werkt wél (data-driven).
--
-- Oplossing: CREDIT-VRIJE, data-gedreven director-beslissingen op basis van kanaal-/niche-
-- ranking (uit youtube_video_analytics + v_hook_classified). Geen LLM nodig voor de kern;
-- schrijft een director_cycles plan-rij met llm_status='skipped_data_driven'.
-- Kanaal-metrics komen uit youtube_video_analytics (youtube_channels.views_30d is stale/0).

-- ── 1) Kanaal-ranking (op echte analytics) ──────────────────────────────────
create or replace view public.v_channel_ranking as
with agg as (
  select
    a.channel_id,
    sum(a.views) filter (where a.date >= current_date - 29)                         as views_30d,
    sum(a.views) filter (where a.date >= current_date - 6)                          as views_7d,
    coalesce(sum(a.estimated_revenue) filter (where a.date >= current_date - 29),0) as revenue_30d,
    round(avg(a.ctr) filter (where a.date >= current_date - 29 and a.ctr > 0), 2)   as avg_ctr,
    round(avg(a.avg_view_percentage) filter (where a.date >= current_date - 29 and a.avg_view_percentage > 0), 2) as avg_retention,
    count(*) filter (where a.date >= current_date - 29)                             as datapoints
  from public.youtube_video_analytics a
  group by a.channel_id
),
scored as (
  select
    g.*,
    coalesce(yc.naam, yc.name) as channel_name,
    percent_rank() over (order by g.views_30d)              as pr_views,
    percent_rank() over (order by g.revenue_30d)            as pr_revenue,
    percent_rank() over (order by coalesce(g.avg_ctr, 0))   as pr_ctr,
    case when g.views_30d > 0 then round((coalesce(g.views_7d,0) * 4.3) / g.views_30d, 2) else 0 end as trend_ratio
  from agg g
  join public.youtube_channels yc on yc.id = g.channel_id
)
select
  channel_id, channel_name, views_30d, views_7d, revenue_30d, avg_ctr, avg_retention,
  datapoints, trend_ratio,
  round((0.5*pr_views + 0.3*pr_revenue + 0.2*pr_ctr)::numeric, 4)         as score,
  rank() over (order by (0.5*pr_views + 0.3*pr_revenue + 0.2*pr_ctr) desc) as rank
from scored;

comment on view public.v_channel_ranking is
  'S5: kanaal-ranking (views/revenue/CTR-percentielen + 7d/30d-trend) uit youtube_video_analytics.';

-- ── 2) Niche-ranking (op hook-classificatie) ────────────────────────────────
create or replace view public.v_niche_ranking as
with n as (
  select
    niche,
    count(*)                                                as videos,
    count(*) filter (where winner_status in ('top_5pct','winner')) as winners,
    count(*) filter (where winner_status = 'loser')         as losers,
    sum(views)                                              as views,
    round(avg(ctr)       filter (where ctr > 0), 2)         as avg_ctr,
    round(avg(retention) filter (where retention > 0), 2)   as avg_retention
  from public.v_hook_classified
  where niche is not null
  group by niche
)
select
  niche, videos, winners, losers, views, avg_ctr, avg_retention,
  round(winners::numeric / nullif(winners + losers, 0), 3) as win_rate,
  rank() over (order by winners::numeric / nullif(winners + losers, 0) desc nulls last, views desc) as rank
from n
where (winners + losers) >= 3;

comment on view public.v_niche_ranking is
  'S5: niche-ranking op win-rate (winners/besliste videos) + volume.';

-- ── 3) Director-beslissingen (persistent) ───────────────────────────────────
create table if not exists public.director_decisions (
  id           uuid primary key default gen_random_uuid(),
  channel_id   uuid references public.youtube_channels(id),
  channel_name text,
  period       text not null default 'weekly',
  action       text not null check (action in ('scale_up','maintain','reduce','stop','hold')),
  rank         int,
  score        numeric(6,4),
  trend_ratio  numeric(6,2),
  views_30d    bigint,
  revenue_30d  numeric(12,2),
  rationale    text,
  generated_at timestamptz not null default now(),
  created_at   timestamptz not null default now()
);
create index if not exists idx_dd_period on public.director_decisions(period, generated_at);

comment on table public.director_decisions is
  'S5: per-kanaal director-beslissing (scale_up/maintain/reduce/stop/hold) met onderbouwing.';

-- ── 4) Generator — kanaal-ranking → beslissingen → director_cycles ──────────
create or replace function public.generate_director_decisions(p_period text default 'weekly')
returns jsonb
language plpgsql
as $$
declare
  v_n int;
  v_count int := 0;
  v_summary text;
begin
  select count(*) into v_n from public.v_channel_ranking;

  delete from public.director_decisions
   where period = p_period and generated_at::date = current_date;

  with r as (
    select cr.*, (cr.rank - 1)::numeric / greatest(v_n - 1, 1) as pct
    from public.v_channel_ranking cr
  )
  insert into public.director_decisions
    (channel_id, channel_name, period, action, rank, score, trend_ratio, views_30d, revenue_30d, rationale)
  select
    channel_id, channel_name, p_period,
    case
      when datapoints < 3                                                    then 'hold'
      when pct >= 0.75 and views_30d < 1500 and trend_ratio < 0.5           then 'stop'
      when trend_ratio < 0.30                                               then 'reduce'
      when trend_ratio >= 1.10 and pct <= 0.50                              then 'scale_up'
      when pct <= 0.33                                                      then 'maintain'
      when pct >= 0.55                                                      then 'reduce'
      else 'maintain'
    end,
    rank, score, trend_ratio, coalesce(views_30d,0), revenue_30d,
    format('rank %s/%s · 30d %s views · trend %s · €%s · %s datapunten',
           rank, v_n, coalesce(views_30d,0), trend_ratio, coalesce(revenue_30d,0), datapoints)
  from r;
  get diagnostics v_count = row_count;

  select string_agg(action || ':' || c, ', ' order by action) into v_summary
  from (
    select action, count(*) c
    from public.director_decisions
    where period = p_period and generated_at::date = current_date
    group by action
  ) s;

  insert into public.director_cycles (cycle_date, phase, scope, status_snapshot, summary, execution_plan, llm_status)
  values (
    current_date, 'plan', 'media',
    jsonb_build_object('channels', v_n, 'period', p_period),
    'Director (data-driven, credit-vrij) ' || coalesce(p_period,'') || ': ' || coalesce(v_summary, 'geen beslissingen'),
    (select coalesce(jsonb_agg(jsonb_build_object('channel', channel_name, 'action', action, 'rank', rank) order by rank), '[]'::jsonb)
       from public.director_decisions
       where period = p_period and generated_at::date = current_date),
    'skipped_data_driven'
  );

  return jsonb_build_object('decisions', v_count, 'channels', v_n, 'summary', v_summary);
end;
$$;

comment on function public.generate_director_decisions(text) is
  'S5: credit-vrije director — kanaal-ranking → scale/reduce/stop-beslissingen + director_cycles plan-rij.';

-- ── 5) Consumeerbare view ───────────────────────────────────────────────────
create or replace view public.v_director_decisions_current as
select distinct on (channel_id)
  channel_id, channel_name, period, action, rank, score, trend_ratio, views_30d, revenue_30d, rationale, generated_at
from public.director_decisions
order by channel_id, generated_at desc;

comment on view public.v_director_decisions_current is
  'S5: meest recente director-beslissing per kanaal.';

-- ── 6) Engine Planner ───────────────────────────────────────────────────────
insert into public.engine_schedule (engine_key, grp, label, block_key, enabled) values
  ('content:director-decisions', 'media', 'S5 Director-beslissingen (kanaal-ranking -> scale/reduce/stop)', 'youtube', true)
on conflict (engine_key) do update set enabled = true, updated_at = now();
