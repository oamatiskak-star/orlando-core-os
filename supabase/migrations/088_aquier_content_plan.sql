-- ─────────────────────────────────────────────────────────────────────────
-- Migration 088 — AQUIER_USA_DOMINATION_ENGINE content plan (Fase 4)
-- ─────────────────────────────────────────────────────────────────────────
-- DB-backed content-plan voor de 2 USA-kanalen (Aquier USA / Private Investor TV)
-- × 10 content-types uit de brief. Spiegelt content-worker/src/generators/
-- usa-realestate-channels.ts (buildContentPlan()).
--
-- GEEN MOCK: dit zijn GEPLANDE afleveringen (status 'planned', script = NULL).
-- script wordt pas gevuld zodra ANTHROPIC_API_KEY beschikbaar is en de
-- script-generator draait. Geen verzonnen view-/engagement-cijfers.
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists public.aquier_content_plan (
  id uuid primary key default gen_random_uuid(),
  channel_key text not null,
  content_type_key text not null,
  title text not null,
  format text not null check (format in ('longform','short')),
  hook text,
  target_keywords text[] not null default '{}',
  data_source text,
  status text not null default 'planned'
    check (status in ('planned','scripted','generated','published')),
  script text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (channel_key, content_type_key)
);

create index if not exists aquier_content_plan_status_idx on public.aquier_content_plan (status, channel_key);

drop trigger if exists trg_aquier_content_plan_updated on public.aquier_content_plan;
create trigger trg_aquier_content_plan_updated
  before update on public.aquier_content_plan
  for each row execute function public.aquier_touch_updated_at();

-- Seed 14 geplande afleveringen (content-type × kanaal)
insert into public.aquier_content_plan (channel_key, content_type_key, title, format, hook, target_keywords, data_source) values
  ('aquier_usa','best_cities_multifamily','Best Cities For Multifamily','longform','These are the US cities where multifamily actually cash-flows — ranked by AI.', array['best cities for multifamily','multifamily investing usa'], 'v_opportunity_engine + v_deal_engagement'),
  ('private_investor_tv','best_cities_multifamily','Best Cities For Multifamily','longform','These are the US cities where multifamily actually cash-flows — ranked by AI.', array['best cities for multifamily','multifamily investing usa'], 'v_opportunity_engine + v_deal_engagement'),
  ('private_investor_tv','how_hedge_funds_find_deals','How Hedge Funds Find Deals','longform','Hedge funds do not browse Zillow. Here is how they actually find deals.', array['how hedge funds find deals','institutional real estate sourcing'], 'competitor_seo_snapshots + distress_signals'),
  ('aquier_usa','why_zillow_misses_deals','Why Zillow Misses Profitable Deals','short','Zillow is built for home-buyers. That is exactly why it misses the profitable deals.', array['zillow alternative for investors','off market property finder'], 'competitor_seo_snapshots(zillow) + v_opportunity_engine'),
  ('aquier_usa','ai_real_estate_investing','AI Real Estate Investing','longform','AI just changed how the smartest investors pick deals. Here is how.', array['ai real estate investing','real estate ai software'], 'kansenradar_scores + v_opportunity_engine'),
  ('private_investor_tv','ai_real_estate_investing','AI Real Estate Investing','longform','AI just changed how the smartest investors pick deals. Here is how.', array['ai real estate investing','acquisition intelligence'], 'kansenradar_scores + v_opportunity_engine'),
  ('aquier_usa','off_market_strategies','Off Market Strategies','longform','The best deals never hit the market. Here is how to find them first.', array['off market strategies','distressed property software'], 'distress_signals + kansenradar_scores'),
  ('aquier_usa','distressed_property_trends','Distressed Property Trends','short','Distressed inventory is shifting. Here is what the data shows right now.', array['distressed property trends','foreclosure trends usa'], 'distress_signals + v_opportunity_engine'),
  ('private_investor_tv','distressed_property_trends','Distressed Property Trends','short','Distressed inventory is shifting. Here is what the data shows right now.', array['distressed property trends','distressed real estate'], 'distress_signals + v_opportunity_engine'),
  ('aquier_usa','top_growth_cities_usa','Top Growth Cities USA','longform','These US cities are growing fastest — and most investors are too late.', array['top growth cities usa','best markets to invest'], 'scraped_properties(state_code) + market signals'),
  ('aquier_usa','how_investors_use_ai','How Investors Use AI','short','Top investors now run every deal through AI first. Here is the workflow.', array['how investors use ai','ai for real estate investors'], 'v_opportunity_engine + kansenradar_scores'),
  ('private_investor_tv','how_investors_use_ai','How Investors Use AI','short','Top investors now run every deal through AI first. Here is the workflow.', array['how investors use ai','ai underwriting'], 'v_opportunity_engine + kansenradar_scores'),
  ('aquier_usa','best_states_cashflow','Best States For Cashflow','longform','If you want cashflow, these are the US states the data points to.', array['best states for cashflow','high yield rental markets'], 'v_opportunity_engine(rental_yield_score per state)'),
  ('private_investor_tv','how_to_predict_gentrification','How To Predict Gentrification','longform','Gentrification is predictable — if you watch the right signals.', array['how to predict gentrification','emerging neighborhoods'], 'kansenradar_scores(development_potential, transformation_score)')
on conflict (channel_key, content_type_key) do nothing;
