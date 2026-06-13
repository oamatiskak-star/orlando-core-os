-- 214 — CEO-OS media-omzet-laag (additief)
-- v_ceo_revenue_position telt total_actual uit account_revenues; media-omzet (affiliate +
-- YouTube) staat daar NIET in. In plaats van die view te muteren (double-count-risico),
-- voegen we een APARTE rollup toe die media-omzet expliciet surfacet voor de CEO-OS laag.
-- Vandaag €0 (conversie-pijplijn nog niet live — CLI-L L2); de view is klaar zodra euro's stromen.

create or replace view public.v_ceo_media_revenue as
select
  (select round(coalesce(sum(confirmed_commission_eur),0),2) from public.affiliate_performance) as affiliate_confirmed_eur,
  (select round(coalesce(sum(pending_commission_eur),0),2)   from public.affiliate_performance) as affiliate_pending_eur,
  (select round(coalesce(sum(revenue_30d),0),2)              from public.v_channel_revenue)     as youtube_est_30d_eur,
  (select round(coalesce(sum(revenue),0),2)                  from public.v_attribution_niche)   as niche_attributed_eur,
  (select count(*) from public.affiliate_conversions where status in ('confirmed','approved')) as confirmed_conversions,
  (select count(*) from public.v_winner_economics where positive_economic)                     as positive_economic_winners,
  -- totaal media-omzet (bevestigde affiliate + geschatte YouTube 30d) — bewust apart van
  -- v_ceo_revenue_position.total_actual (account_revenues) om dubbeltelling te vermijden.
  round(
    coalesce((select sum(confirmed_commission_eur) from public.affiliate_performance),0)
    + coalesce((select sum(revenue_30d) from public.v_channel_revenue),0)
  , 2) as media_total_30d_eur;

comment on view public.v_ceo_media_revenue is
  'CEO-OS media-omzet-laag (additief): bevestigde/pending affiliate + geschatte YouTube-omzet 30d + niche-attributie. Apart van v_ceo_revenue_position (account_revenues) tegen dubbeltelling.';
