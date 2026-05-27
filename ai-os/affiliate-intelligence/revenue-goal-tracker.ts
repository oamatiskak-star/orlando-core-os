/**
 * Revenue Goal Tracker
 * Manages revenue targets, tracks actuals, and calculates performance metrics
 */

export interface RevenueGoal {
  goal_id: string
  period: 'monthly' | 'quarterly' | 'yearly'
  start_date: Date
  end_date: Date
  target_amount: number
  currency: string
  target_type: 'total_revenue' | 'affiliate_revenue' | 'membership_revenue' | 'by_affiliate' | 'by_channel' | 'by_country'
  target_entity_id?: string // affiliate_id, channel_id, or country_code if applicable
  created_at: Date
  updated_at: Date
  is_active: boolean
}

export interface RevenueMetrics {
  period_start: Date
  period_end: Date
  actual_revenue: number
  target_revenue: number
  variance: number
  variance_percentage: number
  performance_status: 'exceeding' | 'on_track' | 'at_risk' | 'behind'
  projected_final: number
  days_elapsed: number
  days_remaining: number
  daily_run_rate: number
  required_daily_rate: number
}

export interface AffiliatePerformance {
  affiliate_id: string
  affiliate_name: string
  total_revenue: number
  total_clicks: number
  total_conversions: number
  conversion_rate: number
  epc: number
  ctr: number
  roi: number
  performance_rank: number
  trend: 'improving' | 'stable' | 'declining'
  recommendation: 'keep' | 'optimize' | 'replace' | 'expand'
}

export interface ChannelPerformance {
  channel_id: string
  channel_name: string
  total_revenue: number
  total_affiliates: number
  avg_epc: number
  top_affiliate: string
  conversion_rate: number
  growth_rate: number
  performance_rank: number
  roi: number
}

export interface CountryPerformance {
  country_code: string
  country_name: string
  total_revenue: number
  total_clicks: number
  conversion_rate: number
  epc: number
  top_affiliate: string
  top_content_type: string
  growth_potential: 'high' | 'medium' | 'low'
  performance_rank: number
  priority: number
}

export interface ContentTypePerformance {
  content_type: string
  total_revenue: number
  total_views: number
  avg_conversion_rate: number
  avg_epc: number
  top_channel: string
  top_affiliate: string
  trend: 'trending_up' | 'stable' | 'trending_down'
}

export interface OpportunityAnalysis {
  opportunity_id: string
  type: 'underperforming_affiliate' | 'new_affiliate_potential' | 'new_country' | 'content_gap' | 'seasonal_trend'
  title: string
  description: string
  potential_revenue: number
  confidence_score: number
  action_items: string[]
  priority: 'critical' | 'high' | 'medium' | 'low'
}

export class RevenueGoalTracker {
  /**
   * Calculate revenue metrics for a goal period
   */
  calculateMetrics(goal: RevenueGoal, actualRevenue: number, currentDate: Date = new Date()): RevenueMetrics {
    const periodStart = goal.start_date
    const periodEnd = goal.end_date
    const totalDays = Math.ceil((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24))
    const daysElapsed = Math.ceil((currentDate.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24))
    const daysRemaining = Math.max(0, totalDays - daysElapsed)

    const variance = actualRevenue - goal.target_amount
    const variancePercentage = (variance / goal.target_amount) * 100
    const dailyRunRate = daysElapsed > 0 ? actualRevenue / daysElapsed : 0
    const requiredDailyRate = daysRemaining > 0 ? (goal.target_amount - actualRevenue) / daysRemaining : 0

    // Project final revenue based on current run rate
    const projectedFinal = dailyRunRate * totalDays

    // Determine performance status
    let performanceStatus: 'exceeding' | 'on_track' | 'at_risk' | 'behind' = 'on_track'
    const progressTarget = (daysElapsed / totalDays) * goal.target_amount
    const expectedAtThisPoint = progressTarget

    if (actualRevenue >= goal.target_amount) {
      performanceStatus = 'exceeding'
    } else if (actualRevenue >= expectedAtThisPoint * 0.95) {
      performanceStatus = 'on_track'
    } else if (actualRevenue >= expectedAtThisPoint * 0.85) {
      performanceStatus = 'at_risk'
    } else {
      performanceStatus = 'behind'
    }

    return {
      period_start: periodStart,
      period_end: periodEnd,
      actual_revenue: actualRevenue,
      target_revenue: goal.target_amount,
      variance,
      variance_percentage: variancePercentage,
      performance_status: performanceStatus,
      projected_final: projectedFinal,
      days_elapsed: daysElapsed,
      days_remaining: daysRemaining,
      daily_run_rate: dailyRunRate,
      required_daily_rate: requiredDailyRate,
    }
  }

  /**
   * Identify underperforming affiliates
   */
  identifyUnderperformers(
    affiliates: AffiliatePerformance[],
    roiThreshold: number = 1.5
  ): AffiliatePerformance[] {
    return affiliates
      .filter((aff) => aff.roi < roiThreshold || aff.trend === 'declining')
      .sort((a, b) => a.roi - b.roi)
  }

  /**
   * Identify high-performing affiliates
   */
  identifyTopPerformers(affiliates: AffiliatePerformance[], topN: number = 5): AffiliatePerformance[] {
    return affiliates.sort((a, b) => b.roi - a.roi).slice(0, topN)
  }

  /**
   * Recommend affiliate actions based on performance
   */
  getAffiliateRecommendations(performance: AffiliatePerformance[]): Map<string, string> {
    const recommendations = new Map<string, string>()

    performance.forEach((aff) => {
      if (aff.roi > 3 && aff.trend === 'improving') {
        recommendations.set(aff.affiliate_id, 'expand')
      } else if (aff.roi > 2) {
        recommendations.set(aff.affiliate_id, 'keep')
      } else if (aff.roi > 1 && aff.trend === 'stable') {
        recommendations.set(aff.affiliate_id, 'optimize')
      } else if (aff.roi < 1 && aff.trend === 'declining') {
        recommendations.set(aff.affiliate_id, 'replace')
      } else {
        recommendations.set(aff.affiliate_id, 'optimize')
      }
    })

    return recommendations
  }

  /**
   * Calculate channel performance ranking
   */
  rankChannelsByPerformance(channels: ChannelPerformance[]): ChannelPerformance[] {
    return channels.sort((a, b) => b.roi - a.roi)
  }

  /**
   * Calculate country performance ranking
   */
  rankCountriesByPerformance(countries: CountryPerformance[]): CountryPerformance[] {
    return countries.sort((a, b) => b.total_revenue - a.total_revenue)
  }

  /**
   * Calculate content type performance
   */
  rankContentTypesByPerformance(contentTypes: ContentTypePerformance[]): ContentTypePerformance[] {
    return contentTypes.sort((a, b) => b.avg_epc * b.total_views - a.avg_epc * a.total_views)
  }

  /**
   * Calculate MRR (Monthly Recurring Revenue)
   */
  calculateMRR(monthlyRevenue: number[]): number {
    if (monthlyRevenue.length === 0) return 0
    return monthlyRevenue[monthlyRevenue.length - 1]
  }

  /**
   * Calculate ARR (Annual Recurring Revenue)
   */
  calculateARR(monthlyRecurringRevenue: number): number {
    return monthlyRecurringRevenue * 12
  }

  /**
   * Calculate growth rate
   */
  calculateGrowthRate(previous: number, current: number): number {
    if (previous === 0) return 0
    return ((current - previous) / previous) * 100
  }

  /**
   * Analyze seasonal trends
   */
  analyzeSeasonalTrends(monthlyData: { month: number; revenue: number }[]): {
    peak_months: number[]
    low_months: number[]
    seasonal_pattern: string
  } {
    if (monthlyData.length < 3) {
      return {
        peak_months: [],
        low_months: [],
        seasonal_pattern: 'insufficient_data',
      }
    }

    const avgRevenue = monthlyData.reduce((sum, m) => sum + m.revenue, 0) / monthlyData.length
    const peakMonths = monthlyData.filter((m) => m.revenue > avgRevenue * 1.2).map((m) => m.month)
    const lowMonths = monthlyData.filter((m) => m.revenue < avgRevenue * 0.8).map((m) => m.month)

    let seasonalPattern = 'stable'
    if (peakMonths.length > 0 && lowMonths.length > 0) {
      seasonalPattern = 'seasonal'
    } else if (monthlyData[monthlyData.length - 1].revenue > monthlyData[0].revenue) {
      seasonalPattern = 'growing'
    } else if (monthlyData[monthlyData.length - 1].revenue < monthlyData[0].revenue) {
      seasonalPattern = 'declining'
    }

    return {
      peak_months: peakMonths,
      low_months: lowMonths,
      seasonal_pattern: seasonalPattern,
    }
  }

  /**
   * Identify opportunities based on performance data
   */
  identifyOpportunities(
    allAffiliates: AffiliatePerformance[],
    allCountries: CountryPerformance[],
    contentTypes: ContentTypePerformance[]
  ): OpportunityAnalysis[] {
    const opportunities: OpportunityAnalysis[] = []

    // Identify underperforming affiliates to replace
    const underperformers = this.identifyUnderperformers(allAffiliates)
    underperformers.forEach((aff) => {
      opportunities.push({
        opportunity_id: `opp_underperf_${aff.affiliate_id}`,
        type: 'underperforming_affiliate',
        title: `Underperforming Affiliate: ${aff.affiliate_name}`,
        description: `${aff.affiliate_name} has ROI of ${aff.roi.toFixed(2)}x and is ${aff.trend === 'declining' ? 'declining' : 'stagnant'}`,
        potential_revenue: 0,
        confidence_score: 0.8,
        action_items: [
          'Review affiliate's marketing approach',
          'Compare with top performers in same category',
          'Consider replacing with higher-performing alternative',
        ],
        priority: aff.roi < 1 ? 'critical' : 'high',
      })
    })

    // Identify high-potential countries with low penetration
    const lowPenetrationCountries = allCountries.filter((c) => c.total_revenue < 5000)
    lowPenetrationCountries.forEach((country) => {
      opportunities.push({
        opportunity_id: `opp_country_${country.country_code}`,
        type: 'new_country',
        title: `Expand to ${country.country_name}`,
        description: `${country.country_name} has growth potential but low current revenue (${country.total_revenue})`,
        potential_revenue: country.total_revenue * 10, // 10x potential estimate
        confidence_score: 0.6,
        action_items: [
          'Localize content for ${country.country_name}',
          'Target country-specific affiliates',
          'Test new content types in this market',
        ],
        priority: country.growth_potential === 'high' ? 'high' : 'medium',
      })
    })

    // Identify trending content types
    const trendingContent = contentTypes.filter((c) => c.trend === 'trending_up')
    trendingContent.forEach((content) => {
      opportunities.push({
        opportunity_id: `opp_content_${content.content_type}`,
        type: 'content_gap',
        title: `Expand ${content.content_type} Content`,
        description: `${content.content_type} is trending and generating ${content.avg_epc.toFixed(2)} EPC`,
        potential_revenue: content.total_views * content.avg_conversion_rate * content.avg_epc,
        confidence_score: 0.9,
        action_items: ['Create more ${content.content_type} content', 'Allocate more resources to this type'],
        priority: 'high',
      })
    })

    return opportunities.sort((a, b) => b.confidence_score - a.confidence_score)
  }

  /**
   * Calculate affiliate replacement recommendations
   */
  calculateReplacementScore(current: AffiliatePerformance, alternative: AffiliatePerformance): number {
    // Score should indicate how much better the alternative is
    const roiImprovement = (alternative.roi / current.roi - 1) * 40
    const conversionImprovement = (alternative.conversion_rate / current.conversion_rate - 1) * 30
    const epcImprovement = (alternative.epc / current.epc - 1) * 30

    return Math.max(0, roiImprovement + conversionImprovement + epcImprovement)
  }
}

/**
 * Create a new revenue goal tracker instance
 */
export function createRevenueGoalTracker(): RevenueGoalTracker {
  return new RevenueGoalTracker()
}
