-- 210 — Channel Portfolio (hedge-fund-stijl consolidatie)
-- Consolideert bestaande kanaal-analytics tot één portefeuille-beeld met een
-- DETERMINISTISCHE aanbeveling (verdubbel / houd / stop) over ECHTE metrics.
-- Bron-views (bestaan al, niet dupliceren):
--   v_channel_60k_projection  — omzet 30d, projectie, growth_velocity, kans op €60k
--   v_channel_scale_priority  — scale_score, tier, above_scale_threshold, afstand-€60k
--   v_channel_ranking         — rank, trend_ratio, score
--   v_channel_revenue         — omzet today/7d/30d, rpm
--   youtube_channel_health    — health_status (LATEST per kanaal; tabel fan-out!)
-- GEEN per-kanaal kosten beschikbaar (ai_usage heeft geen channel_id) → géén
-- verzonnen cash-runway. "Runway" = velocity-gebaseerde ETA naar €10k/€60k bij
-- de huidige trend (eerlijk null als de trend geen traject geeft).

create or replace view public.v_channel_portfolio as
with health_latest as (
  -- dedup: youtube_channel_health heeft duizenden rijen per kanaal
  select distinct on (channel_id) channel_id, health_status, last_health_check
  from public.youtube_channel_health
  order by channel_id, last_health_check desc nulls last
)
select
  p.channel_id,
  p.channel_name,
  p.niche_fit,
  p.best_program,
  -- omzet & economie (echt)
  p.current_rev_30d::numeric                       as rev_30d,
  p.projected_rev_30d::numeric                     as projected_rev_30d,
  coalesce(rv.revenue_7d, 0)::numeric              as rev_7d,
  coalesce(rv.avg_rpm_30d, p.current_rpm_eur, 0)::numeric as rpm_eur,
  p.current_views_30d::numeric                     as views_30d,
  -- groei (echt)
  p.growth_velocity::numeric                       as growth_velocity,
  coalesce(r.trend_ratio, 0)::numeric              as trend_ratio,
  p.probability_to_60k::numeric                    as probability_to_60k,
  -- scale-positie (echt)
  sp.tier,
  sp.scale_score::numeric                          as scale_score,
  sp.above_scale_threshold,
  sp.distance_to_60k_eur::numeric                  as distance_to_60k_eur,
  sp.expected_rev_30d_eur::numeric                 as expected_rev_30d_eur,
  r.rank                                           as rank,
  hl.health_status,
  -- maandelijkse omzetwinst bij huidige trend (projectie - huidig)
  (p.projected_rev_30d - p.current_rev_30d)::numeric as monthly_gain_eur,
  -- "runway" = velocity-ETA (maanden) naar €10k bij huidige trend; null = geen traject
  case
    when p.current_rev_30d >= 10000 then 0
    when (p.projected_rev_30d - p.current_rev_30d) > 0
      then ceil((10000 - p.current_rev_30d) / (p.projected_rev_30d - p.current_rev_30d))
    else null
  end::numeric                                     as months_to_10k,
  case
    when p.current_rev_30d >= 60000 then 0
    when (p.projected_rev_30d - p.current_rev_30d) > 0
      then ceil(sp.distance_to_60k_eur / (p.projected_rev_30d - p.current_rev_30d))
    else null
  end::numeric                                     as months_to_60k,
  -- DETERMINISTISCHE portfolio-aanbeveling over echte metrics
  case
    when coalesce(sp.scale_score,0) >= 0.40
      or (sp.above_scale_threshold and p.growth_velocity > 0)
      then 'verdubbel'
    when p.growth_velocity <= 0.01
      and coalesce(r.trend_ratio,0) < 0.30
      and p.current_rev_30d < 10
      then 'stop'
    else 'houd'
  end                                              as recommendation,
  -- reden (transparant, geen black box)
  case
    when coalesce(sp.scale_score,0) >= 0.40
      or (sp.above_scale_threshold and p.growth_velocity > 0)
      then 'Boven schaaldrempel / hoge scale-score + groei → kapitaal + aandacht erbij'
    when p.growth_velocity <= 0.01
      and coalesce(r.trend_ratio,0) < 0.30
      and p.current_rev_30d < 10
      then 'Geen groei, dalende trend, ~€0 omzet → snoeien / middelen verschuiven'
    else 'Stabiel maar nog geen winner → vasthouden, meten, niet bijschalen'
  end                                              as recommendation_reason
from public.v_channel_60k_projection p
left join public.v_channel_scale_priority sp on sp.channel_id = p.channel_id
left join public.v_channel_ranking r        on r.channel_id  = p.channel_id
left join public.v_channel_revenue rv       on rv.channel_id = p.channel_id
left join health_latest hl                  on hl.channel_id = p.channel_id;

comment on view public.v_channel_portfolio is
  'Hedge-fund-stijl kanaal-portefeuille: omzet/groei/scale/health + velocity-ETA + deterministische aanbeveling (verdubbel/houd/stop). Bron: bestaande v_channel_* views. Geen per-kanaal kosten → geen verzonnen cash-runway.';

-- Portefeuille-totalen (holding-breed) voor de kapitaal-allocatie-kop
create or replace view public.v_channel_portfolio_summary as
select
  count(*)                                                   as channels,
  count(*) filter (where recommendation = 'verdubbel')       as n_verdubbel,
  count(*) filter (where recommendation = 'houd')            as n_houd,
  count(*) filter (where recommendation = 'stop')            as n_stop,
  round(sum(rev_30d), 2)                                     as total_rev_30d,
  round(sum(projected_rev_30d), 2)                           as total_projected_rev_30d,
  60000::numeric                                             as target_rev_30d,
  round(60000 - sum(rev_30d), 2)                             as gap_to_60k,
  -- echte gelogde AI-burn (ai_usage heeft geen channel_id → alleen holding-totaal)
  (select round(coalesce(sum(cost_usd),0), 2) from public.ai_usage
     where created_at > now() - interval '30 days')          as media_ai_burn_30d_usd
from public.v_channel_portfolio;

comment on view public.v_channel_portfolio_summary is
  'Holding-totalen voor de portfolio-kop: omzet 30d vs €60k-doel, allocatie-tellingen (verdubbel/houd/stop), gelogde AI-burn 30d (holding-breed, niet per kanaal toerekenbaar).';
