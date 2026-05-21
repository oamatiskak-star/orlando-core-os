import { ScraperBase } from '../lib/scraper-base'
import { ScraperConfig, ScraperResult } from '../lib/types'
import { logger } from '../lib/logger'
import { supabase } from '../lib/supabase'

/**
 * Opportunity Scoring & Portfolio Analysis
 * Combines all enrichment data into comprehensive investment opportunity rankings
 *
 * Analyzes deals across dimensions:
 * - Risk-adjusted returns (valuation + market + ROI data)
 * - Environmental & structural risk (combined score from multiple sources)
 * - Market momentum (demand trends, appreciation, time-on-market)
 * - Neighborhood liveability and growth potential
 * - Portfolio diversification recommendations
 *
 * Rate limit: 500 req/hour (read-only aggregation)
 * Batch: processes all pending-score deals
 */

interface DealEnrichment {
  id: string
  address: string
  city: string
  asking_price: number
  area_m2?: number

  // From PropertyValuationScraper
  valuation?: {
    roi_score?: number
    estimated_annual_yield?: number
    investment_grade?: string
    confidence_score?: number
  }

  // From EnvironmentalRiskScraper
  environmental_risk?: {
    overall_risk_score?: number
    risk_level?: string
  }

  // From NeighborhoodAnalyticsScraper
  neighborhood?: {
    liveability_score?: number
    demand_trend?: string
  }

  // From MarketAnalysisScraper
  market?: {
    investment_score?: number
    sentiment?: string
  }

  // From BuildingInspectionScraper
  building_risk?: {
    safety_score?: number
    risk_level?: string
  }

  // From SpatialPlanningScraper
  spatial?: {
    development_potential?: number
  }
}

interface OpportunityScoringResult {
  deal_id: string
  address: string
  city: string

  // Composite scores
  overall_opportunity_score: number // 0-100
  risk_adjusted_return_score: number // 0-100
  environmental_risk_score: number // 0-100
  structural_integrity_score: number // 0-100
  market_momentum_score: number // 0-100
  neighborhood_quality_score: number // 0-100

  // Grade and recommendation
  investment_grade: 'AAA' | 'AA' | 'A' | 'BBB' | 'BB' | 'B' | 'CCC'
  recommendation: 'strong_buy' | 'buy' | 'hold' | 'sell' | 'avoid'
  risk_level: 'critical' | 'high' | 'medium' | 'low' | 'minimal'

  // Key metrics
  estimated_annual_return?: number // percentage
  payback_period_years?: number
  risk_adjusted_roi?: number // percentage

  // Strengths and weaknesses
  key_strengths: string[]
  key_risks: string[]
  growth_potential?: string

  // Portfolio context
  portfolio_fit?: string
  diversification_category?: string

  // Detailed breakdown
  score_breakdown: {
    valuation_fit: number
    risk_assessment: number
    market_potential: number
    neighborhood_appeal: number
    structural_condition: number
    growth_trajectory: number
  }
}

class OpportunityScoringWorker extends ScraperBase {
  constructor() {
    const config: ScraperConfig = {
      name: 'opportunity-scoring',
      rateLimitPerHour: 500,
      retryAttempts: 2,
      retryDelayMs: 500,
      timeoutMs: 15000,
      domain: 'internal-aggregation',
    }
    super(config)
  }

  async run(): Promise<ScraperResult> {
    const start = Date.now()

    try {
      // Fetch deals with all enrichment data
      const dealsWithEnrichment = await this.fetchDealsWithEnrichment()
      if (dealsWithEnrichment.length === 0) {
        return {
          success: true,
          itemsFound: 0,
          itemsInserted: 0,
          itemsSkipped: 0,
          duration_ms: Date.now() - start,
        }
      }

      // Calculate opportunity scores
      const scores: OpportunityScoringResult[] = []
      for (let i = 0; i < dealsWithEnrichment.length; i++) {
        const deal = dealsWithEnrichment[i]
        try {
          const score = this.calculateOpportunityScore(deal)
          if (score) {
            scores.push(score)
          }
          // Rate limiting between calculations
          if (i < dealsWithEnrichment.length - 1) {
            await this.sleep(300)
          }
        } catch (err) {
          logger.warn(`Failed to score opportunity for ${deal.address}`, {
            error: String(err),
          })
        }
      }

      // Insert/update scores to database
      const { inserted } = await this.insertOpportunityScores(scores)

      return {
        success: true,
        itemsFound: dealsWithEnrichment.length,
        itemsInserted: inserted,
        itemsSkipped: dealsWithEnrichment.length - inserted,
        duration_ms: Date.now() - start,
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error('OpportunityScoringScraper error', { error: message })
      return {
        success: false,
        itemsFound: 0,
        itemsInserted: 0,
        itemsSkipped: 0,
        duration_ms: Date.now() - start,
        error: message,
      }
    }
  }

  /**
   * Fetch deals with all enrichment data from related tables
   */
  private async fetchDealsWithEnrichment(): Promise<DealEnrichment[]> {
    const { data, error } = await supabase
      .from('acq_deals')
      .select(`
        id, address, city, asking_price, area_m2,
        acq_property_valuations(roi_score, estimated_annual_yield, investment_grade, confidence_score),
        acq_environmental_risk(overall_risk_score, risk_level),
        acq_neighborhood_analytics(liveability_score, demand_trend),
        acq_market_analysis(investment_score, sentiment),
        acq_building_inspections(safety_score, risk_level),
        acq_spatial_planning(development_potential)
      `)
      .eq('pipeline_stage', 'leads')
      .order('created_at', { ascending: true })
      .limit(50)

    if (error) {
      logger.error('Failed to fetch deals with enrichment', { error: error.message })
      return []
    }

    // Parse nested data structure
    return (data || []).map((d: any) => ({
      id: d.id,
      address: d.address,
      city: d.city,
      asking_price: d.asking_price,
      area_m2: d.area_m2,
      valuation: d.acq_property_valuations?.[0],
      environmental_risk: d.acq_environmental_risk?.[0],
      neighborhood: d.acq_neighborhood_analytics?.[0],
      market: d.acq_market_analysis?.[0],
      building_risk: d.acq_building_inspections?.[0],
      spatial: d.acq_spatial_planning?.[0],
    }))
  }

  /**
   * Calculate comprehensive opportunity score
   */
  private calculateOpportunityScore(deal: DealEnrichment): OpportunityScoringResult | null {
    try {
      // Component scores (0-100)
      const valuationFit = this.scoreValuation(deal)
      const riskAssessment = this.scoreRisk(deal)
      const marketPotential = this.scoreMarketPotential(deal)
      const neighborhoodAppeal = this.scoreNeighborhood(deal)
      const structuralCondition = this.scoreStructure(deal)
      const growthTrajectory = this.scoreGrowth(deal)

      // Weights: risk-adjusted return focus
      const weights = {
        valuation: 0.25,
        risk: 0.25,
        market: 0.20,
        neighborhood: 0.15,
        structure: 0.10,
        growth: 0.05,
      }

      // Overall opportunity score
      const opportunityScore = Math.round(
        valuationFit * weights.valuation +
          marketPotential * weights.market +
          neighborhoodAppeal * weights.neighborhood +
          growthTrajectory * weights.growth
      )

      // Risk-adjusted score (emphasize risk)
      const riskAdjustedScore = Math.round(
        (opportunityScore * (100 - riskAssessment)) / 100 +
          structuralCondition * weights.structure
      )

      // Generate investment grade
      const investmentGrade = this.gradeInvestment(riskAdjustedScore, riskAssessment)

      // Generate recommendation
      const recommendation = this.getRecommendation(riskAdjustedScore, riskAssessment)

      // Generate key insights
      const strengths = this.identifyStrengths(deal, valuationFit, marketPotential, neighborhoodAppeal)
      const risks = this.identifyRisks(deal, riskAssessment, structuralCondition)

      // Calculate financial metrics
      const annualYield = deal.valuation?.estimated_annual_yield || 4
      const paybackPeriod = annualYield > 0 ? 100 / annualYield : undefined
      const riskAdjustedROI = (annualYield * (100 - riskAssessment)) / 100

      // Determine portfolio context
      const diversificationCategory = this.determineDiversification(deal)
      const portfolioFit = this.assessPortfolioFit(deal, investmentGrade)

      const result: OpportunityScoringResult = {
        deal_id: deal.id,
        address: deal.address,
        city: deal.city,
        overall_opportunity_score: opportunityScore,
        risk_adjusted_return_score: riskAdjustedScore,
        environmental_risk_score: 100 - (deal.environmental_risk?.overall_risk_score || 50),
        structural_integrity_score: structuralCondition,
        market_momentum_score: marketPotential,
        neighborhood_quality_score: neighborhoodAppeal,
        investment_grade: investmentGrade,
        recommendation,
        risk_level: riskAssessment > 80 ? 'critical' : riskAssessment > 60 ? 'high' : riskAssessment > 40 ? 'medium' : riskAssessment > 20 ? 'low' : 'minimal',
        estimated_annual_return: Math.round(annualYield * 10) / 10,
        payback_period_years: paybackPeriod ? Math.round(paybackPeriod * 10) / 10 : undefined,
        risk_adjusted_roi: Math.round(riskAdjustedROI * 10) / 10,
        key_strengths: strengths,
        key_risks: risks,
        growth_potential: growthTrajectory > 70 ? 'high' : growthTrajectory > 50 ? 'moderate' : 'limited',
        portfolio_fit: portfolioFit,
        diversification_category: diversificationCategory,
        score_breakdown: {
          valuation_fit: valuationFit,
          risk_assessment: riskAssessment,
          market_potential: marketPotential,
          neighborhood_appeal: neighborhoodAppeal,
          structural_condition: structuralCondition,
          growth_trajectory: growthTrajectory,
        },
      }

      return result
    } catch (err) {
      logger.warn(`Error calculating score for ${deal.address}`, {
        error: String(err),
      })
      return null
    }
  }

  private scoreValuation(deal: DealEnrichment): number {
    if (!deal.valuation) return 50

    const roiScore = deal.valuation.roi_score || 50
    const confidenceBoost = (deal.valuation.confidence_score || 50) / 100

    return Math.round(roiScore * confidenceBoost + 50 * (1 - confidenceBoost))
  }

  private scoreRisk(deal: DealEnrichment): number {
    let riskScore = 50

    if (deal.environmental_risk?.overall_risk_score) {
      riskScore = (riskScore + deal.environmental_risk.overall_risk_score) / 2
    }

    if (deal.building_risk?.safety_score) {
      riskScore = (riskScore + (100 - deal.building_risk.safety_score)) / 2
    }

    return Math.round(riskScore)
  }

  private scoreMarketPotential(deal: DealEnrichment): number {
    let marketScore = 50

    if (deal.market?.investment_score) {
      marketScore = deal.market.investment_score
    }

    const sentimentBoost =
      deal.market?.sentiment === 'bullish' ? 10 : deal.market?.sentiment === 'bearish' ? -10 : 0

    return Math.max(0, Math.min(100, marketScore + sentimentBoost))
  }

  private scoreNeighborhood(deal: DealEnrichment): number {
    return deal.neighborhood?.liveability_score || 50
  }

  private scoreStructure(deal: DealEnrichment): number {
    return deal.building_risk?.safety_score || 70
  }

  private scoreGrowth(deal: DealEnrichment): number {
    let growthScore = 50

    if (deal.spatial?.development_potential) {
      growthScore = deal.spatial.development_potential
    }

    if (deal.neighborhood?.demand_trend === 'increasing') {
      growthScore = Math.min(100, growthScore + 15)
    } else if (deal.neighborhood?.demand_trend === 'decreasing') {
      growthScore = Math.max(0, growthScore - 15)
    }

    return Math.round(growthScore)
  }

  private gradeInvestment(score: number, riskScore: number): 'AAA' | 'AA' | 'A' | 'BBB' | 'BB' | 'B' | 'CCC' {
    if (score >= 85 && riskScore <= 30) return 'AAA'
    if (score >= 80 && riskScore <= 40) return 'AA'
    if (score >= 75 && riskScore <= 50) return 'A'
    if (score >= 65 && riskScore <= 60) return 'BBB'
    if (score >= 55 && riskScore <= 70) return 'BB'
    if (score >= 45) return 'B'
    return 'CCC'
  }

  private getRecommendation(
    score: number,
    riskScore: number
  ): 'strong_buy' | 'buy' | 'hold' | 'sell' | 'avoid' {
    if (riskScore > 80) return 'avoid'
    if (score >= 80) return 'strong_buy'
    if (score >= 65) return 'buy'
    if (score >= 50) return 'hold'
    return 'sell'
  }

  private identifyStrengths(
    deal: DealEnrichment,
    valuationFit: number,
    marketPotential: number,
    neighborhoodAppeal: number
  ): string[] {
    const strengths: string[] = []

    if (valuationFit > 70) strengths.push('Strong valuation alignment')
    if (deal.valuation?.investment_grade === 'A')
      strengths.push('Premium investment grade')
    if (marketPotential > 70) strengths.push('Bullish market momentum')
    if (deal.market?.sentiment === 'bullish') strengths.push('Market sentiment positive')
    if (neighborhoodAppeal > 70) strengths.push('High neighborhood appeal')
    if (deal.neighborhood?.demand_trend === 'increasing')
      strengths.push('Rising neighborhood demand')
    if (deal.spatial?.development_potential && deal.spatial.development_potential > 60)
      strengths.push('Good development potential')

    return strengths.slice(0, 4)
  }

  private identifyRisks(
    deal: DealEnrichment,
    riskScore: number,
    structuralCondition: number
  ): string[] {
    const risks: string[] = []

    if (riskScore > 70) risks.push('Elevated environmental risk')
    if (deal.environmental_risk?.risk_level === 'high')
      risks.push('High environmental exposure')
    if (structuralCondition < 60) risks.push('Structural concerns identified')
    if (deal.building_risk?.risk_level === 'high') risks.push('Safety issues present')
    if (deal.market?.sentiment === 'bearish') risks.push('Bearish market outlook')
    if (!deal.valuation) risks.push('Incomplete valuation data')

    return risks.slice(0, 4)
  }

  private determineDiversification(deal: DealEnrichment): string {
    if (!deal.area_m2) return 'unknown'
    if (deal.area_m2 < 100) return 'small_residential'
    if (deal.area_m2 < 300) return 'medium_residential'
    if (deal.area_m2 < 1000) return 'large_residential'
    return 'commercial'
  }

  private assessPortfolioFit(deal: DealEnrichment, grade: string): string {
    if (grade === 'AAA' || grade === 'AA') return 'Core holding — stable income'
    if (grade === 'A' || grade === 'BBB') return 'Growth allocation — appreciation focus'
    if (grade === 'BB' || grade === 'B') return 'Opportunistic play — requires monitoring'
    return 'Avoid — risk outweighs reward'
  }

  /**
   * Insert/update opportunity scores to database
   */
  private async insertOpportunityScores(scores: OpportunityScoringResult[]) {
    if (scores.length === 0) {
      return { inserted: 0, skipped: 0 }
    }

    let inserted = 0
    let skipped = 0

    for (const score of scores) {
      try {
        const { error: insertError } = await supabase
          .from('acq_opportunity_scores')
          .upsert(score, { onConflict: 'deal_id' })

        if (insertError) {
          logger.warn('Failed to insert opportunity score', {
            dealId: score.deal_id,
            error: insertError.message,
          })
          skipped++
        } else {
          // Update deal status
          try {
            await supabase
              .from('acq_deals')
              .update({ opportunity_score_status: 'completed' })
              .eq('id', score.deal_id)
          } catch (e) {
            // Ignore update errors
          }

          inserted++
        }
      } catch (err) {
        logger.warn('Error inserting opportunity score', {
          dealId: score.deal_id,
          error: String(err),
        })
        skipped++
      }
    }

    await this.recordScraperRun('OpportunityScoringScraperWorker', {
      success: inserted > 0,
      itemsFound: scores.length,
      itemsInserted: inserted,
      itemsSkipped: skipped,
      duration_ms: 0,
    })

    return { inserted, skipped }
  }
}

export async function runOpportunityScraper() {
  const scraper = new OpportunityScoringWorker()
  const result = await scraper.run()
  return {
    status: result.success ? 'ok' : 'error',
    itemsFound: result.itemsFound,
    itemsInserted: result.itemsInserted,
    itemsSkipped: result.itemsSkipped,
    error: result.error || null,
  }
}
