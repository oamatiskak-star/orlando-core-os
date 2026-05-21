import { ScraperBase } from '../lib/scraper-base'
import { HttpClient } from '../lib/http-client'
import { ScraperConfig, ScraperResult } from '../lib/types'
import { logger } from '../lib/logger'
import { supabase } from '../lib/supabase'

/**
 * Building Inspection Data Scraper — BKWI/DVGO
 * Fetches Dutch building inspection records and safety certificates
 * from DVGO (Digital Government Services for Buildings)
 *
 * Rate limit: 200 req/minute (12,000 req/hour)
 * Requires API key — stored in environment
 */

interface BuildingInspection {
  id: string
  building_id: string
  address: string
  postal_code?: string
  city: string
  inspection_date: string
  inspection_type: string // 'structural', 'electrical', 'fire-safety', 'general'
  inspector_name?: string
  status: string // 'passed', 'passed-with-notes', 'failed', 'pending'
  violations: Array<{
    code: string
    description: string
    severity: 'minor' | 'major' | 'critical'
    resolved?: boolean
  }>
  notes?: string
  next_inspection_due?: string
  certificate?: string
  cert_valid_until?: string
  source_url: string
}

interface InspectionEnrichment {
  id: string
  deal_id: string
  address: string
  city: string
  inspection_count: number
  last_inspection_date?: string
  inspection_status: string
  violations: Array<{
    severity: string
    description: string
  }>
  violations_count: number
  critical_violations: number
  safety_score: number // 0-100
  risk_level: 'low' | 'medium' | 'high' | 'critical'
  next_inspection_due?: string
  certificates: Array<{
    type: string
    valid_until: string
  }>
  raw_data: Record<string, unknown>
}

export class BuildingInspectionScraper extends ScraperBase {
  private httpClient: HttpClient
  private apiKey: string | undefined

  // DVGO API endpoints for building inspections
  private readonly DVGO_INSPECTIONS_URL =
    'https://data.deltaprogramma.nl/api/building-inspections'
  private readonly BIM_PORTAL_URL = 'https://www.bimloket.nl/api/inspections'

  constructor() {
    const config: ScraperConfig = {
      name: 'building-inspection-scraper',
      rateLimitPerHour: 12000, // 200 req/min
      retryAttempts: 2,
      retryDelayMs: 500,
      timeoutMs: 12000,
      domain: 'dvgo.nl',
    }
    super(config)
    this.apiKey = process.env.DVGO_API_KEY
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
      logger.info('BuildingInspectionScraper starting')

      if (!this.apiKey) {
        logger.warn('DVGO_API_KEY not configured, skipping building inspection scraper')
        return {
          success: false,
          itemsFound: 0,
          itemsInserted: 0,
          itemsSkipped: 0,
          error: 'DVGO_API_KEY not configured',
          duration_ms: Date.now() - startTime,
        }
      }

      // Fetch deals needing inspection enrichment
      const dealsNeedingEnrichment = await this.fetchDealsNeedingEnrichment()
      totalFound = dealsNeedingEnrichment.length

      if (totalFound === 0) {
        return {
          success: true,
          itemsFound: 0,
          itemsInserted: 0,
          itemsSkipped: 0,
          duration_ms: Date.now() - startTime,
        }
      }

      logger.info(`BuildingInspectionScraper found ${totalFound} deals needing enrichment`)

      // Process each deal
      const enrichments: InspectionEnrichment[] = []
      for (let i = 0; i < dealsNeedingEnrichment.length; i++) {
        try {
          const deal = dealsNeedingEnrichment[i]
          const inspections = await this.fetchBuildingInspections(
            deal.address,
            deal.postal_code,
            deal.city
          )

          if (inspections.length > 0) {
            const enrichment = this.mapToEnrichment(deal, inspections)
            enrichments.push(enrichment)
          }

          // Rate limiting: 300ms per request (200 req/min)
          if (i < dealsNeedingEnrichment.length - 1) {
            await this.sleep(300)
          }
        } catch (err) {
          logger.warn(`Error enriching deal ${dealsNeedingEnrichment[i].id}`, {
            error: String(err),
          })
        }
      }

      // Insert enrichments
      const { inserted, skipped } = await this.insertInspectionEnrichments(enrichments)
      totalInserted = inserted
      totalSkipped = skipped

      logger.info('BuildingInspectionScraper completed', {
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
      logger.error('BuildingInspectionScraper failed', {
        error,
        duration_ms: Date.now() - startTime,
      })

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
   * Fetch deals needing inspection enrichment
   */
  private async fetchDealsNeedingEnrichment(): Promise<
    Array<{ id: string; address: string; postal_code?: string; city: string }>
  > {
    try {
      const { data, error } = await supabase
        .from('acq_deals')
        .select('id, address, city')
        .is('building_inspection_status', null)
        .limit(50)

      if (error) throw error
      return data || []
    } catch (err) {
      logger.error('Failed to fetch deals needing enrichment', { error: String(err) })
      return []
    }
  }

  /**
   * Fetch building inspections from DVGO API
   */
  private async fetchBuildingInspections(
    address: string,
    postalCode?: string,
    city?: string
  ): Promise<BuildingInspection[]> {
    const inspections: BuildingInspection[] = []

    try {
      // Search for building by address
      const searchParams = {
        address: address,
        city: city || '',
        postalCode: postalCode || '',
        limit: '20',
      }

      const response = await this.retryWithBackoff(
        () => {
          const headers: Record<string, string> = {
            'Content-Type': 'application/json',
          }
          if (this.apiKey) {
            headers['Authorization'] = `Bearer ${this.apiKey}`
          }
          return this.httpClient.get<{
            inspections?: Array<{
              id: string
              inspectionDate: string
              inspectionType: string
              status: string
              violations?: Array<{
                code: string
                description: string
                severity: string
              }>
              notes?: string
              nextInspectionDue?: string
              certificate?: {
                type: string
                validUntil: string
              }
            }>
          }>(`${this.DVGO_INSPECTIONS_URL}?${new URLSearchParams(searchParams).toString()}`)
        },
        `Fetch DVGO inspections for ${address}`
      )

      if (!response?.inspections) {
        return inspections
      }

      // Map inspection results
      for (const insp of response.inspections) {
        inspections.push({
          id: insp.id,
          building_id: insp.id,
          address,
          postal_code: postalCode,
          city: city || '',
          inspection_date: insp.inspectionDate,
          inspection_type: insp.inspectionType,
          status: insp.status,
          violations: (insp.violations || []).map(v => ({
            code: v.code,
            description: v.description,
            severity: (v.severity as 'minor' | 'major' | 'critical') || 'major',
          })),
          notes: insp.notes,
          next_inspection_due: insp.nextInspectionDue,
          certificate: insp.certificate?.type,
          cert_valid_until: insp.certificate?.validUntil,
          source_url: `https://www.dvgo.nl/inspections/${insp.id}`,
        })
      }

      return inspections
    } catch (err) {
      logger.warn(`Failed to fetch DVGO inspections for ${address}`, { error: String(err) })
      return inspections
    }
  }

  /**
   * Map inspections to enrichment record
   */
  private mapToEnrichment(
    deal: { id: string; address: string; city: string },
    inspections: BuildingInspection[]
  ): InspectionEnrichment {
    const allViolations = inspections.flatMap(i => i.violations)
    const criticalViolations = allViolations.filter(v => v.severity === 'critical').length
    const majorViolations = allViolations.filter(v => v.severity === 'major').length

    // Calculate safety score (0-100)
    let safetyScore = 100
    safetyScore -= criticalViolations * 20 // -20 per critical
    safetyScore -= majorViolations * 10 // -10 per major
    safetyScore = Math.max(0, Math.min(100, safetyScore))

    // Determine risk level
    let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low'
    if (criticalViolations > 0) {
      riskLevel = 'critical'
    } else if (majorViolations > 2 || safetyScore < 60) {
      riskLevel = 'high'
    } else if (majorViolations > 0 || safetyScore < 80) {
      riskLevel = 'medium'
    }

    const lastInspection = inspections.sort(
      (a, b) => new Date(b.inspection_date).getTime() - new Date(a.inspection_date).getTime()
    )[0]

    return {
      id: `${deal.id}-inspection`,
      deal_id: deal.id,
      address: deal.address,
      city: deal.city,
      inspection_count: inspections.length,
      last_inspection_date: lastInspection?.inspection_date,
      inspection_status: lastInspection?.status || 'unknown',
      violations: allViolations.map(v => ({
        severity: v.severity,
        description: v.description,
      })),
      violations_count: allViolations.length,
      critical_violations: criticalViolations,
      safety_score: safetyScore,
      risk_level: riskLevel,
      next_inspection_due: lastInspection?.next_inspection_due,
      certificates: inspections
        .filter(i => i.certificate)
        .map(i => ({
          type: i.certificate || 'unknown',
          valid_until: i.cert_valid_until || '',
        })),
      raw_data: {
        inspectionCount: inspections.length,
        violations: allViolations,
      },
    }
  }

  /**
   * Batch insert inspection enrichments
   */
  private async insertInspectionEnrichments(
    enrichments: InspectionEnrichment[]
  ): Promise<{ inserted: number; skipped: number }> {
    if (enrichments.length === 0) {
      return { inserted: 0, skipped: 0 }
    }

    try {
      // Insert into acq_building_inspections table
      const { error } = await supabase
        .from('acq_building_inspections')
        .upsert(enrichments, {
          onConflict: 'id',
        })

      if (error) throw error

      // Update deals with inspection status and risk scores
      for (const enrichment of enrichments) {
        try {
          await supabase
            .from('acq_deals')
            .update({
              building_inspection_status: enrichment.inspection_status,
              risk_score: 100 - enrichment.safety_score, // Convert safety to risk
            })
            .eq('id', enrichment.deal_id)
        } catch (err) {
          logger.warn(`Failed to update deal ${enrichment.deal_id}`, { error: String(err) })
        }
      }

      return {
        inserted: enrichments.length,
        skipped: 0,
      }
    } catch (err) {
      logger.error('Failed to insert inspection enrichments', { error: String(err) })
      return { inserted: 0, skipped: enrichments.length }
    }
  }
}

/**
 * Export function for agent dispatcher
 */
export async function runBuildingInspectionScraper(): Promise<{
  agent: string
  itemsFound: number
  itemsInserted: number
}> {
  const scraper = new BuildingInspectionScraper()
  const result = await scraper.run()
  await scraper.recordScraperRun('BuildingInspectionScraper', result)

  return {
    agent: 'BuildingInspectionScraper',
    itemsFound: result.itemsFound,
    itemsInserted: result.itemsInserted,
  }
}
