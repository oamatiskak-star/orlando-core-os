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
