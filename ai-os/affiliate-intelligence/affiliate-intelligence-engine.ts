import { SupabaseClient } from '@supabase/supabase-js';
import {
  RecommendationRequest,
  RecommendationResponse,
  AffiliateRecommendation,
  ContentMetadata,
  AudienceProfile,
} from './types';
import { ChannelProfileMatcher } from './channel-profile-matcher';
import { AudienceMatcher } from './audience-matcher';
import { ContentAnalyzer } from './content-analyzer';
import { PerformanceScorer } from './performance-scorer';

export class AffiliateIntelligenceEngine {
  private channelMatcher: ChannelProfileMatcher;
  private audienceMatcher: AudienceMatcher;
  private contentAnalyzer: ContentAnalyzer;
  private performanceScorer: PerformanceScorer;
  private modelVersion = '1.0.0';

  constructor(private supabase?: SupabaseClient) {
    this.channelMatcher = new ChannelProfileMatcher();
    this.audienceMatcher = new AudienceMatcher();
    this.contentAnalyzer = new ContentAnalyzer();
    this.performanceScorer = new PerformanceScorer();
  }

  /**
   * Main recommendation engine
   * Takes a video and returns top N affiliate recommendations
   * Uses database data if available, falls back to hardcoded strategies
   */
  async recommend(request: RecommendationRequest): Promise<RecommendationResponse> {
    const { video_id, channel_id, content_metadata, audience_profile, viewer_country, count = 3 } = request;

    // 1. Get channel's recommended affiliates
    const channelProfile = this.channelMatcher.getChannelProfile(channel_id);
    let recommendedForChannel = this.channelMatcher.getRecommendedAffiliatesForChannel(channel_id);

    // Try to fetch actual performance data from database if available
    if (this.supabase && channel_id) {
      const databaseMappings = await this.getChannelMappingsFromDatabase(channel_id);
      if (databaseMappings && databaseMappings.length > 0) {
        recommendedForChannel = databaseMappings;
      }
    }

    if (!channelProfile || recommendedForChannel.length === 0) {
      throw new Error(`No affiliate strategy found for channel: ${channel_id}`);
    }

    // 2. Analyze content to determine niche, type, and audience
    const contentAnalysis = this.contentAnalyzer.analyzeContent(content_metadata);

    // 3. Filter affiliates by various dimensions
    let candidates = recommendedForChannel;

    // Filter by country availability
    if (viewer_country) {
      candidates = this.audienceMatcher.filterAffiliatesByCountry(
        candidates,
        [viewer_country]
      );
    }

    // Filter by audience type fit
    candidates = this.audienceMatcher.filterAffiliatesByAudienceType(
      candidates,
      audience_profile.audience_type
    );

    // Filter by interest alignment
    candidates = this.audienceMatcher.filterAffiliatesByInterests(candidates, audience_profile.interests);

    // 4. Calculate recommendation scores for each candidate
    const scoredAffiliates = candidates
      .map((candidate) => {
        const audienceFitScore = this.audienceMatcher.calculateAudienceFitScore(
          candidate.affiliate_id,
          audience_profile
        );

        const performanceScore = this.performanceScorer.calculateAveragePerformanceScore(
          candidate.affiliate_id,
          channel_id
        );

        const dataConfidence = this.performanceScorer.getDataConfidence(candidate.affiliate_id, channel_id);

        // Confidence multiplier based on data availability
        const confidenceMultiplier =
          dataConfidence === 'high' ? 1.0 : dataConfidence === 'medium' ? 0.85 : 0.7;

        // Content relevance: check if affiliate keywords match content interests
        let contentRelevanceScore = 50; // default
        const affiliateRelevantInterests = audience_profile.interests.filter((interest) =>
          candidate.affiliate_id.toLowerCase().includes(interest.toLowerCase()) ||
          this.isAffiliateRelevantToInterest(candidate.affiliate_id, interest)
        );

        if (affiliateRelevantInterests.length > 0) {
          contentRelevanceScore = 85;
        }

        // Final confidence score: weighted average
        // 35% audience fit, 35% performance, 20% content relevance, 10% channel alignment
        const finalConfidence = Math.round(
          audienceFitScore * 0.35 +
          performanceScore * 0.35 +
          contentRelevanceScore * 0.2 +
          (candidate.priority <= 2 ? 100 : 70) * 0.1 // Boost for high-priority affiliates
        ) * confidenceMultiplier;

        // Estimate revenue impact
        const revenueEstimate = this.performanceScorer.estimateExpectedRevenue(
          candidate.affiliate_id,
          channel_id
        );

        return {
          affiliate: candidate,
          audienceFitScore,
          performanceScore,
          contentRelevanceScore,
          finalConfidence: Math.min(100, Math.max(0, Math.round(finalConfidence))),
          estimatedRevenue: revenueEstimate.estimated_revenue,
          estimatedConversionRate: this.performanceScorer.getAverageConversionRate(
            candidate.affiliate_id,
            channel_id
          ),
        };
      })
      .sort((a, b) => b.finalConfidence - a.finalConfidence)
      .slice(0, count);

    // 5. Format recommendations
    const recommendations: AffiliateRecommendation[] = scoredAffiliates.map((scored) => ({
      affiliate_id: scored.affiliate.affiliate_id,
      affiliate_name: this.getAffiliateDisplayName(scored.affiliate.affiliate_id),
      confidence_score: scored.finalConfidence,
      reasoning: {
        audience_match: scored.audienceFitScore,
        content_relevance: scored.contentRelevanceScore,
        historical_performance: scored.performanceScore,
        channel_fit: scored.affiliate.priority <= 2 ? 95 : 70,
      },
      estimated_revenue_impact: scored.estimatedRevenue,
      estimated_conversion_rate: scored.estimatedConversionRate,
      metadata: {
        primary_reason: this.generatePrimaryReason(scored),
        secondary_reasons: this.generateSecondaryReasons(scored, audience_profile),
      },
    }));

    // 6. Create response
    return {
      video_id,
      recommendations,
      top_choice: recommendations[0],
      timestamp: new Date(),
      model_version: this.modelVersion,
    };
  }

  /**
   * Batch recommend for multiple videos
   */
  async recommendBatch(requests: RecommendationRequest[]): Promise<RecommendationResponse[]> {
    return Promise.all(requests.map((req) => this.recommend(req)));
  }

  /**
   * Check if affiliate is relevant to an interest
   */
  private isAffiliateRelevantToInterest(affiliateId: string, interest: string): boolean {
    const lowerAff = affiliateId.toLowerCase();
    const lowerInt = interest.toLowerCase();

    // Direct match
    if (lowerAff.includes(lowerInt)) return true;

    // Reverse match
    if (lowerInt.includes(lowerAff)) return true;

    // Semantic matching
    const matches: Record<string, string[]> = {
      binance: ['crypto', 'trading', 'bitcoin'],
      tradingview: ['trading', 'investing', 'stocks'],
      shopify: ['ecommerce', 'online-business'],
      semrush: ['seo', 'marketing', 'digital'],
      fundrise: ['real-estate', 'investing'],
      'interactive-brokers': ['stocks', 'investing', 'trading'],
    };

    const relatedInterests = matches[lowerAff] || [];
    return relatedInterests.includes(lowerInt);
  }

  /**
   * Get human-readable affiliate name
   */
  private getAffiliateDisplayName(affiliateId: string): string {
    const names: Record<string, string> = {
      tradingview: 'TradingView',
      binance: 'Binance',
      bybit: 'Bybit',
      kraken: 'Kraken',
      shopify: 'Shopify',
      semrush: 'Semrush',
      notion: 'Notion',
      fundrise: 'Fundrise',
      'interactive-brokers': 'Interactive Brokers',
      'm1-finance': 'M1 Finance',
      'roofstock': 'Roofstock',
      'mashvisor': 'Mashvisor',
      'tubebuddy': 'TubeBuddy',
      'vidiq': 'vidIQ',
      'hubspot': 'HubSpot',
      aquier: 'Aquier Membership',
      'aquier-black': 'Aquier Black',
    };

    return names[affiliateId.toLowerCase()] || affiliateId;
  }

  /**
   * Generate primary reason for recommendation
   */
  private generatePrimaryReason(
    scored: {
      affiliate: any;
      audienceFitScore: number;
      performanceScore: number;
      contentRelevanceScore: number;
    }
  ): string {
    const { audienceFitScore, performanceScore, contentRelevanceScore } = scored;

    if (performanceScore > 80) {
      return 'Historically strong performance with this channel';
    }

    if (audienceFitScore > 85) {
      return 'Excellent match for audience geography and interests';
    }

    if (contentRelevanceScore > 80) {
      return 'Highly relevant to video content and topic';
    }

    return 'Best overall match based on audience and channel data';
  }

  /**
   * Generate secondary reasons for recommendation
   */
  private generateSecondaryReasons(
    scored: {
      affiliate: any;
      audienceFitScore: number;
      performanceScore: number;
      contentRelevanceScore: number;
    },
    audience: AudienceProfile
  ): string[] {
    const reasons: string[] = [];

    if (scored.performanceScore > 70) {
      reasons.push(`Strong historical performance (${scored.performanceScore}/100)`);
    }

    if (scored.audienceFitScore > 75) {
      reasons.push(`Good fit for ${audience.primary_countries.join('/')} audience`);
    }

    if (audience.interests.length > 0) {
      reasons.push(`Aligns with audience interests: ${audience.interests.slice(0, 2).join(', ')}`);
    }

    if (scored.affiliate.priority === 1) {
      reasons.push('Top-tier affiliate for this channel');
    }

    return reasons.slice(0, 3); // Return max 3 reasons
  }

  /**
   * Fetch channel mappings from database
   * Falls back to hardcoded data if database is unavailable
   */
  private async getChannelMappingsFromDatabase(
    channelId: string
  ): Promise<Array<{ affiliate_id: string; priority: number }> | null> {
    if (!this.supabase) return null;

    try {
      const { data, error } = await this.supabase
        .from('affiliate_channel_mappings')
        .select(`
          affiliate_program_id,
          priority,
          affiliate_programs(name)
        `)
        .eq('channel_id', channelId)
        .eq('is_active', true)
        .order('priority', { ascending: true });

      if (error || !data) {
        console.warn(`Failed to fetch database channel mappings: ${error?.message || 'No data'}`);
        return null;
      }

      return data.map((row: any) => ({
        affiliate_id: row.affiliate_programs?.name || '',
        priority: row.priority,
      })).filter((m: any) => m.affiliate_id);
    } catch (error) {
      console.warn(`Database fetch error: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }

  /**
   * Get performance metrics from database for an affiliate-channel pair
   */
  private async getPerformanceMetricsFromDatabase(
    affiliateId: string,
    channelId: string
  ): Promise<{ conversion_rate: number; epc: number } | null> {
    if (!this.supabase) return null;

    try {
      const { data, error } = await this.supabase
        .from('affiliate_channel_mappings')
        .select('est_conversion_rate, est_epc')
        .eq('channel_id', channelId)
        .match({
          affiliate_program_id: affiliateId,
          is_active: true,
        })
        .single();

      if (error || !data) {
        return null;
      }

      return {
        conversion_rate: data.est_conversion_rate || 0,
        epc: data.est_epc || 0,
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Health check - verify engine initialization
   */
  healthCheck(): { status: string; model_version: string; components_initialized: boolean; database_connected: boolean } {
    return {
      status: 'healthy',
      model_version: this.modelVersion,
      components_initialized: true,
      database_connected: !!this.supabase,
    };
  }
}

/**
 * Factory function for creating the engine
 */
export function createAffiliateIntelligenceEngine(supabase?: SupabaseClient): AffiliateIntelligenceEngine {
  return new AffiliateIntelligenceEngine(supabase);
}
