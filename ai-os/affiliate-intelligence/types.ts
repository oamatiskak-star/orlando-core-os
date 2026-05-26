export interface AffiliateProgram {
  id: string;
  name: string;
  description: string;
  commission_rate: number;
  affiliate_url_base: string;
  optimal_channels: string[]; // channel UUIDs
  optimal_countries: string[]; // country codes
  content_keywords: string[]; // topics this affiliate performs well on
  avg_epc?: number; // average earnings per click
  avg_conversion_rate?: number; // conversion percentage
  audience_fit_score: number; // 1-100
  last_performance_update?: Date;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface ChannelProfile {
  id: string;
  name: string;
  niche: string;
  focus_areas: string[];
  target_countries: string[];
  primary_revenue_goal: 'affiliates' | 'memberships' | 'hybrid';
  recommended_affiliates: string[]; // affiliate IDs
  audience_demographics: {
    primary_countries: string[];
    age_range?: string;
    interests: string[];
  };
}

export interface AffiliateChannelMapping {
  affiliate_id: string;
  channel_id: string;
  priority: 1 | 2 | 3 | 4 | 5;
  reason: string;
  estimated_conversion_rate: number;
  estimated_epc: number;
  is_active: boolean;
}

export interface ContentMetadata {
  video_id: string;
  title: string;
  description: string;
  tags: string[];
  channel_id: string;
  niche: string;
  content_type: 'educational' | 'review' | 'tutorial' | 'news' | 'opinion' | 'interview';
  target_audience?: string[];
  estimated_viewer_countries: string[];
}

export interface AudienceProfile {
  primary_countries: string[];
  estimated_age_range?: string;
  interests: string[];
  purchasing_intent: 'high' | 'medium' | 'low';
  audience_type: 'retail' | 'investor' | 'entrepreneur' | 'mixed';
}

export interface PerformanceMetrics {
  affiliate_id: string;
  channel_id: string;
  content_type?: string;
  country?: string;
  ctr: number; // click-through rate
  conversion_rate: number;
  epc: number; // earnings per click
  rpm: number; // revenue per mille (per 1000 views)
  roi: number;
  sample_size: number; // number of conversions
  last_updated: Date;
}

export interface AffiliateRecommendation {
  affiliate_id: string;
  affiliate_name: string;
  confidence_score: number; // 0-100
  reasoning: {
    audience_match: number; // 0-100
    content_relevance: number; // 0-100
    historical_performance: number; // 0-100
    channel_fit: number; // 0-100
  };
  estimated_revenue_impact?: number;
  estimated_conversion_rate?: number;
  alternative_suggestions?: AffiliateRecommendation[];
  metadata?: {
    primary_reason: string;
    secondary_reasons: string[];
  };
}

export interface RecommendationRequest {
  video_id: string;
  channel_id: string;
  content_metadata: ContentMetadata;
  audience_profile: AudienceProfile;
  viewer_country?: string;
  count?: number; // how many recommendations to return (default: 3)
}

export interface RecommendationResponse {
  video_id: string;
  recommendations: AffiliateRecommendation[];
  top_choice: AffiliateRecommendation;
  timestamp: Date;
  model_version: string;
}

export interface AffiliateProgramAssignment {
  video_id: string;
  channel_id: string;
  recommended_affiliate_id: string;
  ai_confidence_score: number;
  user_selected_affiliate_id?: string; // if user overrode the recommendation
  status: 'pending_review' | 'approved' | 'overridden' | 'published';
  created_at: Date;
  updated_at: Date;
}

export interface PerformanceScorersInput {
  affiliate_id: string;
  channel_id: string;
  content_type: string;
  country: string;
  viewer_count?: number;
}
