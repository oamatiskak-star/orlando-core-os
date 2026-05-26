import { PerformanceMetrics, AffiliateChannelMapping } from './types';

export interface PerformanceHistoryDatabase {
  metrics: PerformanceMetrics[];
}

export class PerformanceScorer {
  private mockDatabase: PerformanceHistoryDatabase = {
    metrics: [
      // TradingView metrics
      {
        affiliate_id: 'tradingview',
        channel_id: 'vermogentv',
        content_type: 'educational',
        country: 'NL',
        ctr: 0.045,
        conversion_rate: 0.08,
        epc: 12.5,
        rpm: 8.5,
        roi: 3.2,
        sample_size: 450,
        last_updated: new Date(),
      },
      {
        affiliate_id: 'tradingview',
        channel_id: 'cryptovermogen',
        content_type: 'tutorial',
        country: 'US',
        ctr: 0.065,
        conversion_rate: 0.12,
        epc: 15.0,
        rpm: 12.5,
        roi: 5.1,
        sample_size: 800,
        last_updated: new Date(),
      },

      // Binance metrics
      {
        affiliate_id: 'binance',
        channel_id: 'cryptovermogen',
        content_type: 'review',
        country: 'DE',
        ctr: 0.08,
        conversion_rate: 0.15,
        epc: 18.0,
        rpm: 15.0,
        roi: 6.2,
        sample_size: 600,
        last_updated: new Date(),
      },

      // Interactive Brokers metrics
      {
        affiliate_id: 'interactive-brokers',
        channel_id: 'beleggingstv',
        content_type: 'educational',
        country: 'NL',
        ctr: 0.025,
        conversion_rate: 0.18,
        epc: 35.0,
        rpm: 5.5,
        roi: 4.8,
        sample_size: 250,
        last_updated: new Date(),
      },

      // Shopify metrics
      {
        affiliate_id: 'shopify',
        channel_id: 'vermogentv',
        content_type: 'tutorial',
        country: 'US',
        ctr: 0.035,
        conversion_rate: 0.06,
        epc: 25.0,
        rpm: 6.2,
        roi: 3.5,
        sample_size: 320,
        last_updated: new Date(),
      },

      // Fundrise metrics
      {
        affiliate_id: 'fundrise',
        channel_id: 'vastgoedtv',
        content_type: 'educational',
        country: 'NL',
        ctr: 0.03,
        conversion_rate: 0.09,
        epc: 20.0,
        rpm: 7.2,
        roi: 4.1,
        sample_size: 280,
        last_updated: new Date(),
      },
    ],
  };

  /**
   * Get historical performance for affiliate
   */
  getPerformanceMetrics(
    affiliateId: string,
    channelId?: string,
    contentType?: string
  ): PerformanceMetrics[] {
    let metrics = this.mockDatabase.metrics.filter(
      (m) => m.affiliate_id.toLowerCase() === affiliateId.toLowerCase()
    );

    if (channelId) {
      metrics = metrics.filter((m) => m.channel_id === channelId);
    }

    if (contentType) {
      metrics = metrics.filter((m) => m.content_type === contentType);
    }

    return metrics;
  }

  /**
   * Calculate performance score for an affiliate (0-100)
   * Based on CTR, conversion rate, EPC, and ROI
   */
  calculatePerformanceScore(metrics: PerformanceMetrics): number {
    if (!metrics) return 0;

    // Normalize metrics to 0-100 scale
    // CTR: typically 0-10%, normalize to 100
    const ctrScore = Math.min(100, (metrics.ctr / 0.1) * 100);

    // Conversion rate: typically 0-20%, normalize to 100
    const conversionScore = Math.min(100, (metrics.conversion_rate / 0.2) * 100);

    // EPC: varies widely, but typical range is $5-$50
    const epcScore = Math.min(100, (metrics.epc / 50) * 100);

    // ROI: typically 1-10x, normalize
    const roiScore = Math.min(100, (metrics.roi / 10) * 100);

    // RPM: typically $0-$20
    const rpmScore = Math.min(100, (metrics.rpm / 20) * 100);

    // Weighted average: CTR 20%, conversion 30%, EPC 25%, ROI 15%, RPM 10%
    const score =
      ctrScore * 0.2 +
      conversionScore * 0.3 +
      epcScore * 0.25 +
      roiScore * 0.15 +
      rpmScore * 0.1;

    return Math.round(Math.max(0, Math.min(100, score)));
  }

  /**
   * Calculate average performance score across all metrics
   */
  calculateAveragePerformanceScore(affiliateId: string, channelId?: string): number {
    const metrics = this.getPerformanceMetrics(affiliateId, channelId);

    if (metrics.length === 0) {
      return 50; // default middle score if no data
    }

    const scores = metrics.map((m) => this.calculatePerformanceScore(m));
    const average = scores.reduce((a, b) => a + b, 0) / scores.length;

    return Math.round(average);
  }

  /**
   * Get the best performing metric for a given affiliate/channel
   */
  getBestPerformingMetric(affiliateId: string, channelId: string): PerformanceMetrics | null {
    const metrics = this.getPerformanceMetrics(affiliateId, channelId);

    if (metrics.length === 0) return null;

    let best = metrics[0];
    let bestScore = this.calculatePerformanceScore(metrics[0]);

    for (const metric of metrics) {
      const score = this.calculatePerformanceScore(metric);
      if (score > bestScore) {
        bestScore = score;
        best = metric;
      }
    }

    return best;
  }

  /**
   * Get average EPC for affiliate (earnings per click)
   */
  getAverageEpc(affiliateId: string, channelId?: string): number {
    const metrics = this.getPerformanceMetrics(affiliateId, channelId);

    if (metrics.length === 0) return 0;

    const totalEpc = metrics.reduce((sum, m) => sum + m.epc, 0);
    return totalEpc / metrics.length;
  }

  /**
   * Get average conversion rate for affiliate
   */
  getAverageConversionRate(affiliateId: string, channelId?: string): number {
    const metrics = this.getPerformanceMetrics(affiliateId, channelId);

    if (metrics.length === 0) return 0;

    const totalRate = metrics.reduce((sum, m) => sum + m.conversion_rate, 0);
    return totalRate / metrics.length;
  }

  /**
   * Compare two affiliates' performance
   */
  compareAffiliates(
    affiliateId1: string,
    affiliateId2: string,
    channelId: string
  ): { affiliate1_score: number; affiliate2_score: number; winner: string } {
    const score1 = this.calculateAveragePerformanceScore(affiliateId1, channelId);
    const score2 = this.calculateAveragePerformanceScore(affiliateId2, channelId);

    return {
      affiliate1_score: score1,
      affiliate2_score: score2,
      winner: score1 > score2 ? affiliateId1 : score2 > score1 ? affiliateId2 : 'tie',
    };
  }

  /**
   * Rank affiliates by performance score
   */
  rankAffiliatesByPerformance(
    affiliates: AffiliateChannelMapping[],
    channelId: string
  ): { affiliate: AffiliateChannelMapping; performance_score: number }[] {
    return affiliates
      .map((aff) => ({
        affiliate: aff,
        performance_score: this.calculateAveragePerformanceScore(aff.affiliate_id, channelId),
      }))
      .sort((a, b) => b.performance_score - a.performance_score);
  }

  /**
   * Check if affiliate has sufficient performance data
   */
  hasSufficientData(affiliateId: string, channelId?: string, minSampleSize: number = 100): boolean {
    const metrics = this.getPerformanceMetrics(affiliateId, channelId);

    if (metrics.length === 0) return false;

    return metrics.every((m) => m.sample_size >= minSampleSize);
  }

  /**
   * Get confidence level based on data availability
   */
  getDataConfidence(affiliateId: string, channelId?: string): 'high' | 'medium' | 'low' {
    const metrics = this.getPerformanceMetrics(affiliateId, channelId);

    if (metrics.length === 0) return 'low';

    const totalSampleSize = metrics.reduce((sum, m) => sum + m.sample_size, 0);

    if (totalSampleSize >= 1000) return 'high';
    if (totalSampleSize >= 300) return 'medium';
    return 'low';
  }

  /**
   * Add or update performance metrics (for future use)
   */
  addPerformanceMetrics(metrics: PerformanceMetrics): void {
    this.mockDatabase.metrics.push(metrics);
  }

  /**
   * Get expected revenue for an affiliate recommendation
   */
  estimateExpectedRevenue(
    affiliateId: string,
    channelId: string,
    estimatedViews: number = 10000
  ): { estimated_clicks: number; estimated_conversions: number; estimated_revenue: number } {
    const metrics = this.getBestPerformingMetric(affiliateId, channelId);

    if (!metrics) {
      return {
        estimated_clicks: 0,
        estimated_conversions: 0,
        estimated_revenue: 0,
      };
    }

    // Estimate based on RPM and views
    const estimated_revenue = (estimatedViews / 1000) * metrics.rpm;

    // Work backward from RPM to estimate clicks and conversions
    // RPM = (conversions * EPC) / (views / 1000)
    // So: conversions = (RPM * views / 1000) / EPC
    const estimated_conversions = Math.round((estimated_revenue) / metrics.epc);
    const estimated_clicks = Math.round(estimated_conversions / metrics.conversion_rate);

    return {
      estimated_clicks,
      estimated_conversions,
      estimated_revenue: Math.round(estimated_revenue * 100) / 100,
    };
  }
}
