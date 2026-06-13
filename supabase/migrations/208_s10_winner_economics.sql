-- 208_s10_winner_economics.sql
-- €60K INHAALSPRINT — Sprint C.2: Winner Economics. Niet de meeste views winnen, maar de
-- meeste euro's. Per winner: views/CTR/retention/EPC/RPM + revenue/video + revenue/1000 views
-- + growth velocity -> economic_winner_score. Winner-replicatie schaalt voortaan alleen
-- agressief op winners met POSITIEVE economische score.
--
-- Databron-kalibratie (live 13-06): CTR=0 (analytics-detail ontbreekt nog → externe/data-gap),
-- retention op 0-100-schaal, YT-revenue=0 (geen YPP). De economische waarde wordt daarom
-- gedragen door kanaal-monetizability (rpm_equiv via niche/affiliate) × retention × hook.
-- revenue_per_1k ≈ rpm_equiv zolang er nog geen echte omzet is; zodra affiliate/YPP omzet
-- binnenkomt schuift de score vanzelf naar bewezen euro's.

create or replace view public.v_winner_economics as
with w as (
  select wi.id, wi.youtube_video_id, wi.title, wi.channel, wi.niche, wi.category,
         wi.winner_status, wi.views, coalesce(wi.ctr,0) as ctr,
         coalesce(wi.retention,0) as retention, coalesce(wi.hook_score,0) as hook_score,
         coalesce(wi.revenue,0) as revenue
  from public.v_winner_intelligence wi
),
ch as (
  select w.*,
         coalesce(rm.rpm_equiv,0) as rpm_equiv,
         rm.niche_fit, rm.best_program,
         coalesce(sp.growth_velocity,1.0) as growth_velocity,
         (select ap.avg_epc from public.affiliate_programs ap where ap.name = rm.best_program limit 1) as affiliate_epc
  from w
  left join public.v_channel_revenue_match  rm on rm.channel_name = w.channel
  left join public.v_channel_scale_priority sp on sp.channel_name = w.channel
),
calc as (
  select c.*,
    -- omzet per video = echte omzet + geschatte affiliate (views/1000 × rpm_equiv)
    round(c.revenue + c.views/1000.0 * c.rpm_equiv, 2) as revenue_per_video,
    -- omzet per 1000 views (≈ rpm_equiv zolang revenue 0 is)
    round(case when c.views > 0 then (c.revenue + c.views/1000.0 * c.rpm_equiv) / c.views * 1000 else c.rpm_equiv end, 2) as revenue_per_1k
  from ch c
)
select c.*,
  round(least(1.0, greatest(0.0,
      0.35 * least(1.0, c.revenue_per_1k / 16.0)   -- euro's per 1000 views (monetizability/bewezen)
    + 0.20 * least(1.0, c.ctr / 0.08)              -- CTR (8% = top); 0 nu = analytics-gap
    + 0.25 * least(1.0, c.retention / 70.0)        -- retention (0-100-schaal)
    + 0.15 * least(1.0, c.hook_score / 100.0)      -- hook-kracht
    + 0.05 * least(1.0, c.views / 5000.0)          -- kleine tractie-nudge (winners zijn low-view)
  ))::numeric, 4) as economic_winner_score,
  ( (0.35 * least(1.0, c.revenue_per_1k / 16.0)
    + 0.20 * least(1.0, c.ctr / 0.08)
    + 0.25 * least(1.0, c.retention / 70.0)
    + 0.15 * least(1.0, c.hook_score / 100.0)
    + 0.05 * least(1.0, c.views / 5000.0)) >= 0.45
    and c.revenue_per_1k > 0 ) as positive_economic
from calc c
order by economic_winner_score desc;

comment on view public.v_winner_economics is
  'Sprint C.2: per-winner economic_winner_score (euros: rpm/rev_per_1k × retention × hook × ctr) + positive_economic. Replicatie schaalt alleen positieve scores.';

-- ── Winner-replicatie wordt euro-gedreven ───────────────────────────────────
-- Alleen winners met positieve economische score worden gerepliceerd, gesorteerd op
-- economic_winner_score (niet langer puur op hook/views). Rest van de keten ongewijzigd.
create or replace function public.replicate_winners(
  p_max int default 5,
  p_cooldown_days int default 14
)
returns jsonb
language plpgsql
as $$
declare
  v_horizon int := 0;
  v_jobs    int := 0;
begin
  with cand as (
    select wi.id as winner_id, wi.title, wi.niche, wi.category, wi.hook_score, wi.views,
           yv.channel_id as yt_channel_id, we.economic_winner_score
    from public.v_winner_intelligence wi
    join public.youtube_videos yv on yv.id = wi.id
    join public.v_winner_economics we on we.id = wi.id
    where wi.winner_status in ('top_5pct','winner')
      and we.positive_economic                         -- euro-gate (Sprint C.2)
      and not exists (
        select 1 from public.cf2_jobs j
        where j.source_winner_video_id = wi.id
          and j.created_at > now() - make_interval(days => p_cooldown_days))
      and not exists (
        select 1 from public.content_horizon h
        where h.source_winner_video_id = wi.id and h.status in ('planned','producing'))
    order by we.economic_winner_score desc nulls last, wi.hook_score desc nulls last, wi.views desc nulls last
    limit greatest(p_max, 0)
  ), ins as (
    insert into public.content_horizon
      (niche, status, channel_id, confidence, title_draft, bron_hook_category,
       reason, planned_publish_at, source_winner_video_id, buffer_hours)
    select
      c.niche, 'planned', mhc.id, coalesce(c.hook_score, 0),
      c.title, c.category,
      'Winner-replicatie (auto, econ '||round(coalesce(c.economic_winner_score,0),2)||'): '||coalesce(left(c.title,60),'winner')||' · hook '||coalesce(c.category,'?'),
      now() + interval '48 hours', c.winner_id, 48
    from cand c
    left join public.media_holding_channels mhc on mhc.youtube_channel_id = c.yt_channel_id
    returning 1
  )
  select count(*) into v_horizon from ins;

  select public.cf2_seed_jobs_from_horizon() into v_jobs;

  return jsonb_build_object('winners_planned', v_horizon, 'jobs_seeded', v_jobs);
end;
$$;

comment on function public.replicate_winners(int,int) is
  'S3+C.2: repliceert alleen winners met positieve economic_winner_score (euro-gate), gesorteerd op economische score. Credit-vrij; creatie via CF2-producer.';
