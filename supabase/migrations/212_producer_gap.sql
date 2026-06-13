-- 212 — Producer Gap (plan ↔ produce zichtbaarheid)
-- Maakt de productie-trechter meetbaar: gepland (content_factory orchestrator_tasks)
-- → cf2_jobs aangemaakt → cf2 voltooid → video_projects → live. De brug
-- (content_factory -> cf2_jobs) ontbreekt, waardoor 1600+ plannen nooit productie worden.
-- CLI-R levert ZICHTBAARHEID + een READ-ONLY brug-kandidaat-selector (propose-only).
-- De daadwerkelijke enqueue + state-sync gebeurt door de gated cf2-producer at runtime
-- (Engine 'content:cf2-video-projects-runner', CLI-L lane L1) — niet hier, om de live
-- producer-pijplijn niet te breken.

-- ── trechter-totalen (één rij) ──────────────────────────────────────────────
create or replace view public.v_producer_gap as
with plan as (
  select
    count(*) filter (where status = 'open')                              as plan_open,
    count(*) filter (where status = 'completed')                         as plan_done,
    count(*) filter (where status = 'failed')                            as plan_failed
  from public.orchestrator_tasks
  where executor = 'content_factory'
),
cf2 as (
  select
    count(*)                                                             as cf2_total,
    count(*) filter (where status = 'planned')                          as cf2_planned,
    count(*) filter (where status = 'cancelled')                        as cf2_cancelled,
    count(*) filter (where status not in ('planned','cancelled','failed')) as cf2_advanced
  from public.cf2_jobs
),
vp as (
  select
    count(*)                                                            as vp_total,
    count(*) filter (where status in ('production_ready','quality_checked')) as vp_ready,
    count(*) filter (where status = 'rework_required')                  as vp_rework,
    count(*) filter (where status in ('published','live','uploaded'))   as vp_live,
    count(*) filter (where approved is true)                            as vp_approved
  from public.video_projects
)
select
  plan.plan_open, plan.plan_done, plan.plan_failed,
  cf2.cf2_total, cf2.cf2_planned, cf2.cf2_cancelled, cf2.cf2_advanced,
  vp.vp_total, vp.vp_ready, vp.vp_rework, vp.vp_live, vp.vp_approved,
  -- het gat: open plannen die nog geen cf2-job hebben opgeleverd
  greatest(0, plan.plan_open)                                          as bridge_backlog,
  -- conversie-ratio's (echt; 0 = lek)
  round(case when plan.plan_open + plan.plan_done > 0
        then cf2.cf2_total::numeric / (plan.plan_open + plan.plan_done) else 0 end, 4) as plan_to_cf2_ratio,
  round(case when cf2.cf2_total > 0
        then vp.vp_total::numeric / cf2.cf2_total else 0 end, 4)       as cf2_to_vp_ratio,
  round(case when vp.vp_total > 0
        then vp.vp_live::numeric / vp.vp_total else 0 end, 4)          as vp_to_live_ratio
from plan, cf2, vp;

comment on view public.v_producer_gap is
  'Productie-trechter: content_factory-plannen -> cf2_jobs -> video_projects -> live, met conversie-ratios. 0-ratio = lek. bridge_backlog = open plannen zonder productie.';

-- ── per dag (laatste 14 dagen) ──────────────────────────────────────────────
create or replace view public.v_producer_gap_daily as
with days as (
  select generate_series((current_date - interval '13 days')::date, current_date, interval '1 day')::date as d
)
select
  days.d as day,
  (select count(*) from public.orchestrator_tasks o
     where o.executor='content_factory' and o.created_at::date = days.d)             as planned,
  (select count(*) from public.cf2_jobs c where c.created_at::date = days.d)          as cf2_created,
  (select count(*) from public.video_projects v where v.created_at::date = days.d)    as vp_created
from days
order by days.d;

comment on view public.v_producer_gap_daily is
  'Dagelijkse productie-doorzet (14d): plannen vs cf2-jobs vs video_projects aangemaakt.';

-- ── per kanaal (productie-zijde) ────────────────────────────────────────────
create or replace view public.v_producer_gap_by_channel as
select
  ch.id                                                              as channel_id,
  coalesce(ch.naam, ch.name)                                         as channel_name,
  (select count(*) from public.cf2_jobs c
     where coalesce(c.bron_channel_id, c.bron_strategy_channel_id) = ch.id)  as cf2_jobs,
  (select count(*) from public.video_projects v where v.channel_id = ch.id)  as video_projects,
  (select count(*) from public.video_projects v
     where v.channel_id = ch.id and v.status='rework_required')      as vp_rework,
  (select count(*) from public.video_projects v
     where v.channel_id = ch.id and v.status in ('published','live','uploaded')) as vp_live
from public.youtube_channels ch
order by cf2_jobs desc, video_projects desc;

comment on view public.v_producer_gap_by_channel is
  'Productie per kanaal: cf2-jobs vs video_projects vs rework vs live.';

-- ── READ-ONLY brug-kandidaten (propose-only) ────────────────────────────────
-- Geeft de eerstvolgende open content_factory-plannen die kandidaat zijn om te
-- bruggen naar cf2_jobs. SCHRIJFT NIETS — de enqueue is runtime (cf2-producer/L1).
create or replace function public.producer_bridge_candidates(p_limit integer default 25)
returns table (
  task_id    uuid,
  title      text,
  task_type  text,
  niche      text,
  channel_id uuid,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    o.id,
    o.title,
    o.task_type,
    nullif(o.payload->>'niche','')                          as niche,
    (nullif(o.payload->>'channel_id',''))::uuid             as channel_id,
    o.created_at
  from public.orchestrator_tasks o
  where o.executor = 'content_factory'
    and o.status = 'open'
  order by o.priority desc nulls last, o.created_at asc
  limit greatest(1, least(p_limit, 200));
$$;

grant execute on function public.producer_bridge_candidates(integer) to authenticated, service_role;
