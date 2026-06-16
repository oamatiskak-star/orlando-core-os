-- 211_s13_affiliate_revenue_into_allocation.sql
-- €60K INHAALSPRINT — Sprint (point 3): sluit de keten revenue-event -> Director -> Allocation.
--
-- Gat: v_channel_ranking.revenue_30d = ALLEEN YouTube-ad-revenue (youtube_video_analytics).
-- Affiliate-omzet (monetization_streams) liep niet mee in de allocatie -> "€1 omzet -> meer
-- capaciteit" werkte niet voor affiliate. Deze migratie voegt affiliate-omzet toe aan het
-- revenue-signaal van scale_priority + growth_score + 60k-projectie. Kolomvolgordes ongewijzigd
-- (create-or-replace eis). Id-mapping: monetization_streams.channel_id = media_holding_channels.id;
-- mhc.youtube_channel_id = youtube_channels.id (= v_channel_ranking.channel_id).

create or replace view public.v_channel_affiliate_revenue as
select mhc.youtube_channel_id as channel_id,
       sum(coalesce(ms.monthly_revenue, 0))::numeric as affiliate_revenue
from public.monetization_streams ms
join public.media_holding_channels mhc on mhc.id = ms.channel_id
where coalesce(ms.active, true) and ms.stream_type = 'affiliate'
group by mhc.youtube_channel_id;

comment on view public.v_channel_affiliate_revenue is
  'Sprint pt3: affiliate-omzet per kanaal (monetization_streams -> youtube_channels.id).';

-- ── scale_priority: revenue-term telt nu YT + affiliate ─────────────────────
create or replace view public.v_channel_scale_priority as
with base as (
  select cr.channel_id, cr.channel_name,
         cr.views_30d, cr.views_7d,
         coalesce(cr.revenue_30d, 0)          as revenue_30d,
         coalesce(cr.avg_ctr, 0)              as avg_ctr,
         coalesce(cr.trend_ratio, 1.0)        as growth_velocity,
         coalesce(rm.rpm_equiv, 0)            as rpm_equiv,
         coalesce(rm.expected_rev_30d_eur, 0) as expected_rev_30d_eur,
         rm.niche_fit, rm.best_program, rm.tier,
         coalesce(cr.revenue_30d,0) + coalesce(ar.affiliate_revenue,0) as total_rev
  from public.v_channel_ranking cr
  left join public.v_channel_revenue_match    rm on rm.channel_id = cr.channel_id
  left join public.v_channel_affiliate_revenue ar on ar.channel_id = cr.channel_id
),
scored as (
  select b.*,
    round(60000 - b.expected_rev_30d_eur, 2) as distance_to_60k_eur,
    round((
        0.30 * least(1.0, b.views_30d / 50000.0)
      + 0.25 * least(1.0, b.growth_velocity / 1.5) * least(1.0, b.views_30d / 2000.0)
      + 0.25 * least(1.0, b.rpm_equiv / 16.0)
      + 0.20 * least(1.0, b.total_rev / 100.0)
    )::numeric, 4) as scale_score
  from base b
)
select s.channel_id, s.channel_name, s.views_30d, s.views_7d, s.revenue_30d, s.avg_ctr,
       s.growth_velocity, s.rpm_equiv, s.expected_rev_30d_eur, s.niche_fit, s.best_program,
       s.tier, s.distance_to_60k_eur, s.scale_score, (s.scale_score >= 0.35) as above_scale_threshold
from scored s
order by s.scale_score desc;

comment on view public.v_channel_scale_priority is
  'Sprint C.1+pt3: scale_score (tractie×groei×monetizability×TOTALE omzet incl. affiliate) + drempel.';

-- ── growth_score: revenue_weight/alloc_score tellen nu YT + affiliate ───────
create or replace view public.v_channel_growth_score as
with ar as (
  select channel_id, affiliate_revenue from public.v_channel_affiliate_revenue
),
g as (
  select
    cr.channel_id, cr.channel_name, cr.views_30d, cr.views_7d, cr.revenue_30d,
    cr.avg_ctr, cr.trend_ratio, cr.rank as ranking, cr.datapoints,
    dd.action as director_action,
    round(least(1.0, greatest(0.0,
        coalesce(cr.score, 0)
        * case when cr.trend_ratio >= 1.10 then 1.25 when cr.trend_ratio < 0.50 then 0.70 else 1.0 end
        * case when dd.action = 'scale_up' then 1.30 when dd.action = 'stop' then 0.00
               when dd.action = 'reduce' then 0.60 else 1.0 end
    ))::numeric, 4) as growth_score,
    coalesce(sp.rpm_equiv, 0)                 as rpm_equiv,
    coalesce(sp.above_scale_threshold, false) as above_scale_threshold,
    round((
        1.0
      + least(2.0, (coalesce(cr.revenue_30d,0) + coalesce(ar.affiliate_revenue,0)) / 10.0)
      + least(0.6, coalesce(sp.rpm_equiv,0) / 16.0 * 0.6)
    )::numeric, 4) as revenue_weight,
    round((
        round(least(1.0, greatest(0.0,
          coalesce(cr.score, 0)
          * case when cr.trend_ratio >= 1.10 then 1.25 when cr.trend_ratio < 0.50 then 0.70 else 1.0 end
          * case when dd.action = 'scale_up' then 1.30 when dd.action = 'stop' then 0.00
                 when dd.action = 'reduce' then 0.60 else 1.0 end
        ))::numeric, 4)
      * ( 1.0 + least(2.0, (coalesce(cr.revenue_30d,0)+coalesce(ar.affiliate_revenue,0))/10.0)
              + least(0.6, coalesce(sp.rpm_equiv,0)/16.0*0.6) )
      * case when coalesce(sp.above_scale_threshold,false) then 1.0 else 0.6 end
    )::numeric, 4) as alloc_score
  from public.v_channel_ranking cr
  left join public.v_director_decisions_current dd on dd.channel_id = cr.channel_id
  left join public.v_channel_scale_priority     sp on sp.channel_id = cr.channel_id
  left join ar on ar.channel_id = cr.channel_id
)
select * from g;

comment on view public.v_channel_growth_score is
  'S6+D.1+pt3: alloc_score = groei × revenue_weight(incl. affiliate) × scale-threshold. Revenue-first incl. affiliate-omzet.';

-- ── 60k-projectie: huidige omzet telt affiliate mee ─────────────────────────
create or replace view public.v_channel_60k_projection as
with base as (
  select cr.channel_id, cr.channel_name,
         cr.views_30d::numeric as views_30d,
         cr.views_7d::numeric  as views_7d,
         coalesce(cr.revenue_30d, 0) as revenue_30d,
         coalesce(ar.affiliate_revenue, 0) as affiliate_revenue,
         coalesce(cr.trend_ratio, 1.0) as gv,
         greatest(
           coalesce(rm.rpm_equiv, 0),
           case when cr.views_30d > 0 then coalesce(cr.revenue_30d,0) / cr.views_30d * 1000 else 0 end
         ) as eff_rpm,
         rm.niche_fit, rm.best_program,
         coalesce(yc.avg_views_per_video, 0) as avg_views_per_video
  from public.v_channel_ranking cr
  left join public.v_channel_revenue_match     rm on rm.channel_id = cr.channel_id
  left join public.v_channel_affiliate_revenue ar on ar.channel_id = cr.channel_id
  left join public.youtube_channels yc on yc.id = cr.channel_id
),
params as (
  select coalesce((select avg(commission_eur) from public.affiliate_conversions where commission_eur > 0), 8.0) as avg_commission_eur
),
proj as (
  select b.*, p.avg_commission_eur,
         1.0 + (least(3.0, greatest(0.2, b.gv)) - 1.0) * least(1.0, b.views_30d / 2000.0) as mfac,
         round(b.views_30d / 1000.0 * b.eff_rpm + b.affiliate_revenue, 2) as current_rev_30d
  from base b cross join params p
)
select
  p.channel_id, p.channel_name, p.niche_fit, p.best_program,
  round(p.views_30d)            as current_views_30d,
  round(p.eff_rpm, 2)           as current_rpm_eur,
  round(p.gv, 3)                as growth_velocity,
  p.current_rev_30d,
  round(p.current_rev_30d * p.mfac, 2)          as projected_rev_30d,
  round(p.current_rev_30d * power(p.mfac, 3), 2) as projected_rev_90d,
  round(p.current_rev_30d * power(p.mfac, 6), 2) as projected_rev_180d,
  case when p.eff_rpm > 0 then round(60000.0 / p.eff_rpm * 1000) end                                as views_needed_60k,
  case when p.eff_rpm > 0 then greatest(0, round(60000.0 / p.eff_rpm * 1000 - p.views_30d)) end      as views_gap_60k,
  case when p.avg_commission_eur > 0 then ceil(60000.0 / p.avg_commission_eur) end                   as conversions_needed_60k,
  case when p.eff_rpm > 0 and p.avg_views_per_video > 0
       then ceil( greatest(0, 60000.0 / p.eff_rpm * 1000 - p.views_30d) / p.avg_views_per_video / 30.0)
       end                                                                                            as uploads_per_day_needed_60k,
  case when p.mfac > 1.0 and p.current_rev_30d > 0
       then round( ln(60000.0 / p.current_rev_30d) / ln(p.mfac), 1) end                              as months_to_60k,
  case when p.mfac > 1.0 and p.current_rev_30d > 0
       then round( ln(60000.0 / p.current_rev_30d) / ln(p.mfac) * 30, 0) end                         as days_to_60k,
  round(least(1.0, greatest(0.0,
      0.4 * least(1.0, (p.mfac - 1.0) / 0.5)
    + 0.3 * least(1.0, p.eff_rpm / 16.0)
    + 0.3 * least(1.0, p.views_30d / 50000.0)
  ))::numeric, 3) as probability_to_60k
from proj p
order by probability_to_60k desc nulls last, current_rev_30d desc;

comment on view public.v_channel_60k_projection is
  'Sprint D.2+pt3: 60k-projectie met huidige omzet incl. affiliate (monetization_streams).';
