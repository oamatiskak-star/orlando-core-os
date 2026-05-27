// Type exports
export * from './types';

// Component exports
export { ChannelProfileMatcher, CHANNEL_STRATEGIES, AFFILIATE_CHANNEL_MAPPINGS } from './channel-profile-matcher';
export { AudienceMatcher, COUNTRY_AFFILIATE_AVAILABILITY, AUDIENCE_TYPE_AFFILIATE_FIT, INTEREST_KEYWORD_AFFILIATES } from './audience-matcher';
export { ContentAnalyzer, NICHE_KEYWORDS, CONTENT_TYPE_KEYWORDS, AUDIENCE_TYPE_INFERENCE, INTEREST_INFERENCE_KEYWORDS } from './content-analyzer';
export { PerformanceScorer } from './performance-scorer';

// Main engine exports
export {
  AffiliateIntelligenceEngine,
  createAffiliateIntelligenceEngine,
} from './affiliate-intelligence-engine';

// Syncer exports
export { AffiliateChannelSyncer } from './affiliate-channel-syncer';
export { AffiliateCountrySyncer } from './affiliate-country-syncer';
export { AffiliateIntelligenceSync, createAffiliateIntelligenceSync } from './database-sync';

// Aquier integration exports
export { AquierLandingMapper, createAquierLandingMapper } from './aquier-landing-mapper';

// Country strategy and compliance exports
export {
  COUNTRY_STRATEGIES,
  getCountryStrategy,
  getActiveCountries,
  getCountriesByRegion,
  hasComplianceRequirement,
  getMembershipPriceAdjustment,
  type CountryStrategy,
} from './country-strategies';

export {
  validateMarketingCompliance,
  checkAffiliateEligibility,
  getComplianceChecklist,
  getTaxNotes,
  isContentTypeRecommended,
  getRecommendedContentTypes,
  getPricingMultiplier,
  getRequiredLanguages,
  getRegion,
  isAffiliateAvailableInCountry,
  getAllRestrictions,
  type ComplianceCheckResult,
  type AffiliateEligibility,
} from './country-compliance';

export {
  getAffiliatesForCountry,
  getCountriesForAffiliate,
  getCountryAffiliateMatch,
  filterAffiliatesByCountry,
  rankAffiliatesByCountry,
  getRegionalStrategy,
  getCountryPricingStrategy,
  getTargetCountries,
  isCountryInRegion,
  getCountryPriority,
  suggestBestAffiliate,
  getCommonAffiliates,
  getAllUniqeAffiliates,
  type CountryAffiliateMatch,
  type RegionalAffiliateStrategy,
} from './country-affiliate-utils';
