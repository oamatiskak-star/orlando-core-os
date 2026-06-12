-- 200_affiliate_tier_ranking.sql
-- AFFILIATE ACTIVATION PHASE — tier-ranking + entity revenue-layers + data-enrichment.
--
-- Doel: de affiliate-asset-laag operationeel maken — Hermes weet exact welke programma's
-- de hoogste verwachte omzet per bezoeker hebben, per entity (Aquier / Media Factory).
-- Additief op affiliate_programs (registry). Geen losse systemen.

alter table public.affiliate_programs add column if not exists cookie_days int;
alter table public.affiliate_programs add column if not exists postback_available boolean;
alter table public.affiliate_programs add column if not exists tier int;
alter table public.affiliate_programs add column if not exists revenue_potential numeric(8,3);
alter table public.affiliate_programs add column if not exists aquier_relevant boolean default false;
alter table public.affiliate_programs add column if not exists media_relevant boolean default false;

comment on column public.affiliate_programs.revenue_potential is
  'AFFILIATE ACTIVATION: verwachte omzet/bezoeker = EPC × recurring-mult × fit-weight.';

-- Ranking-functie: revenue_potential + tier + entity-relevantie (credit-vrij)
create or replace function public.rank_affiliate_programs()
returns integer language plpgsql as $$
declare v_count int := 0;
begin
  update public.affiliate_programs p set
    revenue_potential = round((
        coalesce(p.avg_epc, 0)
        * (case when p.recurring then 1.6 else 1.0 end)
        * (0.6 + coalesce(p.audience_fit_score, 50) / 250.0)
      )::numeric, 3),
    aquier_relevant = (
        p.category in ('finance_crypto','vastgoed_data','affiliate_network')
        or p.name ~* 'hubspot|semrush|salesforce|crm|pipedrive|fundrise|roofstock|mashvisor|interactive brokers|tradingview|robinhood|m1 finance|clickfunnels'
      ) and p.category <> 'other',
    media_relevant = (
        p.category in ('saas_ai','finance_crypto','affiliate_network')
        or p.name ~* 'tubebuddy|vidiq|jasper|surfer|canva|notion|adobe|shopify|webflow|clickfunnels|semrush|hubspot'
      ) and p.category <> 'other';
  update public.affiliate_programs p set
    tier = case when coalesce(revenue_potential,0) >= 2.0 then 1
                when coalesce(revenue_potential,0) >= 1.0 then 2
                else 3 end;
  get diagnostics v_count = row_count;
  return v_count;
end; $$;

comment on function public.rank_affiliate_programs() is
  'AFFILIATE ACTIVATION: (her)berekent revenue_potential, tier en entity-relevantie voor alle programma''s.';

-- Entity revenue-layers
create or replace view public.v_affiliate_top_aquier as
select name, category, tier, revenue_potential, avg_epc, audience_fit_score as fit,
       payout_model, recurring, cookie_days, account_status, country_availability
from public.affiliate_programs
where aquier_relevant and category <> 'other'
order by revenue_potential desc nulls last, avg_epc desc nulls last, name;

create or replace view public.v_affiliate_top_media as
select name, category, tier, revenue_potential, avg_epc, audience_fit_score as fit,
       payout_model, recurring, cookie_days, account_status, country_availability
from public.affiliate_programs
where media_relevant and category <> 'other'
order by revenue_potential desc nulls last, avg_epc desc nulls last, name;

comment on view public.v_affiliate_top_aquier is 'AFFILIATE ACTIVATION: Aquier-relevante programma''s op verwachte omzet.';
comment on view public.v_affiliate_top_media is 'AFFILIATE ACTIVATION: Media-Factory-relevante programma''s op verwachte omzet.';

-- Data-enrichment (industry-estimates, te valideren bij signup; metadata.epc_source).
with e(name, epc, fit, cookie, recurring, payout) as (values
  ('HubSpot Affiliate Program', 1.40, 75, 180, true,  '30% recurring tot 1 jaar'),
  ('Semrush Affiliate Program', 1.60, 78, 120, false, '$200 CPA + $10 trial (Impact)'),
  ('Shopify Affiliates',        1.00, 60, 30,  false, '~$150 CPA per merchant'),
  ('Notion Affiliate Program',  0.60, 65, 90,  true,  '50% recurring (12 mnd)'),
  ('Canva Affiliates',          0.50, 55, 30,  false, '~$36 per Pro-signup'),
  ('Adobe Affiliates',          0.70, 58, 30,  false, '85% 1e mnd / 8.33% jaar'),
  ('Jasper AI Affiliate',       0.90, 70, 30,  true,  '30% recurring'),
  ('SurferSEO Affiliate',       0.70, 62, 60,  true,  '25% recurring'),
  ('ClickFunnels Affiliates',   1.10, 68, 45,  true,  '30-40% recurring (sticky)'),
  ('Webflow Affiliates',        0.70, 55, 90,  true,  '50% (12 mnd)'),
  ('Robinhood Affiliates',      0.45, 40, 30,  false, '~$5-20 per funded account'),
  ('TradingView Partner Program', 2.00, 88, 30, true, '20-30% recurring'),
  ('Interactive Brokers Affiliates', 1.80, 80, 30, false, 'CPA + rev-share'),
  ('Binance Affiliates',        1.50, 90, 0,   true,  'Rev-share tot 50% lifetime'),
  ('Bybit Affiliates',          1.20, 78, 0,   true,  'Rev-share tot 30%'),
  ('Kraken Affiliates',         1.00, 72, 0,   true,  '20% trading fees'),
  ('TubeBuddy Affiliate',       0.80, 50, 30,  true,  '30-50% recurring'),
  ('vidIQ Affiliate',           0.75, 48, 30,  true,  'recurring rev-share'),
  ('Mashvisor',                 0.60, 42, 30,  true,  'rev-share SaaS'),
  ('Fundrise',                  0.50, 35, 30,  false, 'CPA per funded investor'),
  ('Roofstock',                 0.40, 30, 30,  false, 'CPA per transactie'),
  ('M1 Finance Affiliate',      0.50, 28, 30,  false, 'CPA per funded account')
)
update public.affiliate_programs p set
  avg_epc = e.epc, audience_fit_score = e.fit, cookie_days = e.cookie,
  recurring = e.recurring, payout_model = e.payout,
  metadata = coalesce(p.metadata,'{}'::jsonb) || jsonb_build_object('epc_source','industry_estimate_pending_validation')
from e where p.name = e.name;

select public.rank_affiliate_programs();
