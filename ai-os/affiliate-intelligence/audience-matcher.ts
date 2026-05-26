import { AudienceProfile, AffiliateChannelMapping } from './types';

export const COUNTRY_AFFILIATE_AVAILABILITY: Record<string, string[]> = {
  NL: ['tradingview', 'binance', 'bybit', 'kraken', 'shopify', 'semrush', 'notion', 'fundrise', 'interactive-brokers'],
  BE: ['tradingview', 'binance', 'bybit', 'kraken', 'shopify', 'semrush', 'notion', 'fundrise', 'interactive-brokers'],
  DE: ['tradingview', 'binance', 'bybit', 'kraken', 'shopify', 'semrush', 'notion', 'fundrise', 'interactive-brokers'],
  US: ['tradingview', 'binance', 'bybit', 'kraken', 'shopify', 'semrush', 'notion', 'fundrise', 'interactive-brokers', 'm1-finance', 'roofstock'],
  UK: ['tradingview', 'binance', 'bybit', 'kraken', 'shopify', 'semrush', 'notion', 'fundrise', 'interactive-brokers'],
  UAE: ['tradingview', 'binance', 'bybit', 'kraken', 'interactive-brokers'],
  ES: ['tradingview', 'binance', 'bybit', 'kraken', 'shopify', 'semrush', 'notion'],
  FR: ['tradingview', 'binance', 'bybit', 'kraken', 'shopify', 'semrush', 'notion'],
};

export const AUDIENCE_TYPE_AFFILIATE_FIT: Record<string, Record<string, number>> = {
  retail: {
    tradingview: 0.8,
    binance: 0.85,
    bybit: 0.8,
    kraken: 0.75,
    shopify: 0.9,
    semrush: 0.7,
    notion: 0.85,
    fundrise: 0.65,
    'interactive-brokers': 0.5,
  },
  investor: {
    tradingview: 0.95,
    binance: 0.6,
    bybit: 0.5,
    kraken: 0.55,
    'interactive-brokers': 0.95,
    'm1-finance': 0.9,
    fundrise: 0.85,
    shopify: 0.3,
  },
  entrepreneur: {
    shopify: 0.95,
    semrush: 0.9,
    notion: 0.9,
    tradingview: 0.6,
    'interactive-brokers': 0.4,
    binance: 0.5,
  },
  mixed: {
    tradingview: 0.8,
    binance: 0.7,
    shopify: 0.8,
    semrush: 0.7,
    notion: 0.8,
    fundrise: 0.6,
    'interactive-brokers': 0.6,
  },
};

export const INTEREST_KEYWORD_AFFILIATES: Record<string, string[]> = {
  // Finance & Investment keywords
  investing: ['tradingview', 'interactive-brokers', 'm1-finance', 'fundrise'],
  crypto: ['binance', 'bybit', 'kraken', 'tradingview'],
  trading: ['tradingview', 'binance', 'bybit', 'kraken'],
  portfolio: ['tradingview', 'interactive-brokers', 'm1-finance', 'fundrise'],
  stocks: ['tradingview', 'interactive-brokers', 'm1-finance'],

  // Real Estate keywords
  'real-estate': ['fundrise', 'roofstock', 'mashvisor', 'aquier'],
  'property-investing': ['fundrise', 'roofstock', 'mashvisor'],
  'real-estate-deals': ['roofstock', 'mashvisor', 'aquier'],

  // Business & Marketing keywords
  'online-business': ['shopify', 'semrush', 'notion', 'tubebuddy', 'vidiq'],
  ecommerce: ['shopify', 'semrush'],
  seo: ['semrush', 'ahrefs'],
  marketing: ['semrush', 'hubspot', 'shopify'],
  productivity: ['notion', 'zapier'],

  // AI & Tech keywords
  ai: ['semrush', 'notion', 'tubebuddy'],
  'ai-tools': ['semrush', 'notion'],
  automation: ['zapier', 'notion'],

  // YouTube Creator keywords
  'youtube-tools': ['tubebuddy', 'vidiq'],
  'content-creation': ['tubebuddy', 'vidiq'],
  'youtube-analytics': ['tubebuddy', 'vidiq'],

  // Passive Income keywords
  'passive-income': ['fundrise', 'm1-finance', 'roofstock', 'binance'],
  'dividend-investing': ['m1-finance', 'interactive-brokers'],
};

export const PURCHASING_INTENT_MULTIPLIER: Record<string, number> = {
  high: 1.2,
  medium: 1.0,
  low: 0.7,
};

export class AudienceMatcher {
  /**
   * Calculate audience fit score for an affiliate (0-100)
   * Based on country availability, audience type, interests, and purchasing intent
   */
  calculateAudienceFitScore(affiliateId: string, audience: AudienceProfile): number {
    const id = affiliateId.toLowerCase();

    // Start with country availability score
    let countryScore = 0;
    let countriesMatched = 0;

    for (const country of audience.primary_countries) {
      const available = COUNTRY_AFFILIATE_AVAILABILITY[country]?.includes(id) || false;
      if (available) {
        countriesMatched++;
        countryScore += 1;
      }
    }

    // Normalize country score
    const normalizedCountryScore = audience.primary_countries.length > 0
      ? (countriesMatched / audience.primary_countries.length) * 100
      : 50;

    // Get audience type fit
    const audienceTypeFit = AUDIENCE_TYPE_AFFILIATE_FIT[audience.audience_type]?.[id] || 0.5;
    const audienceTypeScore = audienceTypeFit * 100;

    // Calculate interest alignment score
    let interestMatches = 0;
    for (const interest of audience.interests) {
      const lowerInterest = interest.toLowerCase();
      const affiliatesForInterest = INTEREST_KEYWORD_AFFILIATES[lowerInterest] || [];
      if (affiliatesForInterest.includes(id)) {
        interestMatches++;
      }
    }
    const interestScore = audience.interests.length > 0
      ? (interestMatches / audience.interests.length) * 100
      : 50;

    // Apply purchasing intent multiplier
    const intentMultiplier = PURCHASING_INTENT_MULTIPLIER[audience.purchasing_intent] || 1.0;

    // Weighted average: 40% country, 30% audience type, 30% interests
    let finalScore =
      normalizedCountryScore * 0.4 +
      audienceTypeScore * 0.3 +
      interestScore * 0.3;

    finalScore = finalScore * intentMultiplier;

    // Cap at 100
    return Math.min(100, Math.max(0, Math.round(finalScore)));
  }

  /**
   * Filter affiliates by country availability
   */
  filterAffiliatesByCountry(
    affiliates: AffiliateChannelMapping[],
    primaryCountries: string[]
  ): AffiliateChannelMapping[] {
    return affiliates.filter((aff) => {
      const availableCountries = COUNTRY_AFFILIATE_AVAILABILITY[primaryCountries[0]] || [];
      return availableCountries.includes(aff.affiliate_id.toLowerCase());
    });
  }

  /**
   * Filter affiliates by audience type fit
   */
  filterAffiliatesByAudienceType(
    affiliates: AffiliateChannelMapping[],
    audienceType: string
  ): AffiliateChannelMapping[] {
    const fitScores = AUDIENCE_TYPE_AFFILIATE_FIT[audienceType] || {};

    return affiliates
      .filter((aff) => {
        const fit = fitScores[aff.affiliate_id.toLowerCase()] || 0;
        return fit > 0.4; // Only keep affiliates with > 40% fit
      })
      .sort((a, b) => {
        const fitA = fitScores[a.affiliate_id.toLowerCase()] || 0;
        const fitB = fitScores[b.affiliate_id.toLowerCase()] || 0;
        return fitB - fitA; // Sort by fit descending
      });
  }

  /**
   * Filter affiliates by interest alignment
   */
  filterAffiliatesByInterests(
    affiliates: AffiliateChannelMapping[],
    interests: string[]
  ): AffiliateChannelMapping[] {
    const affiliateInterestMatches: Record<string, number> = {};

    for (const aff of affiliates) {
      const id = aff.affiliate_id.toLowerCase();
      let matches = 0;

      for (const interest of interests) {
        const lowerInterest = interest.toLowerCase();
        const affiliatesForInterest = INTEREST_KEYWORD_AFFILIATES[lowerInterest] || [];
        if (affiliatesForInterest.includes(id)) {
          matches++;
        }
      }

      affiliateInterestMatches[id] = matches;
    }

    return affiliates
      .filter((aff) => affiliateInterestMatches[aff.affiliate_id.toLowerCase()] > 0)
      .sort((a, b) => {
        const matchesA = affiliateInterestMatches[a.affiliate_id.toLowerCase()];
        const matchesB = affiliateInterestMatches[b.affiliate_id.toLowerCase()];
        return matchesB - matchesA;
      });
  }

  /**
   * Rank affiliates by audience fit
   */
  rankAffiliatesByAudienceFit(
    affiliates: AffiliateChannelMapping[],
    audience: AudienceProfile
  ): { affiliate: AffiliateChannelMapping; fit_score: number }[] {
    return affiliates
      .map((aff) => ({
        affiliate: aff,
        fit_score: this.calculateAudienceFitScore(aff.affiliate_id, audience),
      }))
      .sort((a, b) => b.fit_score - a.fit_score);
  }

  /**
   * Check if affiliate is available in primary country
   */
  isAvailableInCountry(affiliateId: string, country: string): boolean {
    const available = COUNTRY_AFFILIATE_AVAILABILITY[country] || [];
    return available.includes(affiliateId.toLowerCase());
  }
}
