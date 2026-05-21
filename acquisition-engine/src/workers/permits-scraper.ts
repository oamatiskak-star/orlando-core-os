import { ScraperBase } from '../lib/scraper-base'
import { HttpClient } from '../lib/http-client'
import { ScraperConfig, ScraperResult } from '../lib/types'
import { logger } from '../lib/logger'
import { supabase } from '../lib/supabase'

/**
 * Building Permits Scraper (Bouwvergunningen)
 * Fetches recent construction permits from IMOW (Informatiemodel Omgevingswet)
 * and gemeente open data portals
 *
 * Rate limit: 1 req/2s per gemeente (sequential processing)
 * Public APIs — no authentication required
 */

interface PermitSearchResult {
  id: string
  address: string
  postal_code: string
  city: string
  municipality: string
  permit_type: string // 'bouwvergunning', 'aanvraag', 'meldingsproces'
  status: string // 'verleend', 'in_behandeling', 'ingediend'
  application_date: string
  decision_date?: string
  permit_url?: string
  project_description?: string
  surface_area?: number
}

interface PermitDBRecord {
  id: string
  address: string
  postal_code: string
  city: string
  permit_type: string
  status: string
  application_date: string
  decision_date?: string | null
  permit_source_url?: string
  project_description?: string
  construction_area?: number
  source: 'imow' | 'gemeente'
  source_url: string
}

export class PermitsScraperWorker extends ScraperBase {
  private httpClient: HttpClient

  // IMOW API and gemeente data portals
  private readonly IMOW_API = 'https://api.omgevingswet.overheid.nl/omgevingsdocumenten'
  private readonly OVERHEID_API = 'https://data.overheid.nl'

  constructor() {
    const config: ScraperConfig = {
      name: 'permits-scraper',
      rateLimitPerHour: 1800, // 1 req/2s = 1800/hour (conservative)
      retryAttempts: 2,
      retryDelayMs: 1000,
      timeoutMs: 15000,
      domain: 'imow.overheid.nl',
    }
    super(config)
    this.httpClient = new HttpClient({
      timeout: config.timeoutMs,
      retries: config.retryAttempts,
      userAgent: 'Mozilla/5.0 (acquisition-os/1.0) PermitsScraper',
    })
  }

  async run(): Promise<ScraperResult> {
    const startTime = Date.now()
    let totalFound = 0
    let totalInserted = 0
    let totalSkipped = 0
    let error: string | undefined

    try {
      logger.info('PermitsScraper starting')

      // Fetch recent permits from IMOW (last 30 days)
      const permits = await this.fetchRecentPermits()
      totalFound = permits.length

      if (totalFound === 0) {
        return {
          success: true,
          itemsFound: 0,
          itemsInserted: 0,
          itemsSkipped: 0,
          duration_ms: Date.now() - startTime,
        }
      }

      logger.info(`PermitsScraper found ${totalFound} permits`)

      // Insert to database with duplicate detection
      const { inserted, skipped } = await this.insertPermits(permits)
      totalInserted = inserted
      totalSkipped = skipped

      logger.info('PermitsScraper completed', {
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
      logger.error('PermitsScraper failed', { error, duration_ms: Date.now() - startTime })

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
   * Fetch recent building permits from IMOW
   */
  private async fetchRecentPermits(): Promise<PermitSearchResult[]> {
    const permits: PermitSearchResult[] = []

    try {
      // Fetch last 30 days of permits
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      const fromDate = thirtyDaysAgo.toISOString().split('T')[0]

      const response = await this.retryWithBackoff(
        () =>
          this.httpClient.get<{
            documenten?: Array<{
              identificatie: string
              onderwerp: string
              locatie?: {
                woonplaatsnaam: string
                postcode: string
                huisnummer?: number
                straatnaam: string
              }
              ingangsdatum?: string
              documenttypes?: string[]
            }>
          }>(
            `${this.IMOW_API}?type=bouwvergunning&gemeentecode=*&wijzigingsdatum>${fromDate}&pageSize=100`
          ),
        'Fetch IMOW permits'
      )

      if (!response?.documenten) {
        logger.warn('No permits found in IMOW response')
        return permits
      }

      // Map IMOW permits to common format
      for (const doc of response.documenten) {
        if (!doc.locatie) continue

        permits.push({
          id: doc.identificatie,
          address: this.formatAddress(doc.locatie),
          postal_code: doc.locatie.postcode || '',
          city: doc.locatie.woonplaatsnaam || '',
          municipality: doc.locatie.woonplaatsnaam || '',
          permit_type: this.mapPermitType(doc.documenttypes),
          status: 'verleend', // IMOW typically shows published permits
          application_date: doc.ingangsdatum || new Date().toISOString(),
          permit_url: `https://omgevingswet.overheid.nl/omgevingsdocumenten/${doc.identificatie}`,
          project_description: doc.onderwerp,
        })
      }

      return permits
    } catch (err) {
      logger.error('Failed to fetch IMOW permits', { error: String(err) })
      return permits
    }
  }

  /**
   * Insert permits to database with duplicate detection
   */
  private async insertPermits(
    permits: PermitSearchResult[]
  ): Promise<{ inserted: number; skipped: number }> {
    let inserted = 0
    let skipped = 0

    // Batch insert with duplicate detection on (source, source_url)
    const permitRecords: PermitDBRecord[] = permits.map(p => ({
      id: p.id,
      address: p.address,
      postal_code: p.postal_code,
      city: p.city,
      permit_type: p.permit_type,
      status: p.status,
      application_date: p.application_date,
      decision_date: p.decision_date || null,
      permit_source_url: p.permit_url,
      project_description: p.project_description,
      construction_area: p.surface_area,
      source: 'imow',
      source_url: p.permit_url || `imow://${p.id}`,
    }))

    try {
      const { error, count } = await supabase
        .from('acq_permits')
        .upsert(permitRecords, {
          onConflict: 'source,source_url',
          ignoreDuplicates: true,
        })

      if (error) {
        logger.error('Error inserting permits', { error: error.message })
        return { inserted: 0, skipped: permits.length }
      }

      inserted = count || 0
      skipped = permits.length - inserted

      return { inserted, skipped }
    } catch (err) {
      logger.error('Failed to insert permits', { error: String(err) })
      return { inserted: 0, skipped: permits.length }
    }
  }

  /**
   * Format address from location components
   */
  private formatAddress(location: {
    straatnaam?: string
    huisnummer?: number
    postcode?: string
  }): string {
    const parts = []
    if (location.straatnaam) parts.push(location.straatnaam)
    if (location.huisnummer) parts.push(location.huisnummer.toString())
    return parts.join(' ')
  }

  /**
   * Map document types to permit type
   */
  private mapPermitType(documentTypes?: string[]): string {
    if (!documentTypes || documentTypes.length === 0) return 'bouwvergunning'

    const type = documentTypes[0].toLowerCase()
    if (type.includes('aanvraag')) return 'aanvraag'
    if (type.includes('meldingsproces')) return 'meldingsproces'
    return 'bouwvergunning'
  }
}

/**
 * Export function for agent dispatcher
 */
export async function runPermitsScraper(): Promise<{
  agent: string
  itemsFound: number
  itemsInserted: number
}> {
  const scraper = new PermitsScraperWorker()
  const result = await scraper.run()
  await scraper.recordScraperRun('PermitsScraper', result)

  return {
    agent: 'PermitsScraper',
    itemsFound: result.itemsFound,
    itemsInserted: result.itemsInserted,
  }
}
