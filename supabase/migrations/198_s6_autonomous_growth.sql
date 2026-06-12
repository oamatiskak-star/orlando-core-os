-- 198_s6_autonomous_growth.sql
-- AUTONOMOUS GROWTH PHASE 1 — S6 (P2): Autonomous Growth Mode.
--
-- DoD: Hermes kiest zelfstandig welk kanaal prioriteit krijgt, welke niche wordt
-- uitgebreid en welke niches worden beëindigd.
--
-- Capstone: brengt S1-S5 samen tot autonome prioritering + allocatie.
-- Bouwt op v_channel_ranking + v_niche_ranking + v_director_decisions_current (mig 197).
--
-- Eerlijke kadering: kanalen zijn niet gemonetiseerd → geen geldbudget. "Budget/resource
-- allocation" = PRODUCTIECAPACITEIT (video's/dag) verdelen naar groeiscore. De monetaire
-- budget-laag activeert zodra ad-spend/affiliate-budget bestaat.

-- ── 1) Kanaal-groeiscore (ranking × trend × director-actie) ──────────────────
create or replace view public.v_channel_growth_score as
select
  cr.channel_id, cr.channel_name, cr.views_30d, cr.views_7d, cr.revenue_30d,
  cr.avg_ctr, cr.trend_ratio, cr.rank as ranking, cr.datapoints,
  dd.action as director_action,
  round(least(1.0, greatest(0.0,
      coalesce(cr.score, 0)
      * case when cr.trend_ratio >= 1.10 then 1.25
             when cr.trend_ratio <  0.50 then 0.70
             else 1.0 end
      * case when dd.action = 'scale_up' then 1.30
             when dd.action = 'stop'     then 0.00
             when dd.action = 'reduce'   then 0.60
             else 1.0 end
  ))::numeric, 4) as growth_score
from public.v_channel_ranking cr
left join public.v_director_decisions_current dd on dd.channel_id = cr.channel_id;

comment on view public.v_channel_growth_score is
  'S6: kanaal-groeiscore = ranking × trend-modifier × director-actie-modifier.';

-- ── 2) Niche-scoring: uitbreiden / handhaven / beëindigen ────────────────────
create or replace view public.v_niche_scoring as
select
  niche, videos, winners, losers, views, win_rate, rank,
  case
    when win_rate >= 0.55 and (winners + losers) >= 4 then 'expand'
    when win_rate <= 0.15 and losers >= 4             then 'terminate'
    when win_rate <  0.35                             then 'reduce'
    else 'maintain'
  end as niche_action
from public.v_niche_ranking;

comment on view public.v_niche_scoring is
  'S6: per-niche beslissing expand/maintain/reduce/terminate op win-rate + volume.';

-- ── 3) Capaciteitsallocatie (persistent) ────────────────────────────────────
create table if not exists public.growth_allocations (
  id              uuid primary key default gen_random_uuid(),
  period          text not null default 'weekly',
  channel_id      uuid references public.youtube_channels(id),
  channel_name    text,
  priority_rank   int,
  growth_score    numeric(6,4),
  capacity_share  numeric(5,4),       -- aandeel van de totale productiecapaciteit (0..1)
  videos_per_day  int,
  director_action text,
  generated_at    timestamptz not null default now(),
  created_at      timestamptz not null default now()
);
create index if not exists idx_ga_period on public.growth_allocations(period, generated_at);

comment on table public.growth_allocations is
  'S6: productiecapaciteit-allocatie per kanaal op groeiscore (video''s/dag + aandeel).';

-- ── 4) Groeiplan-generator (credit-vrij) ────────────────────────────────────
create or replace function public.generate_growth_plan(p_total_capacity int default 50, p_period text default 'weekly')
returns jsonb
language plpgsql
as $$
declare
  v_total numeric;
  v_count int := 0;
  v_top   text;
begin
  select sum(growth_score) into v_total from public.v_channel_growth_score where growth_score > 0;
  if v_total is null or v_total = 0 then v_total := 1; end if;

  delete from public.growth_allocations where period = p_period and generated_at::date = current_date;

  insert into public.growth_allocations
    (period, channel_id, channel_name, priority_rank, growth_score, capacity_share, videos_per_day, director_action)
  select
    p_period, channel_id, channel_name,
    rank() over (order by growth_score desc),
    growth_score,
    round((growth_score / v_total)::numeric, 4),
    greatest(0, round(p_total_capacity * growth_score / v_total))::int,
    director_action
  from public.v_channel_growth_score;
  get diagnostics v_count = row_count;

  select channel_name into v_top
  from public.growth_allocations
  where period = p_period and generated_at::date = current_date
  order by priority_rank
  limit 1;

  return jsonb_build_object('allocations', v_count, 'priority_channel', v_top, 'total_capacity', p_total_capacity);
end;
$$;

comment on function public.generate_growth_plan(int,text) is
  'S6: verdeelt productiecapaciteit over kanalen naar groeiscore; bepaalt prioriteitskanaal.';

-- ── 5) Groei-forecast: projectie + afstand tot YPP-mijlpaal ─────────────────
create or replace view public.v_growth_forecast as
select
  cr.channel_id, cr.channel_name, cr.views_30d, cr.views_7d, cr.trend_ratio,
  round(cr.views_7d * 4.33)::bigint                          as projected_views_30d,
  coalesce(yc.subscriber_count, 0)                           as subscribers,
  greatest(0, 1000 - coalesce(yc.subscriber_count, 0))       as subs_to_ypp
from public.v_channel_ranking cr
join public.youtube_channels yc on yc.id = cr.channel_id;

comment on view public.v_growth_forecast is
  'S6: 30d-views-projectie (uit 7d-trend) + afstand tot YPP-drempel (1000 subs).';

-- ── 6) Actueel groeiplan + Engine Planner ───────────────────────────────────
create or replace view public.v_growth_plan_current as
select distinct on (channel_id)
  channel_id, channel_name, period, priority_rank, growth_score, capacity_share,
  videos_per_day, director_action, generated_at
from public.growth_allocations
order by channel_id, generated_at desc;

comment on view public.v_growth_plan_current is 'S6: meest recente capaciteitsallocatie per kanaal.';

insert into public.engine_schedule (engine_key, grp, label, block_key, enabled) values
  ('content:growth-plan', 'media', 'S6 Autonomous growth plan (capaciteitsallocatie + prioritering)', 'youtube', true)
on conflict (engine_key) do update set enabled = true, updated_at = now();
