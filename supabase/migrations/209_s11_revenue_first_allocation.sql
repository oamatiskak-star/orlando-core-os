-- 209_s11_revenue_first_allocation.sql
-- €60K INHAALSPRINT — Sprint D.1: Revenue-first allocatie.
--
-- Growth stuurt niet langer alleen op views/watchtime/uploads, maar OOK op affiliate-RPM
-- (rpm_equiv), affiliate-EPC, conversie en bewezen omzet (revenue/channel). Regel:
--   €1 omzet -> meer capaciteit ; geen omzet -> minder capaciteit.
-- Gekoppeld aan v_channel_scale_priority: kanalen onder de schaaldrempel krijgen minder
-- capaciteit (damp 0.6), niet nul (director 'stop' = nul blijft via director_mod).
--
-- Implementatie: v_channel_growth_score krijgt een revenue_weight + alloc_score; de plan-
-- generator verdeelt productiecapaciteit op alloc_score i.p.v. de kale groeiscore.
-- Credit-vrij. Zodra affiliate/YPP-omzet binnenkomt domineert bewezen omzet automatisch.

-- LET OP: kolomvolgorde 1-11 identiek aan de bestaande view (create-or-replace eis);
-- nieuwe kolommen (rpm_equiv, above_scale_threshold, revenue_weight, alloc_score) achteraan.
create or replace view public.v_channel_growth_score as
with g as (
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
    ))::numeric, 4) as growth_score,
    coalesce(sp.rpm_equiv, 0)                         as rpm_equiv,
    coalesce(sp.above_scale_threshold, false)         as above_scale_threshold
  from public.v_channel_ranking cr
  left join public.v_director_decisions_current dd on dd.channel_id = cr.channel_id
  left join public.v_channel_scale_priority    sp on sp.channel_id = cr.channel_id
)
select g.*,
  -- revenue-first gewicht: bewezen omzet domineert; bij €0 tilt rpm_equiv naar monetizable niches
  round((
      1.0
    + least(2.0, coalesce(g.revenue_30d, 0) / 10.0)     -- €10/30d → +1.0 (cap +2.0): échte euro's wegen zwaarst
    + least(0.6, coalesce(g.rpm_equiv, 0) / 16.0 * 0.6) -- monetizability-potentieel (max +0.6)
  )::numeric, 4) as revenue_weight,
  round((
      g.growth_score
    * ( 1.0 + least(2.0, coalesce(g.revenue_30d,0)/10.0) + least(0.6, coalesce(g.rpm_equiv,0)/16.0*0.6) )
    * case when g.above_scale_threshold then 1.0 else 0.6 end   -- onder schaaldrempel: minder capaciteit
  )::numeric, 4) as alloc_score
from g;

comment on view public.v_channel_growth_score is
  'S6+D.1: groeiscore × revenue_weight × scale-threshold = alloc_score (revenue-first capaciteitsverdeling).';

-- Plan-generator verdeelt nu op alloc_score (revenue-first) i.p.v. de kale groeiscore.
create or replace function public.generate_growth_plan(p_total_capacity int default 50, p_period text default 'weekly')
returns jsonb
language plpgsql
as $$
declare
  v_total numeric;
  v_count int := 0;
  v_top   text;
begin
  select sum(alloc_score) into v_total from public.v_channel_growth_score where alloc_score > 0;
  if v_total is null or v_total = 0 then v_total := 1; end if;

  delete from public.growth_allocations where period = p_period and generated_at::date = current_date;

  insert into public.growth_allocations
    (period, channel_id, channel_name, priority_rank, growth_score, capacity_share, videos_per_day, director_action)
  select
    p_period, channel_id, channel_name,
    rank() over (order by alloc_score desc),
    alloc_score,
    round((alloc_score / v_total)::numeric, 4),
    greatest(0, round(p_total_capacity * alloc_score / v_total))::int,
    director_action
  from public.v_channel_growth_score;
  get diagnostics v_count = row_count;

  select channel_name into v_top
  from public.growth_allocations
  where period = p_period and generated_at::date = current_date
  order by priority_rank
  limit 1;

  return jsonb_build_object('allocations', v_count, 'priority_channel', v_top, 'total_capacity', p_total_capacity, 'basis', 'revenue_first_alloc_score');
end;
$$;

comment on function public.generate_growth_plan(int,text) is
  'S6+D.1: verdeelt productiecapaciteit op alloc_score (groei × revenue_weight × scale-threshold). Revenue-first; credit-vrij.';
