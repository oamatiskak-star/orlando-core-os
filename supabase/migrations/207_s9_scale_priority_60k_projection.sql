-- 207_s9_scale_priority_60k_projection.sql
-- €60K INHAALSPRINT — Sprint C.1 + D.2 (credit-vrij, alleen DB).
--
-- C.1 v_channel_scale_priority: Hermes bepaalt zelfstandig welk kanaal schaal-waardig is
--     (ROI/monetizability × groeisnelheid × tractie × bewezen omzet) en of het boven de
--     schaaldrempel scoort. Capaciteit mag alleen omhoog op kanalen >= drempel (Sprint D.1).
--
-- D.2 v_channel_60k_projection: per kanaal de exacte weg naar €60k/maand — projectie
--     30/90/180d, ontbrekende views/conversies/uploads, days_to_60k/months_to_60k en een
--     probability-heuristiek. Hermes weet zo welk kanaal het dichtst bij €60k zit.
--
-- Bronnen: v_channel_ranking (views/trend/ctr/revenue), v_channel_revenue_match (rpm_equiv
-- = affiliate-monetizable omzet/1000 views, niche_fit, best_program), youtube_channels
-- (avg_views_per_video), affiliate_conversions (gemiddelde commissie indien aanwezig).

-- ── C.1 — Canonieke kanaalselectie ──────────────────────────────────────────
create or replace view public.v_channel_scale_priority as
with base as (
  select cr.channel_id, cr.channel_name,
         cr.views_30d, cr.views_7d,
         coalesce(cr.revenue_30d, 0)        as revenue_30d,
         coalesce(cr.avg_ctr, 0)            as avg_ctr,
         coalesce(cr.trend_ratio, 1.0)      as growth_velocity,
         coalesce(rm.rpm_equiv, 0)          as rpm_equiv,
         coalesce(rm.expected_rev_30d_eur, 0) as expected_rev_30d_eur,
         rm.niche_fit, rm.best_program, rm.tier
  from public.v_channel_ranking cr
  left join public.v_channel_revenue_match rm on rm.channel_id = cr.channel_id
),
scored as (
  select b.*,
    round(60000 - b.expected_rev_30d_eur, 2) as distance_to_60k_eur,
    round((
        0.30 * least(1.0, b.views_30d / 50000.0)                                   -- tractie (50k/mnd referentie)
      + 0.25 * least(1.0, b.growth_velocity / 1.5) * least(1.0, b.views_30d / 2000.0) -- groei × volume-confidence (dempt micro-kanaal-ruis)
      + 0.25 * least(1.0, b.rpm_equiv / 16.0)                                       -- monetizability (€16 = top-tier)
      + 0.20 * least(1.0, b.revenue_30d / 100.0)                                    -- bewezen omzet (elke echte € telt zwaar)
    )::numeric, 4) as scale_score
  from base b
)
select s.*, (s.scale_score >= 0.35) as above_scale_threshold
from scored s
order by s.scale_score desc;

comment on view public.v_channel_scale_priority is
  'Sprint C.1: per-kanaal scale_score (tractie×groei×monetizability×omzet) + above_scale_threshold. Alleen >= drempel mag schalen.';

-- ── D.2 — €60K Simulator ────────────────────────────────────────────────────
create or replace view public.v_channel_60k_projection as
with base as (
  select cr.channel_id, cr.channel_name,
         cr.views_30d::numeric as views_30d,
         cr.views_7d::numeric  as views_7d,
         coalesce(cr.revenue_30d, 0) as revenue_30d,
         coalesce(cr.trend_ratio, 1.0) as gv,
         greatest(
           coalesce(rm.rpm_equiv, 0),
           case when cr.views_30d > 0 then coalesce(cr.revenue_30d,0) / cr.views_30d * 1000 else 0 end
         ) as eff_rpm,
         rm.niche_fit, rm.best_program,
         coalesce(yc.avg_views_per_video, 0) as avg_views_per_video
  from public.v_channel_ranking cr
  left join public.v_channel_revenue_match rm on rm.channel_id = cr.channel_id
  left join public.youtube_channels yc on yc.id = cr.channel_id
),
params as (
  -- gemiddelde commissie per conversie uit echte data; val terug op research-schatting €8
  select coalesce((select avg(commission_eur) from public.affiliate_conversions where commission_eur > 0), 8.0) as avg_commission_eur
),
proj as (
  select b.*, p.avg_commission_eur,
         -- maandelijkse groeifactor (cap 3x), gedempt door volume-confidence: een trend op
         -- 12 views is ruis -> mfac_eff schuift naar 1.0 zodat projecties eerlijk blijven.
         1.0 + (least(3.0, greatest(0.2, b.gv)) - 1.0) * least(1.0, b.views_30d / 2000.0) as mfac,
         round(b.views_30d / 1000.0 * b.eff_rpm, 2) as current_rev_30d
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
  'Sprint D.2: per-kanaal weg naar €60k/mnd — projectie 30/90/180d, ontbrekende views/conversies/uploads, days/months_to_60k, probability. Credit-vrij.';
