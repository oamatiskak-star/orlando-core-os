-- 201_affiliate_market_expansion_rpm.sql — RPM-equivalent ranking + niche-fit
-- AFFILIATE MARKET EXPANSION: rank op verwachte omzet per 1000 views.
alter table public.affiliate_programs add column if not exists rpm_equiv numeric(8,2);   -- verwachte omzet per 1000 views (EUR)
alter table public.affiliate_programs add column if not exists niche_fit text;            -- satisfying|maker|ai|automation|productivity|finance|vastgoed|creator

comment on column public.affiliate_programs.rpm_equiv is
  'AFFILIATE EXPANSION: geschatte omzet per 1000 views = clicks/1k × EPC (researchschatting).';

-- Tier nu primair op rpm_equiv (verwachte omzet/1000 views), val terug op revenue_potential
create or replace function public.rank_affiliate_programs()
returns integer language plpgsql as $$
declare v_count int := 0;
begin
  update public.affiliate_programs p set
    revenue_potential = round((
        coalesce(p.avg_epc, 0) * (case when p.recurring then 1.6 else 1.0 end)
        * (0.6 + coalesce(p.audience_fit_score, 50) / 250.0))::numeric, 3),
    aquier_relevant = (
        p.category in ('finance_crypto','vastgoed_data','affiliate_network')
        or p.name ~* 'hubspot|semrush|salesforce|crm|pipedrive|fundrise|roofstock|mashvisor|interactive brokers|tradingview|robinhood|m1 finance|clickfunnels'
      ) and p.category <> 'other',
    media_relevant = (
        p.category in ('saas_ai','finance_crypto','affiliate_network','maker_hardware','marketplace','ai_video','automation','creator_tools')
        or p.niche_fit in ('satisfying','maker','ai','automation','productivity','creator')
      ) and p.category <> 'other';
  update public.affiliate_programs p set
    tier = case
             when coalesce(rpm_equiv, revenue_potential*6, 0) >= 6 then 1
             when coalesce(rpm_equiv, revenue_potential*6, 0) >= 3 then 2
             else 3 end;
  get diagnostics v_count = row_count;
  return v_count;
end; $$;

-- Top-lijsten op RPM-equivalent
create or replace view public.v_affiliate_top50 as
select name, category, niche_fit, tier, rpm_equiv, avg_epc, recurring, cookie_days,
       api_available, payout_model, account_status
from public.affiliate_programs
where category <> 'other'
order by rpm_equiv desc nulls last, revenue_potential desc nulls last, name
limit 50;

create or replace view public.v_affiliate_for_winners as
select name, category, niche_fit, tier, rpm_equiv, avg_epc, recurring, cookie_days, account_status
from public.affiliate_programs
where niche_fit in ('satisfying','maker','ai','automation','productivity','creator')
order by rpm_equiv desc nulls last, name;

comment on view public.v_affiliate_top50 is 'AFFILIATE EXPANSION: top-50 programma''s op verwachte omzet/1000 views.';
comment on view public.v_affiliate_for_winners is 'AFFILIATE EXPANSION: programma''s die passen bij de huidige winnaarkanalen (satisfying/maker/ai).';
