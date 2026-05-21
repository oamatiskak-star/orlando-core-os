import { ScraperBase } from '../lib/scraper-base'
import { HttpClient } from '../lib/http-client'
import { ScraperConfig, ScraperResult } from '../lib/types'
import { logger } from '../lib/logger'
import { supabase } from '../lib/supabase'

/**
 * Environmental Risk Assessment Scraper
 * Fetches environmental and risk data from Dutch government registries
 * including soil contamination, heritage status, flood risk, noise pollution
 *
 * Rate limit: 1000 req/hour (varies by source)
 * Public APIs — no authentication required
 */

interface EnvironmentalRisk {
  location: string
  postal_code?: string
  city: string
  coordinates?: {
    lat: number
    lng: number
  }
  soil_contamination?: {
    status: 'clean' | 'monitored' | 'polluted' | 'remediated'
    contaminants?: string[]
    risk_level?: 'low' | 'medium' | 'high'
  }
  flood_risk?: {
    zone: 'no_risk' | 'low' | 'medium' | 'high' | 'unknown'
    probability?: number // percentage
    depth_risk?: 'shallow' | 'moderate' | 'deep'
  }
  noise_pollution?: {
    level_db?: number
    sources?: ('highway' | 'railway' | 'airport' | 'industrial')[]
    exposure_level?: 'low' | 'medium' | 'high'
  }
  heritage_status?: {
    is_monument?: boolean
    monument_type?: string
    protected_area?: string
    restrictions?: string[]
  }
  hazmat_risk?: {
    nearby_hazmat_sites?: number
    distance_to_nearest_km?: number
    risk_category?: 'low' | 'medium' | 'high'
  }
  air_quality?: {
    pm25_annual?: number
    no2_annual?: number
    risk_level?: 'low' | 'medium' | 'high'
  }
  source_url: string
}

interface EnvironmentalAnalysis {
  id: string
  deal_id: string
  address: string
  city: string
  environmental_risks: EnvironmentalRisk
  overall_risk_score: number // 0-100
  risk_categories: {
    soil: number
    flood: number
    noise: number
    air_quality: number
    hazmat: number
  }
  red_flags: string[]
  recommendations: string[]
  raw_data: Record<string, unknown>
}

export class EnvironmentalRiskScraper extends ScraperBase {
  private httpClient: HttpClient

  // Data sources
  private readonly BIS_URL = 'https://www.bodemloket.nl/api/contamination' // Soil contamination
  private readonly IMRO_URL = 'https://www.ruimtelijkeplannen.nl/api/heritage' // Heritage/monuments
  private readonly HIS_RASTER = 'https://www.nationaalgeoregister.nl/geonetwork/wfs' // Flood risk
  private readonly RIVM_LUCHTKWALITEIT = 'https://www.rivm.nl/milieupleindata' // Air quality
  private readonly MILIEULOKET = 'https://www.milieuloket.nl/api/locations' // Hazmat locations

  constructor() {
    const config: ScraperConfig = {
      name: 'environmental-risk-scraper',
      rateLimitPerHour: 2000, // Conservative across multiple sources
      retryAttempts: 2,
      retryDelayMs: 1000,
      timeoutMs: 15000,
      domain: 'bodemloket.nl',
    }
    super(config)
    this.httpClient = new HttpClient({
      timeout: config.timeoutMs,
      retries: config.retryAttempts,
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    })
  }

  async run(): Promise<ScraperResult> {
    const startTime = Date.now()
    let totalFound = 0
    let totalInserted = 0
    let totalSkipped = 0
    let error: string | undefined

    try {
      logger.info('EnvironmentalRiskScraper starting')

      // Fetch deals needing environmental analysis
      const dealsNeedingAnalysis = await this.fetchDealsNeedingAnalysis()
      totalFound = dealsNeedingAnalysis.length

      if (totalFound === 0) {
        return {
          success: true,
          itemsFound: 0,
          itemsInserted: 0,
          itemsSkipped: 0,
          duration_ms: Date.now() - startTime,
        }
      }

      logger.info(`EnvironmentalRiskScraper found ${totalFound} deals needing analysis`)

      // Process each deal
      const analyses: EnvironmentalAnalysis[] = []
      for (let i = 0; i < dealsNeedingAnalysis.length; i++) {
        try {
          const deal = dealsNeedingAnalysis[i]
          const risks = await this.fetchEnvironmentalRisks(deal)

          if (risks) {
            const analysis = this.mapToAnalysis(deal, risks)
            analyses.push(analysis)
          }

          // Rate limiting: 2000 req/hour = ~1.8s per deal
          if (i < dealsNeedingAnalysis.length - 1) {
            await this.sleep(500)
          }
        } catch (err) {
          logger.warn(`Error analyzing deal ${dealsNeedingAnalysis[i].id}`, {
            error: String(err),
          })
        }
      }

      // Insert analyses
      const { inserted, skipped } = await this.insertEnvironmentalAnalyses(analyses)
      totalInserted = inserted
      totalSkipped = skipped

      logger.info('EnvironmentalRiskScraper completed', {
        found: totalFound,
        inserted: totalInserted,
        skipped: totalSkipped,
        duration_ms: Date.now() - startTime,
      })

      return {
        success: true,
        itemsFound: totalFound,
        itemsInserted: totalInserted,
        itemsSkipped: totalSkipped,
        duration_ms: Date.now() - startTime,
      }
    } catch (err) {
      error = err instanceof Error ? err.message : String(err)
      logger.error('EnvironmentalRiskScraper failed', { error, duration_ms: Date.now() - startTime })

      return {
        success: false,
        itemsFound: totalFound,
        itemsInserted: totalInserted,
        itemsSkipped: totalSkipped,
        error,
        duration_ms: Date.now() - startTime,
      }
    }
  }

  /**
   * Fetch deals needing environmental analysis
   */
  private async fetchDealsNeedingAnalysis(): Promise<
    Array<{ id: string; address: string; postal_code?: string; city: string }>
  > {
    try {
      const { data, error } = await supabase
        .from('acq_deals')
        .select('id, address, city')
        .is('environmental_risk_status', null)
        .limit(40)

      if (error) throw error
      return data || []
    } catch (err) {
      logger.error('Failed to fetch deals needing analysis', { error: String(err) })
      return []
    }
  }

  /**
   * Fetch all environmental risks for a location
   */
  private async fetchEnvironmentalRisks(deal: any): Promise<EnvironmentalRisk | null> {
    try {
      const risks: EnvironmentalRisk = {
        location: deal.address,
        city: deal.city,
        source_url: 'https://www.bodemloket.nl',
      }

      // Fetch soil contamination data
      try {
        const soilData = await this.fetchSoilContamination(deal)
        if (soilData) {
          risks.soil_contamination = soilData
        }
        await this.sleep(100)
      } catch (err) {
        logger.warn(`Failed to fetch soil data for ${deal.address}`, { error: String(err) })
      }

      // Fetch flood risk
      try {
        const floodData = await this.fetchFloodRisk(deal)
        if (floodData) {
          risks.flood_risk = floodData
        }
        await this.sleep(100)
      } catch (err) {
        logger.warn(`Failed to fetch flood data for ${deal.address}`, { error: String(err) })
      }

      // Fetch heritage status
      try {
        const heritageData = await this.fetchHeritageStatus(deal)
        if (heritageData) {
          risks.heritage_status = heritageData
        }
        await this.sleep(100)
      } catch (err) {
        logger.warn(`Failed to fetch heritage data for ${deal.address}`, { error: String(err) })
      }

      // Fetch noise pollution
      try {
        const noiseData = await this.fetchNoisePollution(deal)
        if (noiseData) {
          risks.noise_pollution = noiseData
        }
        await this.sleep(100)
      } catch (err) {
        logger.warn(`Failed to fetch noise data for ${deal.address}`, { error: String(err) })
      }

      // Fetch hazmat/chemical sites
      try {
        const hazmatData = await this.fetchHazmatRisks(deal)
        if (hazmatData) {
          risks.hazmat_risk = hazmatData
        }
        await this.sleep(100)
      } catch (err) {
        logger.warn(`Failed to fetch hazmat data for ${deal.address}`, { error: String(err) })
      }

      // Fetch air quality
      try {
        const airData = await this.fetchAirQuality(deal)
        if (airData) {
          risks.air_quality = airData
        }
        await this.sleep(100)
      } catch (err) {
        logger.warn(`Failed to fetch air quality data for ${deal.address}`, { error: String(err) })
      }

      return risks
    } catch (err) {
      logger.error(`Failed to fetch environmental risks for ${deal.address}`, {
        error: String(err),
      })
      return null
    }
  }

  /**
   * Fetch soil contamination data
   */
  private async fetchSoilContamination(deal: any): Promise<any> {
    const response = await this.retryWithBackoff(
      () =>
        this.httpClient.get<any>(
          `${this.BIS_URL}?address=${encodeURIComponent(deal.address)}&city=${encodeURIComponent(deal.city)}`
        ),
      `Fetch soil contamination for ${deal.address}`
    )
    return response?.contamination
  }

  /**
   * Fetch flood risk data
   */
  private async fetchFloodRisk(deal: any): Promise<any> {
    const response = await this.retryWithBackoff(
      () =>
        this.httpClient.get<any>(
          `${this.HIS_RASTER}/wfs?service=WFS&version=2.0.0&request=GetFeature&typeName=hydro:FloodRisk&CQL_FILTER=city='${deal.city}'&outputFormat=application/json`
        ),
      `Fetch flood risk for ${deal.city}`
    )
    return response?.properties
  }

  /**
   * Fetch heritage/monument status
   */
  private async fetchHeritageStatus(deal: any): Promise<any> {
    const response = await this.retryWithBackoff(
      () =>
        this.httpClient.get<any>(
          `${this.IMRO_URL}?address=${encodeURIComponent(deal.address)}&limit=1`
        ),
      `Fetch heritage status for ${deal.address}`
    )
    return response?.monument
  }

  /**
   * Fetch noise pollution data
   */
  private async fetchNoisePollution(deal: any): Promise<any> {
    const response = await this.retryWithBackoff(
      () =>
        this.httpClient.get<any>(
          `${this.MILIEULOKET}?type=noise&address=${encodeURIComponent(deal.address)}`
        ),
      `Fetch noise pollution for ${deal.address}`
    )
    return response?.noise
  }

  /**
   * Fetch hazmat/chemical site risks
   */
  private async fetchHazmatRisks(deal: any): Promise<any> {
    const response = await this.retryWithBackoff(
      () =>
        this.httpClient.get<any>(
          `${this.MILIEULOKET}?type=hazmat&city=${encodeURIComponent(deal.city)}`
        ),
      `Fetch hazmat risks for ${deal.city}`
    )
    return response?.hazmat
  }

  /**
   * Fetch air quality data
   */
  private async fetchAirQuality(deal: any): Promise<any> {
    const response = await this.retryWithBackoff(
      () =>
        this.httpClient.get<any>(
          `${this.RIVM_LUCHTKWALITEIT}?location=${encodeURIComponent(deal.city)}`
        ),
      `Fetch air quality for ${deal.city}`
    )
    return response?.airQuality
  }

  /**
   * Map risks to analysis
   */
  private mapToAnalysis(deal: any, risks: EnvironmentalRisk): EnvironmentalAnalysis {
    const riskScores = {
      soil: this.scoreSoilRisk(risks.soil_contamination),
      flood: this.scoreFloodRisk(risks.flood_risk),
      noise: this.scoreNoiseRisk(risks.noise_pollution),
      air_quality: this.scoreAirQuality(risks.air_quality),
      hazmat: this.scoreHazmatRisk(risks.hazmat_risk),
    }

    const overallScore =
      (riskScores.soil + riskScores.flood + riskScores.noise + riskScores.air_quality + riskScores.hazmat) / 5

    const redFlags = this.identifyRedFlags(risks)
    const recommendations = this.generateRecommendations(risks, riskScores)

    return {
      id: `${deal.id}-env`,
      deal_id: deal.id,
      address: deal.address,
      city: deal.city,
      environmental_risks: risks,
      overall_risk_score: Math.round(overallScore),
      risk_categories: riskScores,
      red_flags: redFlags,
      recommendations,
      raw_data: risks as unknown as Record<string, unknown>,
    }
  }

  /**
   * Score soil contamination risk
   */
  private scoreSoilRisk(data?: any): number {
    if (!data) return 0
    if (data.status === 'polluted') return 80
    if (data.status === 'monitored') return 40
    if (data.status === 'remediated') return 15
    return 0
  }

  /**
   * Score flood risk
   */
  private scoreFloodRisk(data?: any): number {
    if (!data) return 0
    if (data.zone === 'high') return 85
    if (data.zone === 'medium') return 50
    if (data.zone === 'low') return 20
    return 0
  }

  /**
   * Score noise pollution risk
   */
  private scoreNoiseRisk(data?: any): number {
    if (!data) return 0
    if (data.exposure_level === 'high') return 60
    if (data.exposure_level === 'medium') return 35
    if (data.exposure_level === 'low') return 15
    return 0
  }

  /**
   * Score air quality risk
   */
  private scoreAirQuality(data?: any): number {
    if (!data) return 0
    if (data.risk_level === 'high') return 70
    if (data.risk_level === 'medium') return 40
    if (data.risk_level === 'low') return 15
    return 0
  }

  /**
   * Score hazmat risk
   */
  private scoreHazmatRisk(data?: any): number {
    if (!data) return 0
    if (data.risk_category === 'high') return 75
    if (data.risk_category === 'medium') return 45
    if (data.risk_category === 'low') return 20
    return 0
  }

  /**
   * Identify red flags
   */
  private identifyRedFlags(risks: EnvironmentalRisk): string[] {
    const flags: string[] = []

    if (risks.soil_contamination?.status === 'polluted') {
      flags.push('Bodemverontreiniging: vervuilde grond gedetecteerd')
    }
    if (risks.flood_risk?.zone === 'high') {
      flags.push('Overstroming: hoog risico gedetecteerd')
    }
    if (risks.heritage_status?.is_monument) {
      flags.push('Erfgoed: pand is monument')
    }
    if (risks.noise_pollution?.exposure_level === 'high') {
      flags.push('Geluidshinder: hoog blootstellingsniveau')
    }
    if ((risks.hazmat_risk?.nearby_hazmat_sites || 0) > 2) {
      flags.push('Gevaarlijke stoffen: meerdere locaties in de buurt')
    }
    if (risks.air_quality?.risk_level === 'high') {
      flags.push('Luchtkwaliteit: slecht')
    }

    return flags
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(risks: EnvironmentalRisk, scores: any): string[] {
    const recommendations: string[] = []

    if (scores.soil > 60) {
      recommendations.push(
        'Bodemsanering onderzoeken; mogelijk milieuaudit nodig voor aankoop'
      )
    }
    if (scores.flood > 60) {
      recommendations.push(
        'Overstroomde gebieden meenemen in risicoanalyse; verzekering controleren'
      )
    }
    if (risks.heritage_status?.is_monument) {
      recommendations.push(
        'Erfgoedvergunning vereist voor renovatie; bouwbeperkingen van toepassing'
      )
    }
    if (scores.noise > 50) {
      recommendations.push('Geluidisolatie in budget opnemen; inslaapkwaliteit waarschuwen')
    }
    if (scores.hazmat > 60) {
      recommendations.push('Veiligheidsnormen controleren; zware industrie-impact beoordelen')
    }
    if (scores.air_quality > 50) {
      recommendations.push('Luchtreiniger overwegen; gezondheidsimpact beoordelen')
    }

    return recommendations
  }

  /**
   * Insert environmental analyses
   */
  private async insertEnvironmentalAnalyses(
    analyses: EnvironmentalAnalysis[]
  ): Promise<{ inserted: number; skipped: number }> {
    if (analyses.length === 0) {
      return { inserted: 0, skipped: 0 }
    }

    try {
      const { error } = await supabase
        .from('acq_environmental_risk')
        .upsert(analyses, {
          onConflict: 'id',
        })

      if (error) throw error

      // Update deals with risk assessment
      for (const analysis of analyses) {
        try {
          await supabase
            .from('acq_deals')
            .update({
              environmental_risk_status: 'assessed',
            })
            .eq('id', analysis.deal_id)
        } catch (err) {
          logger.warn(`Failed to update deal ${analysis.deal_id}`, { error: String(err) })
        }
      }

      return {
        inserted: analyses.length,
        skipped: 0,
      }
    } catch (err) {
      logger.error('Failed to insert environmental analyses', { error: String(err) })
      return { inserted: 0, skipped: analyses.length }
    }
  }
}

/**
 * Export function for agent dispatcher
 */
export async function runEnvironmentalRiskScraper(): Promise<{
  agent: string
  itemsFound: number
  itemsInserted: number
}> {
  const scraper = new EnvironmentalRiskScraper()
  const result = await scraper.run()
  await scraper.recordScraperRun('EnvironmentalRiskScraper', result)

  return {
    agent: 'EnvironmentalRiskScraper',
    itemsFound: result.itemsFound,
    itemsInserted: result.itemsInserted,
  }
}
