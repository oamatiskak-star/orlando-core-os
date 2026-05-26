import { SupabaseClient } from '@supabase/supabase-js';
import { AffiliateIntelligenceEngine } from './affiliate-intelligence-engine';

interface AquierLandingConfig {
  channelId: string;
  videoId: string;
  title: string;
  description: string;
  contentKeywords: string[];
  targetAudience: string;
  funnelType: 'membership' | 'saas' | 'course' | 'coaching' | 'hybrid';
  primaryGoal: 'revenue' | 'leads' | 'subscribers';
}

interface VisitorContext {
  country: string;
  language?: string;
  intent?: string;
  referrerSource?: string;
}

interface AquierLandingRecommendation {
  landingPageUrl: string;
  primaryAffiliateId: string;
  primaryAffiliateName: string;
  alternativeAffiliates: Array<{
    affiliateId: string;
    affiliateName: string;
    confidenceScore: number;
  }>;
  leadCaptureFields: string[];
  funnelType: string;
  callToActionText: string;
  alternativeOffers: string[];
}

export class AquierLandingMapper {
  private engine: AffiliateIntelligenceEngine;

  constructor(private supabase: SupabaseClient) {
    this.engine = new AffiliateIntelligenceEngine(supabase);
  }

  /**
   * Generate Aquier landing page URL for a YouTube video
   * Creates a standardized landing page URL that captures leads and recommends affiliates
   */
  generateLandingPageUrl(config: AquierLandingConfig, visitorContext: VisitorContext): string {
    const baseUrl = process.env.NEXT_PUBLIC_AQUIER_URL || 'https://aquier.app';
    const encodedTitle = encodeURIComponent(config.title);
    const params = new URLSearchParams({
      channel: config.channelId,
      video: config.videoId,
      country: visitorContext.country,
      funnel: config.funnelType,
      goal: config.primaryGoal,
    });

    if (visitorContext.language) {
      params.append('language', visitorContext.language);
    }

    if (visitorContext.intent) {
      params.append('intent', visitorContext.intent);
    }

    return `${baseUrl}/landing/${config.channelId}/${config.videoId}?${params.toString()}`;
  }

  /**
   * Get recommended landing page configuration for a YouTube video
   * Analyzes video content and visitor context to determine optimal affiliate and funnel
   */
  async getRecommendation(
    config: AquierLandingConfig,
    visitorContext: VisitorContext
  ): Promise<AquierLandingRecommendation> {
    // Build recommendation request for the intelligence engine
    const recommendationRequest = {
      video_id: config.videoId,
      channel_id: config.channelId,
      content_metadata: {
        title: config.title,
        description: config.description,
        keywords: config.contentKeywords,
        topic: config.contentKeywords[0] || 'general',
        audience_target: config.targetAudience,
      },
      audience_profile: {
        audience_type: config.targetAudience,
        primary_countries: [visitorContext.country],
        interests: config.contentKeywords,
      },
      viewer_country: visitorContext.country,
      count: 3,
    };

    // Get affiliate recommendations from the intelligence engine
    const response = await this.engine.recommend(recommendationRequest);

    if (!response || !response.recommendations || response.recommendations.length === 0) {
      throw new Error('No affiliate recommendations available for this content');
    }

    const primary = response.recommendations[0];
    const alternatives = response.recommendations.slice(1, 4).map((rec) => ({
      affiliateId: rec.affiliate_id,
      affiliateName: rec.affiliate_name,
      confidenceScore: rec.confidence_score,
    }));

    // Determine lead capture fields based on funnel type
    const leadCaptureFields = this.getLeadCaptureFieldsForFunnel(config.funnelType);

    // Get alternative offers based on channel and audience
    const alternativeOffers = this.getAlternativeOffers(config.channelId, config.funnelType);

    // Generate CTA text based on primary affiliate and goal
    const callToActionText = this.getCallToActionText(primary.affiliate_name, config.primaryGoal);

    return {
      landingPageUrl: this.generateLandingPageUrl(config, visitorContext),
      primaryAffiliateId: primary.affiliate_id,
      primaryAffiliateName: primary.affiliate_name,
      alternativeAffiliates: alternatives,
      leadCaptureFields,
      funnelType: config.funnelType,
      callToActionText,
      alternativeOffers,
    };
  }

  /**
   * Determine which lead capture fields to show based on funnel type
   */
  private getLeadCaptureFieldsForFunnel(funnelType: string): string[] {
    const fieldsByFunnel: Record<string, string[]> = {
      membership: ['email', 'country', 'primary_interest', 'experience_level'],
      saas: ['email', 'country', 'company_name', 'use_case'],
      course: ['email', 'name', 'country', 'current_skill_level'],
      coaching: ['email', 'name', 'country', 'business_stage', 'budget'],
      hybrid: ['email', 'country', 'primary_interest', 'investment_interest'],
    };

    return fieldsByFunnel[funnelType] || ['email', 'country'];
  }

  /**
   * Get alternative offers to present on landing page
   * Includes upgrades to premium memberships, coaching packages, etc.
   */
  private getAlternativeOffers(channelId: string, funnelType: string): string[] {
    const offersByChannel: Record<string, string[]> = {
      VermogenTv: ['Aquier Black Membership', 'Investment Course Bundle', 'Tool Recommendations'],
      BeleggingsTv: ['Aquier Premium Investor', 'Portfolio Consultation', 'Deal Flow Access'],
      VastgoedTv: ['Real Estate Mastery Course', 'Property Analysis Tools', 'Investor Network'],
      CryptoVermogen: ['Trading Strategy Workshop', 'AI Signal Bot', 'Community Access'],
      'Private Investor TV': [
        'Aquier Black Elite',
        'Investment Advisory Package',
        'Deal Sourcing Service',
      ],
    };

    return offersByChannel[channelId] || ['Premium Membership', 'Exclusive Content Access'];
  }

  /**
   * Generate call-to-action text based on affiliate and goal
   */
  private getCallToActionText(affiliateId: string, goal: string): string {
    if (goal === 'revenue') {
      return `Get Started with ${affiliateId} →`;
    } else if (goal === 'leads') {
      return `Claim Your Free Account →`;
    } else if (goal === 'subscribers') {
      return `Join Our Community →`;
    }
    return 'Learn More →';
  }

  /**
   * Log landing page view for tracking
   * Records when a visitor lands on an Aquier landing page
   */
  async logLandingPageView(
    config: AquierLandingConfig,
    visitorContext: VisitorContext,
    recommendation: AquierLandingRecommendation
  ): Promise<void> {
    const { error } = await this.supabase.from('aquier_landing_events').insert({
      channel_id: config.channelId,
      video_id: config.videoId,
      affiliate_id: recommendation.primaryAffiliateId,
      visitor_country: visitorContext.country,
      visitor_language: visitorContext.language,
      visitor_intent: visitorContext.intent,
      funnel_type: config.funnelType,
      primary_goal: config.primaryGoal,
      created_at: new Date().toISOString(),
    });

    if (error) {
      console.error('Failed to log landing page view:', error.message);
    }
  }

  /**
   * Log affiliate link click from landing page
   */
  async logAffiliateClick(
    videoId: string,
    affiliateId: string,
    visitorCountry: string,
    visitorId?: string
  ): Promise<void> {
    const { error } = await this.supabase.from('aquier_affiliate_clicks').insert({
      video_id: videoId,
      affiliate_id: affiliateId,
      visitor_country: visitorCountry,
      visitor_id: visitorId,
      click_timestamp: new Date().toISOString(),
    });

    if (error) {
      console.error('Failed to log affiliate click:', error.message);
    }
  }

  /**
   * Log conversion event when visitor completes an action on affiliate site
   */
  async logConversion(
    videoId: string,
    affiliateId: string,
    visitorCountry: string,
    conversionValue: number,
    conversionType: string,
    visitorId?: string
  ): Promise<void> {
    const { error } = await this.supabase.from('aquier_conversion_events').insert({
      video_id: videoId,
      affiliate_id: affiliateId,
      visitor_country: visitorCountry,
      visitor_id: visitorId,
      conversion_value: conversionValue,
      conversion_type: conversionType,
      timestamp: new Date().toISOString(),
      attribution_chain: JSON.stringify({
        source: 'aquier_landing',
        video_id: videoId,
      }),
    });

    if (error) {
      console.error('Failed to log conversion:', error.message);
    }
  }

  /**
   * Get landing page performance metrics
   */
  async getLandingPageMetrics(
    videoId: string
  ): Promise<{
    views: number;
    clicks: number;
    conversions: number;
    conversionRate: number;
    averageConversionValue: number;
  }> {
    const { data: events, error: eventsError } = await this.supabase
      .from('aquier_landing_events')
      .select('id')
      .eq('video_id', videoId);

    const { data: clicks, error: clicksError } = await this.supabase
      .from('aquier_affiliate_clicks')
      .select('id')
      .eq('video_id', videoId);

    const { data: conversions, error: conversionsError } = await this.supabase
      .from('aquier_conversion_events')
      .select('conversion_value')
      .eq('video_id', videoId);

    if (eventsError || clicksError || conversionsError) {
      console.error('Failed to fetch metrics:', eventsError?.message || clicksError?.message);
      return {
        views: 0,
        clicks: 0,
        conversions: 0,
        conversionRate: 0,
        averageConversionValue: 0,
      };
    }

    const viewCount = events?.length || 0;
    const clickCount = clicks?.length || 0;
    const conversionCount = conversions?.length || 0;
    const totalConversionValue =
      conversions?.reduce((sum, c) => sum + (c.conversion_value || 0), 0) || 0;

    return {
      views: viewCount,
      clicks: clickCount,
      conversions: conversionCount,
      conversionRate: viewCount > 0 ? (clickCount / viewCount) * 100 : 0,
      averageConversionValue: conversionCount > 0 ? totalConversionValue / conversionCount : 0,
    };
  }
}

/**
 * Factory function to create AquierLandingMapper instance
 */
export function createAquierLandingMapper(supabase: SupabaseClient): AquierLandingMapper {
  return new AquierLandingMapper(supabase);
}
