/**
 * Country-specific affiliate strategies and preferences
 * Defines optimal affiliates, pricing, and compliance rules per country/region
 */

export interface CountryStrategy {
  country_code: string
  country_name: string
  region: 'EU' | 'Americas' | 'MENA' | 'APAC'
  primary_language: string
  preferred_currency: string
  affiliate_preferences: string[]
  pricing_strategy: 'standard' | 'premium' | 'value'
  membership_pricing_adjustment: number // 1.0 = no change, 1.2 = 20% increase
  vat_rate: number
  compliance_requirements: string[]
  recommended_content_types: string[]
  timezone: string
  is_active: boolean
  priority: number // 1 = highest priority
  notes: string
}

export const COUNTRY_STRATEGIES: Record<string, CountryStrategy> = {
  NL: {
    country_code: 'NL',
    country_name: 'Netherlands',
    region: 'EU',
    primary_language: 'nl',
    preferred_currency: 'EUR',
    affiliate_preferences: [
      'tradingview', 'binance', 'interactive-brokers', 'fundrise', 'semrush',
      'shopify', 'notion', 'tubebuddy', 'hubspot'
    ],
    pricing_strategy: 'standard',
    membership_pricing_adjustment: 1.0,
    vat_rate: 0.21,
    compliance_requirements: [
      'GDPR compliant',
      'Cookie consent banner required',
      'Privacy policy in Dutch',
      'No targeted ads without consent'
    ],
    recommended_content_types: ['investing', 'saas', 'business', 'marketing'],
    timezone: 'Europe/Amsterdam',
    is_active: true,
    priority: 1,
    notes: 'Primary market, Dutch-speaking audience'
  },

  BE: {
    country_code: 'BE',
    country_name: 'Belgium',
    region: 'EU',
    primary_language: 'nl',
    preferred_currency: 'EUR',
    affiliate_preferences: [
      'tradingview', 'binance', 'interactive-brokers', 'fundrise', 'semrush',
      'shopify', 'hubspot'
    ],
    pricing_strategy: 'standard',
    membership_pricing_adjustment: 1.0,
    vat_rate: 0.21,
    compliance_requirements: [
      'GDPR compliant',
      'Cookie consent banner required',
      'Privacy policy in French/Dutch',
      'No targeted ads without consent'
    ],
    recommended_content_types: ['investing', 'saas', 'business'],
    timezone: 'Europe/Brussels',
    is_active: true,
    priority: 2,
    notes: 'Secondary EU market, Dutch/French speaking'
  },

  DE: {
    country_code: 'DE',
    country_name: 'Germany',
    region: 'EU',
    primary_language: 'de',
    preferred_currency: 'EUR',
    affiliate_preferences: [
      'tradingview', 'interactive-brokers', 'semrush', 'shopify', 'notion',
      'hubspot', 'fundrise'
    ],
    pricing_strategy: 'premium',
    membership_pricing_adjustment: 1.1,
    vat_rate: 0.19,
    compliance_requirements: [
      'GDPR compliant',
      'German privacy law compliance (TMG, TTDSG)',
      'Privacy policy in German',
      'Explicit opt-in for email marketing',
      'Imprint (Impressum) required'
    ],
    recommended_content_types: ['investing', 'saas', 'professional-development'],
    timezone: 'Europe/Berlin',
    is_active: true,
    priority: 3,
    notes: 'Large EU market, strict data privacy regulations'
  },

  FR: {
    country_code: 'FR',
    country_name: 'France',
    region: 'EU',
    primary_language: 'fr',
    preferred_currency: 'EUR',
    affiliate_preferences: [
      'tradingview', 'interactive-brokers', 'semrush', 'shopify', 'hubspot'
    ],
    pricing_strategy: 'premium',
    membership_pricing_adjustment: 1.05,
    vat_rate: 0.20,
    compliance_requirements: [
      'GDPR compliant',
      'CNIL compliance',
      'Privacy policy in French',
      'Cookie wall prohibited (implied consent)',
      'Right to be forgotten easily accessible'
    ],
    recommended_content_types: ['investing', 'saas', 'business'],
    timezone: 'Europe/Paris',
    is_active: true,
    priority: 4,
    notes: 'EU market with strict CNIL requirements'
  },

  ES: {
    country_code: 'ES',
    country_name: 'Spain',
    region: 'EU',
    primary_language: 'es',
    preferred_currency: 'EUR',
    affiliate_preferences: [
      'tradingview', 'interactive-brokers', 'semrush', 'shopify', 'hubspot'
    ],
    pricing_strategy: 'standard',
    membership_pricing_adjustment: 1.0,
    vat_rate: 0.21,
    compliance_requirements: [
      'GDPR compliant',
      'LSSI-CE (Spanish eCommerce law)',
      'Privacy policy in Spanish',
      'No unsolicited email marketing'
    ],
    recommended_content_types: ['investing', 'saas', 'business'],
    timezone: 'Europe/Madrid',
    is_active: true,
    priority: 5,
    notes: 'EU market, Spanish-speaking audience'
  },

  GB: {
    country_code: 'GB',
    country_name: 'United Kingdom',
    region: 'EU',
    primary_language: 'en',
    preferred_currency: 'GBP',
    affiliate_preferences: [
      'tradingview', 'interactive-brokers', 'binance', 'semrush', 'shopify',
      'notion', 'hubspot'
    ],
    pricing_strategy: 'premium',
    membership_pricing_adjustment: 1.15,
    vat_rate: 0.20,
    compliance_requirements: [
      'UK GDPR compliant',
      'Data Protection Act 2018',
      'FCA financial regulations (if applicable)',
      'Privacy policy in English',
      'Cookies consent required'
    ],
    recommended_content_types: ['investing', 'finance', 'saas', 'business'],
    timezone: 'Europe/London',
    is_active: true,
    priority: 2,
    notes: 'UK market, English-speaking, post-Brexit separate regulations'
  },

  US: {
    country_code: 'US',
    country_name: 'United States',
    region: 'Americas',
    primary_language: 'en',
    preferred_currency: 'USD',
    affiliate_preferences: [
      'tradingview', 'binance', 'bybit', 'interactive-brokers', 'fundrise',
      'shopify', 'semrush', 'hubspot', 'tubebuddy'
    ],
    pricing_strategy: 'premium',
    membership_pricing_adjustment: 1.25,
    vat_rate: 0, // VAT not applicable, varies by state
    compliance_requirements: [
      'CCPA/CPRA compliant (California)',
      'State privacy law compliance',
      'CAN-SPAM for email marketing',
      'FTC affiliate disclosure requirements',
      'Possible state-specific regulations'
    ],
    recommended_content_types: ['investing', 'crypto', 'saas', 'entrepreneurship', 'financial-education'],
    timezone: 'America/New_York',
    is_active: true,
    priority: 1,
    notes: 'Largest market, highest revenue potential, multiple state regulations'
  },

  CA: {
    country_code: 'CA',
    country_name: 'Canada',
    region: 'Americas',
    primary_language: 'en',
    preferred_currency: 'CAD',
    affiliate_preferences: [
      'tradingview', 'interactive-brokers', 'binance', 'shopify', 'semrush'
    ],
    pricing_strategy: 'premium',
    membership_pricing_adjustment: 1.15,
    vat_rate: 0.05, // GST, varies by province
    compliance_requirements: [
      'PIPEDA compliant',
      'Provincial privacy laws',
      'CASL (anti-spam legislation)',
      'Bilingual support (French)',
      'Privacy policy in English/French'
    ],
    recommended_content_types: ['investing', 'saas', 'business'],
    timezone: 'America/Toronto',
    is_active: true,
    priority: 3,
    notes: 'North American market, CASL strict email rules, bilingual requirements'
  },

  AE: {
    country_code: 'AE',
    country_name: 'United Arab Emirates',
    region: 'MENA',
    primary_language: 'ar',
    preferred_currency: 'AED',
    affiliate_preferences: [
      'tradingview', 'binance', 'interactive-brokers', 'fundrise', 'semrush'
    ],
    pricing_strategy: 'premium',
    membership_pricing_adjustment: 1.2,
    vat_rate: 0.05,
    compliance_requirements: [
      'UAE data privacy law',
      'Sharia-compliant payment methods',
      'No alcohol/gambling content',
      'Respect Islamic values in marketing',
      'Local business license requirements'
    ],
    recommended_content_types: ['investing', 'real-estate', 'business', 'crypto'],
    timezone: 'Asia/Dubai',
    is_active: true,
    priority: 4,
    notes: 'MENA hub, Islamic law considerations, premium pricing, high purchasing power'
  },

  SA: {
    country_code: 'SA',
    country_name: 'Saudi Arabia',
    region: 'MENA',
    primary_language: 'ar',
    preferred_currency: 'SAR',
    affiliate_preferences: [
      'tradingview', 'interactive-brokers', 'semrush', 'shopify'
    ],
    pricing_strategy: 'premium',
    membership_pricing_adjustment: 1.15,
    vat_rate: 0.15,
    compliance_requirements: [
      'Sharia-compliant products required',
      'No pork/alcohol/gambling',
      'Islamic finance principles',
      'Saudi local laws',
      'Arabic language support'
    ],
    recommended_content_types: ['investing', 'business', 'professional-development'],
    timezone: 'Asia/Riyadh',
    is_active: true,
    priority: 5,
    notes: 'MENA market, strict Islamic law, high-net-worth audience'
  },

  SG: {
    country_code: 'SG',
    country_name: 'Singapore',
    region: 'APAC',
    primary_language: 'en',
    preferred_currency: 'SGD',
    affiliate_preferences: [
      'tradingview', 'interactive-brokers', 'binance', 'shopify', 'semrush'
    ],
    pricing_strategy: 'premium',
    membership_pricing_adjustment: 1.2,
    vat_rate: 0.08, // GST
    compliance_requirements: [
      'PDPA (Personal Data Protection Act)',
      'MAS financial regulations',
      'No high-risk financial products',
      'Local business registration'
    ],
    recommended_content_types: ['investing', 'saas', 'business', 'finance'],
    timezone: 'Asia/Singapore',
    is_active: true,
    priority: 5,
    notes: 'APAC hub, financial hub, strong regulations, English-speaking'
  },

  AU: {
    country_code: 'AU',
    country_name: 'Australia',
    region: 'APAC',
    primary_language: 'en',
    preferred_currency: 'AUD',
    affiliate_preferences: [
      'tradingview', 'interactive-brokers', 'binance', 'shopify', 'semrush'
    ],
    pricing_strategy: 'premium',
    membership_pricing_adjustment: 1.1,
    vat_rate: 0.10, // GST
    compliance_requirements: [
      'Privacy Act 1988',
      'ASIC financial regulations',
      'ACL (Australian Consumer Law)',
      'No misleading financial advice'
    ],
    recommended_content_types: ['investing', 'saas', 'business', 'finance'],
    timezone: 'Australia/Sydney',
    is_active: true,
    priority: 5,
    notes: 'APAC market, strong consumer protections, English-speaking'
  },
}

/**
 * Get country strategy by code
 */
export function getCountryStrategy(countryCode: string): CountryStrategy | undefined {
  return COUNTRY_STRATEGIES[countryCode.toUpperCase()]
}

/**
 * Get all active countries sorted by priority
 */
export function getActiveCountries(): CountryStrategy[] {
  return Object.values(COUNTRY_STRATEGIES)
    .filter(c => c.is_active)
    .sort((a, b) => a.priority - b.priority)
}

/**
 * Get countries by region
 */
export function getCountriesByRegion(region: string): CountryStrategy[] {
  return Object.values(COUNTRY_STRATEGIES)
    .filter(c => c.region === region && c.is_active)
    .sort((a, b) => a.priority - b.priority)
}

/**
 * Check if country has specific compliance requirement
 */
export function hasComplianceRequirement(countryCode: string, requirement: string): boolean {
  const strategy = getCountryStrategy(countryCode)
  return strategy?.compliance_requirements.includes(requirement) ?? false
}

/**
 * Get membership price adjustment for country
 */
export function getMembershipPriceAdjustment(countryCode: string): number {
  return getCountryStrategy(countryCode)?.membership_pricing_adjustment ?? 1.0
}
