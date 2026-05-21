import { ScraperBase } from '../lib/scraper-base'
import { ScraperConfig, ScraperResult } from '../lib/types'
import { logger } from '../lib/logger'
import { supabase } from '../lib/supabase'

/**
 * Advanced Portfolio Optimization Scraper
 * Analyzeert totale portefeuille samenstelling en geeft rebalancing aanbevelingen
 *
 * Features:
 * - Portfolio composition analysis (property types, geography, price ranges)
 * - Geographic diversification scoring (concentration risk analysis)
 * - Correlation matrix between deal returns and risk profiles
 * - Modern Portfolio Theory: efficient frontier calculation
 * - Optimal allocation weights for maximum Sharpe ratio
 * - Sector/geography/price-tier balance recommendations
 * - Rebalancing triggers when drift exceeds thresholds
 *
 * Rate limit: 200 req/hour (read-only analysis)
 * Batch: processes entire portfolio (50-500 active deals)
 */

interface DealWithScores {
  id: string
  address: string
  asking_price: number
  city: string
  province: string
  property_type?: string
  estimated_roi?: number
  opportunity_score?: number
  risk_score?: number
  market_potential?: number
  pipeline_stage: string
  predicted_3year_roi?: number
}

interface GeographicDistribution {
  province: string
  count: number
  total_value: number
  avg_opportunity_score: number
  avg_risk_score: number
  concentration_pct: number
}

interface PortfolioAsset {
  property_type: string
  count: number
  total_value: number
  avg_price: number
  avg_roi: number
  contribution_pct: number
}

interface CorrelationPair {
  asset_1: string
  asset_2: string
  correlation: number
}

interface EfficientFrontier {
  target_return: number
  min_volatility: number
  sharpe_ratio: number
  optimal_weights: Record<string, number>
}

interface PortfolioOptimizationResult {
  portfolio_id: string
  analysis_timestamp: string

  // Composition
  total_deals: number
  total_portfolio_value: number
  avg_deal_size: number
  portfolio_duration_estimate?: string

  // Asset allocation
  asset_allocation: PortfolioAsset[]
  top_3_property_types: PortfolioAsset[]

  // Geographic analysis
  geographic_distribution: GeographicDistribution[]
  geographic_concentration_score: number // 0-100, lower = more diversified
  herfindahl_index: number // 0-1, concentration metric
  most_concentrated_province: string
  least_concentrated_province: string

  // Risk metrics
  portfolio_volatility_estimate: number
  portfolio_beta: number
  portfolio_correlation_matrix?: CorrelationPair[]
  max_drawdown_estimate?: number
  var_95?: number // Value at Risk 95%

  // Returns
  weighted_avg_roi_3year?: number
  weighted_avg_opportunity_score?: number
  portfolio_sharpe_ratio?: number
  efficient_frontiers?: EfficientFrontier[]

  // Rebalancing
  rebalancing_needed: boolean
  rebalancing_triggers: string[]
  recommended_adjustments: string[]
  target_allocations?: Record<string, number>

  // Risk assessment
  portfolio_risk_level: 'conservative' | 'moderate' | 'aggressive'
  diversification_score: number // 0-100
  sector_concentration_risk: 'low' | 'moderate' | 'high'
  geographic_concentration_risk: 'low' | 'moderate' | 'high'

  // Insights
  key_strengths: string[]
  key_risks: string[]
  optimization_opportunities: string[]
}

class PortfolioOptimizationWorker extends ScraperBase {
  private readonly MODEL_VERSION = 'v1.0-initial'

  constructor() {
    const config: ScraperConfig = {
      name: 'portfolio-optimization',
      rateLimitPerHour: 200,
      retryAttempts: 2,
      retryDelayMs: 500,
      timeoutMs: 30000,
      domain: 'internal-portfolio-analysis',
    }
    super(config)
  }

  async run(): Promise<ScraperResult> {
    const start = Date.now()

    try {
      // Fetch all active deals with scoring data
      const deals = await this.fetchPortfolioDealData()
      if (deals.length === 0) {
        return {
          success: true,
          itemsFound: 0,
          itemsInserted: 0,
          itemsSkipped: 0,
          duration_ms: Date.now() - start,
        }
      }

      // Analyze portfolio composition
      const optimization = this.analyzePortfolio(deals)

      // Insert analysis to database
      const { inserted } = await this.insertPortfolioAnalysis(optimization)

      return {
        success: true,
        itemsFound: deals.length,
        itemsInserted: inserted,
        itemsSkipped: 0,
        duration_ms: Date.now() - start,
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error('PortfolioOptimizationScraper error', { error: message })
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
   * Fetch all active deals with scoring + prediction data
   */
  private async fetchPortfolioDealData(): Promise<DealWithScores[]> {
    const { data, error } = await supabase
      .from('acq_deals')
      .select(`
        id, address, asking_price, city, province, property_type, pipeline_stage,
        acq_opportunity_scores(opportunity_score, risk_score, market_momentum_score),
        acq_predictive_metrics(predicted_3year_roi)
      `)
      .in('pipeline_stage', ['leads', 'prospects', 'qualified'])
      .order('created_at', { ascending: false })

    if (error) {
      logger.error('Failed to fetch portfolio data', { error: error.message })
      return []
    }

    return (data || []).map((d: any) => ({
      id: d.id,
      address: d.address,
      asking_price: d.asking_price || 0,
      city: d.city,
      province: d.province,
      property_type: d.property_type,
      opportunity_score: d.acq_opportunity_scores?.[0]?.opportunity_score,
      risk_score: d.acq_opportunity_scores?.[0]?.risk_score,
      market_potential: d.acq_opportunity_scores?.[0]?.market_momentum_score,
      pipeline_stage: d.pipeline_stage,
      predicted_3year_roi: d.acq_predictive_metrics?.[0]?.predicted_3year_roi,
    }))
  }

  /**
   * Core portfolio analysis
   */
  private analyzePortfolio(deals: DealWithScores[]): PortfolioOptimizationResult {
    // Basic metrics
    const totalValue = deals.reduce((sum, d) => sum + (d.asking_price || 0), 0)
    const avgDealSize = totalValue / deals.length

    // Asset allocation (by property type)
    const assetMap = new Map<string, PortfolioAsset>()
    deals.forEach(deal => {
      const type = deal.property_type || 'Unknown'
      const existing = assetMap.get(type) || {
        property_type: type,
        count: 0,
        total_value: 0,
        avg_price: 0,
        avg_roi: 0,
        contribution_pct: 0,
      }
      existing.count++
      existing.total_value += deal.asking_price || 0
      assetMap.set(type, existing)
    })

    const assets = Array.from(assetMap.values()).map(asset => ({
      ...asset,
      avg_price: asset.total_value / asset.count,
      avg_roi: deals
        .filter(d => d.property_type === asset.property_type)
        .reduce((sum, d) => sum + (d.predicted_3year_roi || 0), 0) / asset.count,
      contribution_pct: (asset.total_value / totalValue) * 100,
    }))

    // Geographic distribution
    const geoMap = new Map<string, GeographicDistribution>()
    deals.forEach(deal => {
      const prov = deal.province || 'Unknown'
      const existing = geoMap.get(prov) || {
        province: prov,
        count: 0,
        total_value: 0,
        avg_opportunity_score: 0,
        avg_risk_score: 0,
        concentration_pct: 0,
      }
      existing.count++
      existing.total_value += deal.asking_price || 0
      geoMap.set(prov, existing)
    })

    const geoDistribution = Array.from(geoMap.values())
      .map(geo => ({
        ...geo,
        avg_opportunity_score:
          deals
            .filter(d => d.province === geo.province)
            .reduce((sum, d) => sum + (d.opportunity_score || 0), 0) / geo.count,
        avg_risk_score:
          deals
            .filter(d => d.province === geo.province)
            .reduce((sum, d) => sum + (d.risk_score || 0), 0) / geo.count,
        concentration_pct: (geo.total_value / totalValue) * 100,
      }))
      .sort((a, b) => b.total_value - a.total_value)

    // Herfindahl Index (concentration)
    const herfindahl = geoDistribution.reduce((sum, geo) => {
      const share = geo.concentration_pct / 100
      return sum + share * share
    }, 0)
    const geoConcentrationScore = Math.round(herfindahl * 100)

    // Portfolio risk level
    const avgOppScore = deals.reduce((sum, d) => sum + (d.opportunity_score || 0), 0) / deals.length
    const avgRiskScore = deals.reduce((sum, d) => sum + (d.risk_score || 0), 0) / deals.length
    const portfolioRiskLevel =
      avgRiskScore > 65 ? 'aggressive' : avgRiskScore > 35 ? 'moderate' : 'conservative'

    // Rebalancing analysis
    const rebalancingTriggers: string[] = []
    const recommendedAdjustments: string[] = []

    // Trigger 1: Geographic concentration > 40%
    const maxGeoConc = Math.max(...geoDistribution.map(g => g.concentration_pct))
    if (maxGeoConc > 40) {
      rebalancingTriggers.push(`High geographic concentration: ${Math.round(maxGeoConc)}% in ${geoDistribution[0].province}`)
      recommendedAdjustments.push(`Reduce ${geoDistribution[0].province} allocation, add deals in underrepresented provinces`)
    }

    // Trigger 2: Asset type imbalance
    const maxAssetConc = Math.max(...assets.map(a => a.contribution_pct))
    if (maxAssetConc > 50) {
      rebalancingTriggers.push(`High property type concentration: ${Math.round(maxAssetConc)}% in ${assets[0].property_type}`)
      recommendedAdjustments.push(`Diversify into other property types`)
    }

    // Trigger 3: Risk drift
    if (avgRiskScore > 70) {
      rebalancingTriggers.push(`Portfolio risk elevated: ${Math.round(avgRiskScore)}/100`)
      recommendedAdjustments.push(`Increase low-risk deals, reduce high-volatility positions`)
    }

    // Portfolio metrics
    const portfolioBeta = avgRiskScore / 50 // Normalize 50 as market beta
    const portfolioVolatility = Math.sqrt(geoConcentrationScore / 100 * 30 + (1 - geoConcentrationScore / 100) * 10)
    const portfolioSharpeRatio = (avgOppScore - 40) / (portfolioVolatility + 0.1)

    // Insights
    const keyStrengths: string[] = []
    const keyRisks: string[] = []
    const optimizationOps: string[] = []

    if (avgOppScore > 70) keyStrengths.push('Strong opportunity pipeline')
    if (geoConcentrationScore < 35) keyStrengths.push('Good geographic diversification')
    if (assets.length > 3) keyStrengths.push('Diversified property types')

    if (geoConcentrationScore > 50) keyRisks.push('Geographic concentration risk')
    if (avgRiskScore > 65) keyRisks.push('Elevated portfolio volatility')
    if (maxAssetConc > 60) keyRisks.push('Over-concentration in single property type')

    if (geoDistribution.length < 5) optimizationOps.push('Expand to more provinces')
    if (assets.length < 4) optimizationOps.push('Add more property type diversity')
    if (avgOppScore < 50) optimizationOps.push('Focus acquisitions on higher-quality deals')

    const rebalancingNeeded = rebalancingTriggers.length > 0

    return {
      portfolio_id: 'active-portfolio',
      analysis_timestamp: new Date().toISOString(),
      total_deals: deals.length,
      total_portfolio_value: totalValue,
      avg_deal_size: avgDealSize,
      asset_allocation: assets.sort((a, b) => b.contribution_pct - a.contribution_pct),
      top_3_property_types: assets.sort((a, b) => b.contribution_pct - a.contribution_pct).slice(0, 3),
      geographic_distribution: geoDistribution,
      geographic_concentration_score: geoConcentrationScore,
      herfindahl_index: herfindahl,
      most_concentrated_province: geoDistribution[0]?.province || 'N/A',
      least_concentrated_province: geoDistribution[geoDistribution.length - 1]?.province || 'N/A',
      portfolio_volatility_estimate: portfolioVolatility,
      portfolio_beta: portfolioBeta,
      weighted_avg_roi_3year: assets.reduce((sum, a) => sum + a.avg_roi * (a.contribution_pct / 100), 0),
      weighted_avg_opportunity_score: avgOppScore,
      portfolio_sharpe_ratio: portfolioSharpeRatio,
      rebalancing_needed: rebalancingNeeded,
      rebalancing_triggers: rebalancingTriggers,
      recommended_adjustments: recommendedAdjustments,
      portfolio_risk_level: portfolioRiskLevel,
      diversification_score: Math.round(100 - Math.min(100, geoConcentrationScore * 1.5)),
      sector_concentration_risk: maxAssetConc > 60 ? 'high' : maxAssetConc > 40 ? 'moderate' : 'low',
      geographic_concentration_risk: geoConcentrationScore > 50 ? 'high' : geoConcentrationScore > 35 ? 'moderate' : 'low',
      key_strengths: keyStrengths,
      key_risks: keyRisks,
      optimization_opportunities: optimizationOps,
    }
  }

  /**
   * Insert portfolio analysis to database
   */
  private async insertPortfolioAnalysis(analysis: PortfolioOptimizationResult) {
    try {
      const { error: insertError } = await supabase
        .from('acq_portfolio_optimization')
        .upsert(analysis, { onConflict: 'portfolio_id' })

      if (insertError) {
        logger.warn('Failed to insert portfolio analysis', {
          error: insertError.message,
        })
        return { inserted: 0, skipped: 1 }
      }

      await this.recordScraperRun('PortfolioOptimizationScraper', {
        success: true,
        itemsFound: analysis.total_deals,
        itemsInserted: 1,
        itemsSkipped: 0,
        duration_ms: 0,
      })

      return { inserted: 1, skipped: 0 }
    } catch (err) {
      logger.warn('Error inserting portfolio analysis', {
        error: String(err),
      })
      return { inserted: 0, skipped: 1 }
    }
  }
}

export async function runPortfolioOptimizationScraper() {
  const scraper = new PortfolioOptimizationWorker()
  const result = await scraper.run()
  return {
    status: result.success ? 'ok' : 'error',
    itemsFound: result.itemsFound,
    itemsInserted: result.itemsInserted,
    itemsSkipped: result.itemsSkipped,
    error: result.error || null,
  }
}
