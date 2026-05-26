// usa-realestate-channels.ts
// Fase 4 config-structuur voor de USA real-estate content engine van
// AQUIER_USA_DOMINATION_ENGINE. Definieert de 2 USA-kanalen + 10 content-types
// (uit de brief) + topic-banks + welke ECHTE Aquier-data elke video voedt.
//
// LET OP: dit is config/scaffolding. De daadwerkelijke scriptgeneratie draait
// pas zodra ANTHROPIC_API_KEY beschikbaar is; tot dan blijft script = null in
// public.aquier_content_plan (geen mock).
//
// Deze module staat los van CHANNEL_CONFIGS (de Pexels/ASMR shorts-pipeline).

export interface UsaChannel {
  key: string
  name: string
  language: 'en'
  audience: string
  publish_hours_utc: number[]
  longform_per_week: number
  shorts_per_week: number
  voice_hint: string
}

export const USA_CHANNELS: UsaChannel[] = [
  {
    key: 'aquier_usa',
    name: 'Aquier USA',
    language: 'en',
    audience: 'US real estate investors — flip, rental, multifamily, off-market',
    publish_hours_utc: [13, 18],
    longform_per_week: 3,
    shorts_per_week: 7,
    voice_hint: 'authoritative, data-driven, confident US investor educator',
  },
  {
    key: 'private_investor_tv',
    name: 'Private Investor TV',
    language: 'en',
    audience: 'HNW / family-office / private capital — institutional acquisition intelligence',
    publish_hours_utc: [14],
    longform_per_week: 2,
    shorts_per_week: 3,
    voice_hint: 'measured, sophisticated, capital-allocator perspective',
  },
]

export type VideoFormat = 'longform' | 'short'

export interface ContentType {
  key: string
  title: string                 // base title (uit de brief)
  format: VideoFormat
  angle: string                 // narratieve invalshoek
  hook_template: string         // opening hook
  target_keywords: string[]     // SEO / topical authority
  // welke ECHTE Aquier-databron deze video voedt (grounding, geen mock)
  data_source: string
  channels: string[]            // welke USA-kanalen dit type draaien
}

export const CONTENT_TYPES: ContentType[] = [
  {
    key: 'best_cities_multifamily',
    title: 'Best Cities For Multifamily',
    format: 'longform',
    angle: 'Rank US metros on multifamily absorption + rental growth using Aquier scoring.',
    hook_template: 'These are the US cities where multifamily actually cash-flows in {year} — ranked by AI.',
    target_keywords: ['best cities for multifamily', 'multifamily investing usa', 'multifamily cap rates'],
    data_source: 'vastgoed_core.v_opportunity_engine (rental_yield_score) + v_deal_engagement',
    channels: ['aquier_usa', 'private_investor_tv'],
  },
  {
    key: 'how_hedge_funds_find_deals',
    title: 'How Hedge Funds Find Deals',
    format: 'longform',
    angle: 'Reverse-engineer institutional sourcing; how Aquier surfaces the same signals.',
    hook_template: 'Hedge funds do not browse Zillow. Here is how they actually find deals.',
    target_keywords: ['how hedge funds find deals', 'institutional real estate sourcing', 'off market acquisitions'],
    data_source: 'vastgoed_core.competitor_seo_snapshots (acquisition_focus) + distress_signals',
    channels: ['private_investor_tv'],
  },
  {
    key: 'why_zillow_misses_deals',
    title: 'Why Zillow Misses Profitable Deals',
    format: 'short',
    angle: 'Consumer portals optimise for buyers, not investors; the gap Aquier fills.',
    hook_template: 'Zillow is built for home-buyers. That is exactly why it misses the profitable deals.',
    target_keywords: ['zillow alternative for investors', 'off market property finder', 'why zillow misses deals'],
    data_source: 'vastgoed_core.competitor_seo_snapshots (zillow) + v_opportunity_engine',
    channels: ['aquier_usa'],
  },
  {
    key: 'ai_real_estate_investing',
    title: 'AI Real Estate Investing',
    format: 'longform',
    angle: 'How AI scoring (flip/rental/transformation) changes acquisition decisions.',
    hook_template: 'AI just changed how the smartest investors pick deals. Here is how.',
    target_keywords: ['ai real estate investing', 'real estate ai software', 'acquisition intelligence'],
    data_source: 'vastgoed_core.kansenradar_scores + v_opportunity_engine',
    channels: ['aquier_usa', 'private_investor_tv'],
  },
  {
    key: 'off_market_strategies',
    title: 'Off Market Strategies',
    format: 'longform',
    angle: 'Signal stacking (distress, tax, permits) to find deals before they list.',
    hook_template: 'The best deals never hit the market. Here is how to find them first.',
    target_keywords: ['off market strategies', 'off market real estate', 'distressed property software'],
    data_source: 'vastgoed_core.distress_signals + kansenradar_scores',
    channels: ['aquier_usa'],
  },
  {
    key: 'distressed_property_trends',
    title: 'Distressed Property Trends',
    format: 'short',
    angle: 'Live distress trends from Aquier signal stacking.',
    hook_template: 'Distressed inventory is shifting. Here is what the data shows right now.',
    target_keywords: ['distressed property trends', 'foreclosure trends usa', 'distressed real estate'],
    data_source: 'vastgoed_core.distress_signals + v_opportunity_engine (flip_score)',
    channels: ['aquier_usa', 'private_investor_tv'],
  },
  {
    key: 'top_growth_cities_usa',
    title: 'Top Growth Cities USA',
    format: 'longform',
    angle: 'Migration + market-growth signals ranked by Aquier.',
    hook_template: 'These US cities are growing fastest — and most investors are too late.',
    target_keywords: ['top growth cities usa', 'fastest growing cities real estate', 'best markets to invest'],
    data_source: 'vastgoed_core.scraped_properties (state_code) + market signals',
    channels: ['aquier_usa'],
  },
  {
    key: 'how_investors_use_ai',
    title: 'How Investors Use AI',
    format: 'short',
    angle: 'Practical AI workflows for sourcing, scoring and underwriting.',
    hook_template: 'Top investors now run every deal through AI first. Here is the workflow.',
    target_keywords: ['how investors use ai', 'ai for real estate investors', 'ai underwriting'],
    data_source: 'vastgoed_core.v_opportunity_engine + kansenradar_scores',
    channels: ['aquier_usa', 'private_investor_tv'],
  },
  {
    key: 'best_states_cashflow',
    title: 'Best States For Cashflow',
    format: 'longform',
    angle: 'Rank states on DSCR/rental-yield using Aquier scoring.',
    hook_template: 'If you want cashflow, these are the US states the data points to.',
    target_keywords: ['best states for cashflow', 'cashflow real estate usa', 'high yield rental markets'],
    data_source: 'vastgoed_core.v_opportunity_engine (rental_yield_score per state)',
    channels: ['aquier_usa'],
  },
  {
    key: 'how_to_predict_gentrification',
    title: 'How To Predict Gentrification',
    format: 'longform',
    angle: 'Leading indicators (permits, migration, development potential) + Aquier scoring.',
    hook_template: 'Gentrification is predictable — if you watch the right signals.',
    target_keywords: ['how to predict gentrification', 'emerging neighborhoods', 'transformation potential'],
    data_source: 'vastgoed_core.kansenradar_scores (development_potential, transformation_score)',
    channels: ['private_investor_tv'],
  },
]

// Het Fase 4 plan = elk content-type op elk kanaal dat het draait.
export interface PlannedEpisode {
  channel_key: string
  content_type_key: string
  title: string
  format: VideoFormat
  hook: string
  target_keywords: string[]
  data_source: string
}

export function buildContentPlan(): PlannedEpisode[] {
  const plan: PlannedEpisode[] = []
  for (const ct of CONTENT_TYPES) {
    for (const ch of ct.channels) {
      plan.push({
        channel_key: ch,
        content_type_key: ct.key,
        title: ct.title,
        format: ct.format,
        hook: ct.hook_template,
        target_keywords: ct.target_keywords,
        data_source: ct.data_source,
      })
    }
  }
  return plan
}
