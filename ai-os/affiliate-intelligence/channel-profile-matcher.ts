import { ChannelProfile, AffiliateChannelMapping, AffiliateProgram } from './types';

export const CHANNEL_STRATEGIES: Record<string, ChannelProfile> = {
  vermogentv: {
    id: 'vermogentv',
    name: 'VermogenTv',
    niche: 'AI, income, investing, online business',
    focus_areas: ['AI tools', 'income generation', 'investing strategies', 'online business'],
    target_countries: ['NL', 'BE', 'DE', 'US', 'UK'],
    primary_revenue_goal: 'hybrid',
    recommended_affiliates: ['tradingview', 'binance', 'bybit', 'semrush', 'shopify', 'notion', 'tubebuddy', 'vidiq'],
    audience_demographics: {
      primary_countries: ['NL', 'BE', 'DE'],
      age_range: '25-55',
      interests: ['AI', 'crypto', 'investing', 'online income', 'productivity'],
    },
  },
  beleggingstv: {
    id: 'beleggingstv',
    name: 'BeleggingsTv',
    niche: 'Investing, real estate, portfolio strategy',
    focus_areas: ['investing', 'real estate', 'portfolio management', 'strategy'],
    target_countries: ['NL', 'BE', 'DE', 'US'],
    primary_revenue_goal: 'hybrid',
    recommended_affiliates: ['tradingview', 'interactive-brokers', 'fundrise', 'hubspot', 'm1-finance'],
    audience_demographics: {
      primary_countries: ['NL', 'BE'],
      age_range: '35-65',
      interests: ['investing', 'real estate', 'portfolio', 'wealth building'],
    },
  },
  vastgoedtv: {
    id: 'vastgoedtv',
    name: 'VastgoedTv',
    niche: 'Real estate deals, transformation, cashflow',
    focus_areas: ['real estate', 'deals', 'renovation', 'cashflow', 'ROI'],
    target_countries: ['NL', 'BE', 'DE', 'US'],
    primary_revenue_goal: 'hybrid',
    recommended_affiliates: ['fundrise', 'roofstock', 'mashvisor', 'hubspot', 'aquier'],
    audience_demographics: {
      primary_countries: ['NL', 'BE'],
      age_range: '30-60',
      interests: ['real estate', 'investing', 'deals', 'renovation', 'passive income'],
    },
  },
  cryptovermogen: {
    id: 'cryptovermogen',
    name: 'CryptoVermogen',
    niche: 'Crypto, trading, AI tools, market analysis',
    focus_areas: ['crypto', 'trading', 'AI tools', 'market analysis'],
    target_countries: ['NL', 'BE', 'DE', 'US', 'UK', 'EU'],
    primary_revenue_goal: 'affiliates',
    recommended_affiliates: ['binance', 'bybit', 'kraken', 'tradingview'],
    audience_demographics: {
      primary_countries: ['NL', 'BE', 'DE'],
      age_range: '20-45',
      interests: ['crypto', 'trading', 'blockchain', 'DeFi', 'AI'],
    },
  },
  'private-investor-tv': {
    id: 'private-investor-tv',
    name: 'Private Investor TV',
    niche: 'High-ticket investors, institutional, dealflow',
    focus_areas: ['institutional investing', 'dealflow', 'JV opportunities', 'high-ticket'],
    target_countries: ['US', 'UK', 'NL', 'UAE', 'DE'],
    primary_revenue_goal: 'hybrid',
    recommended_affiliates: ['interactive-brokers', 'aquier-black', 'investor-crm-premium'],
    audience_demographics: {
      primary_countries: ['US', 'UK', 'UAE'],
      age_range: '40-70',
      interests: ['institutional', 'dealflow', 'JV', 'high-ticket deals'],
    },
  },
};

export const AFFILIATE_CHANNEL_MAPPINGS: Record<string, AffiliateChannelMapping[]> = {
  tradingview: [
    {
      affiliate_id: 'tradingview',
      channel_id: 'vermogentv',
      priority: 1,
      reason: 'High relevance to trading/investing education content',
      estimated_conversion_rate: 0.045,
      estimated_epc: 12.5,
      is_active: true,
    },
    {
      affiliate_id: 'tradingview',
      channel_id: 'beleggingstv',
      priority: 1,
      reason: 'Perfect fit for portfolio strategy and market analysis',
      estimated_conversion_rate: 0.05,
      estimated_epc: 14.0,
      is_active: true,
    },
    {
      affiliate_id: 'tradingview',
      channel_id: 'cryptovermogen',
      priority: 1,
      reason: 'Essential tool for crypto traders',
      estimated_conversion_rate: 0.06,
      estimated_epc: 15.0,
      is_active: true,
    },
  ],
  binance: [
    {
      affiliate_id: 'binance',
      channel_id: 'vermogentv',
      priority: 2,
      reason: 'Strong affiliate program, high international conversion',
      estimated_conversion_rate: 0.035,
      estimated_epc: 8.5,
      is_active: true,
    },
    {
      affiliate_id: 'binance',
      channel_id: 'cryptovermogen',
      priority: 1,
      reason: 'Highest conversion rate for crypto traders',
      estimated_conversion_rate: 0.08,
      estimated_epc: 18.0,
      is_active: true,
    },
  ],
  'interactive-brokers': [
    {
      affiliate_id: 'interactive-brokers',
      channel_id: 'beleggingstv',
      priority: 2,
      reason: 'Premium broker for serious investors',
      estimated_conversion_rate: 0.025,
      estimated_epc: 35.0,
      is_active: true,
    },
    {
      affiliate_id: 'interactive-brokers',
      channel_id: 'private-investor-tv',
      priority: 1,
      reason: 'Perfect for high-ticket investor audience',
      estimated_conversion_rate: 0.04,
      estimated_epc: 50.0,
      is_active: true,
    },
  ],
  fundrise: [
    {
      affiliate_id: 'fundrise',
      channel_id: 'vastgoedtv',
      priority: 1,
      reason: 'Real estate focused, high alignment',
      estimated_conversion_rate: 0.03,
      estimated_epc: 20.0,
      is_active: true,
    },
    {
      affiliate_id: 'fundrise',
      channel_id: 'beleggingstv',
      priority: 3,
      reason: 'Alternative real estate investment option',
      estimated_conversion_rate: 0.02,
      estimated_epc: 15.0,
      is_active: true,
    },
  ],
  shopify: [
    {
      affiliate_id: 'shopify',
      channel_id: 'vermogentv',
      priority: 3,
      reason: 'E-commerce platform for online business builders',
      estimated_conversion_rate: 0.02,
      estimated_epc: 25.0,
      is_active: true,
    },
  ],
  semrush: [
    {
      affiliate_id: 'semrush',
      channel_id: 'vermogentv',
      priority: 3,
      reason: 'SEO tool for digital marketers',
      estimated_conversion_rate: 0.025,
      estimated_epc: 18.0,
      is_active: true,
    },
  ],
  aquier: [
    {
      affiliate_id: 'aquier',
      channel_id: 'vastgoedtv',
      priority: 1,
      reason: 'Direct membership/community funnel',
      estimated_conversion_rate: 0.06,
      estimated_epc: 0, // handled as membership conversion, not EPC
      is_active: true,
    },
    {
      affiliate_id: 'aquier',
      channel_id: 'private-investor-tv',
      priority: 2,
      reason: 'Premium membership funnel for exclusive access',
      estimated_conversion_rate: 0.05,
      estimated_epc: 0,
      is_active: true,
    },
  ],
};

export class ChannelProfileMatcher {
  private strategies: Record<string, ChannelProfile>;
  private mappings: Record<string, AffiliateChannelMapping[]>;

  constructor() {
    this.strategies = CHANNEL_STRATEGIES;
    this.mappings = AFFILIATE_CHANNEL_MAPPINGS;
  }

  /**
   * Get channel profile and recommended affiliates
   */
  getChannelProfile(channelId: string): ChannelProfile | null {
    return this.strategies[channelId.toLowerCase()] || null;
  }

  /**
   * Get all affiliates recommended for a channel, sorted by priority
   */
  getRecommendedAffiliatesForChannel(channelId: string): AffiliateChannelMapping[] {
    const channelKey = channelId.toLowerCase();
    const mappings = Object.values(this.mappings)
      .flat()
      .filter((m) => m.channel_id === channelKey && m.is_active)
      .sort((a, b) => a.priority - b.priority);
    return mappings;
  }

  /**
   * Get specific affiliate mapping for a channel
   */
  getAffiliateChannelMapping(affiliateId: string, channelId: string): AffiliateChannelMapping | null {
    const mapping = this.mappings[affiliateId.toLowerCase()]
      ?.find((m) => m.channel_id === channelId.toLowerCase() && m.is_active);
    return mapping || null;
  }

  /**
   * Check if affiliate is recommended for channel
   */
  isAffiliateRecommendedForChannel(affiliateId: string, channelId: string): boolean {
    return this.getAffiliateChannelMapping(affiliateId, channelId) !== null;
  }

  /**
   * Get primary revenue goal for channel
   */
  getPrimaryRevenueGoal(channelId: string): 'affiliates' | 'memberships' | 'hybrid' | null {
    const profile = this.getChannelProfile(channelId);
    return profile?.primary_revenue_goal || null;
  }

  /**
   * Filter affiliates by channel goal (memberships vs affiliates vs hybrid)
   */
  filterAffiliatesByGoal(
    affiliates: AffiliateChannelMapping[],
    channelId: string
  ): { primary: AffiliateChannelMapping[]; secondary: AffiliateChannelMapping[] } {
    const goal = this.getPrimaryRevenueGoal(channelId);

    // Identify membership vs traditional affiliates by keyword
    const isMembership = (id: string) => id.toLowerCase().includes('aquier') || id.toLowerCase().includes('membership');

    let primary: AffiliateChannelMapping[] = [];
    let secondary: AffiliateChannelMapping[] = [];

    if (goal === 'memberships') {
      primary = affiliates.filter((a) => isMembership(a.affiliate_id));
      secondary = affiliates.filter((a) => !isMembership(a.affiliate_id));
    } else if (goal === 'affiliates') {
      primary = affiliates.filter((a) => !isMembership(a.affiliate_id));
      secondary = affiliates.filter((a) => isMembership(a.affiliate_id));
    } else {
      // hybrid: both equally important, sorted by priority
      primary = affiliates;
      secondary = [];
    }

    return { primary, secondary };
  }
}
