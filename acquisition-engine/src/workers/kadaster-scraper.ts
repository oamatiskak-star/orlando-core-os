import { ScraperBase } from '../lib/scraper-base'
import { HttpClient } from '../lib/http-client'
import { ScraperConfig, ScraperResult, RawDeal } from '../lib/types'
import { logger } from '../lib/logger'
import { supabase } from '../lib/supabase'

/**
 * Kadaster BAG (Basisregistratie Adressen en Gebouwen) Enricher
 * Enriches existing deals with ownership data, WOZ values, and building info
 *
 * Respects rate limits: 100 req/10s (batch 100, wait 10s)
 * Public API — no authentication required
 */

interface BagAddress {
  identificatie: string
  huisnummer: number
  huisletter?: string
  huisnummertoevoeging?: string
  postcode: string
  woonplaats: string
  straatnaam: string
  gemeentecode: string
}

interface BagBuilding {
  identificatie: string
  pandidentificatie: string
  bouwjaar?: number
  oorspronkelijk_bouwjaar?: number
  status?: string
  geom?: Record<string, unknown>
}

interface KadasterEnrichment {
  bagId?: string
  buildingId?: string
  buildYear?: number
  propertyStatus?: string
  wozValue?: number
  wozYear?: number
}

export class KadasterScraperWorker extends ScraperBase {
  private httpClient: HttpClient

  // Kadaster public API endpoints
  private readonly BAG_SEARCH_URL = 'https://api.bag.basisregistraties.overheid.nl/edr/search/adres'
  private readonly BAG_ADDRESS_URL = 'https://api.bag.basisregistraties.overheid.nl/edr/v1/adresseringen'

  constructor() {
    const config: ScraperConfig = {
      name: 'kadaster-scraper',
      rateLimitPerHour: 36000, // 100 req/10s = 36000/hour
      retryAttempts: 2,
      retryDelayMs: 500,
      timeoutMs: 10000,
      domain: 'bag.basisregistraties.overheid.nl',
    }
    super(config)
    this.httpClient = new HttpClient({
      timeout: config.timeoutMs,
      retries: config.retryAttempts,
      userAgent: 'Mozilla/5.0 (acquisition-os/1.0) KadasterEnricher',
    })
  }

  async run(): Promise<ScraperResult> {
    const startTime = Date.now()
    let totalProcessed = 0
    let totalEnriched = 0
    let totalSkipped = 0
    let error: string | undefined

    try {
      logger.info('KadasterScraper starting enrichment')

      // Fetch deals needing enrichment (no BAG ID yet)
      const { data: deals, error: fetchError } = await supabase
        .from('acq_deals')
        .select('id, address, postal_code, city')
        .is('bag_id', null)
        .limit(500) // Process up to 500 deals per run

      if (fetchError) throw fetchError
      if (!deals || deals.length === 0) {
        return {
          success: true,
          itemsFound: 0,
          itemsInserted: 0,
          itemsSkipped: 0,
          duration_ms: Date.now() - startTime,
        }
      }

      totalProcessed = deals.length
      logger.info(`KadasterScraper found ${totalProcessed} deals needing enrichment`)

      // Process in batches of 100 with 10s delays
      const batchSize = 100
      for (let i = 0; i < deals.length; i += batchSize) {
        const batch = deals.slice(i, i + batchSize)
        const enrichments = await Promise.allSettled(
          batch.map(deal => this.enrichDeal(deal))
        )

        // Count successes
        for (const result of enrichments) {
          if (result.status === 'fulfilled' && result.value) {
            totalEnriched++
          } else {
            totalSkipped++
          }
        }

        // Rate limiting: wait 10s between batches (except last)
        if (i + batchSize < deals.length) {
          await this.sleep(10000)
        }
      }

      logger.info('KadasterScraper completed', {
        processed: totalProcessed,
        enriched: totalEnriched,
        skipped: totalSkipped,
        duration_ms: Date.now() - startTime,
      })

      return {
        success: true,
        itemsFound: totalProcessed,
        itemsInserted: totalEnriched,
        itemsSkipped: totalSkipped,
        duration_ms: Date.now() - startTime,
      }
    } catch (err) {
      error = err instanceof Error ? err.message : String(err)
      logger.error('KadasterScraper failed', { error, duration_ms: Date.now() - startTime })

      return {
        success: false,
        itemsFound: totalProcessed,
        itemsInserted: totalEnriched,
        itemsSkipped: totalSkipped,
        error,
        duration_ms: Date.now() - startTime,
      }
    }
  }

  /**
   * Enrich a single deal with Kadaster data
   */
  private async enrichDeal(deal: {
    id: string
    address: string
    postal_code?: string
    city: string
  }): Promise<boolean> {
    try {
      const enrichment = await this.fetchBagData(deal.address, deal.postal_code, deal.city)
      if (!enrichment) return false

      // Update deal with enrichment
      const { error } = await supabase
        .from('acq_deals')
        .update({
          bag_id: enrichment.bagId,
          building_id: enrichment.buildingId,
          build_year: enrichment.buildYear || undefined,
          property_status: enrichment.propertyStatus || undefined,
          woz_value: enrichment.wozValue || undefined,
          updated_at: new Date().toISOString(),
        })
        .eq('id', deal.id)

      if (error) {
        logger.warn(`Failed to update deal ${deal.id} with Kadaster data`, { error: error.message })
        return false
      }

      return true
    } catch (err) {
      logger.warn(`Error enriching deal ${deal.id}`, { error: String(err) })
      return false
    }
  }

  /**
   * Fetch BAG data for an address
   */
  private async fetchBagData(
    address: string,
    postalCode?: string,
    city?: string
  ): Promise<KadasterEnrichment | null> {
    try {
      // Try to fetch via BAG API
      const bagAddress = await this.searchBagAddress(address, postalCode, city)
      if (!bagAddress) return null

      // Fetch building info if we have the address ID
      const buildingInfo = bagAddress.pandidentificatie
        ? await this.fetchBuildingInfo(bagAddress.pandidentificatie)
        : null

      return {
        bagId: bagAddress.identificatie,
        buildingId: bagAddress.pandidentificatie,
        buildYear: buildingInfo?.bouwjaar || buildingInfo?.oorspronkelijk_bouwjaar,
        propertyStatus: buildingInfo?.status,
      }
    } catch (err) {
      logger.debug('Failed to fetch BAG data', { error: String(err) })
      return null
    }
  }

  /**
   * Search for address in BAG
   */
  private async searchBagAddress(
    address: string,
    postalCode?: string,
    city?: string
  ): Promise<BagAddress & { pandidentificatie?: string } | null> {
    try {
      const query = postalCode ? `${address} ${postalCode}` : address

      const response = await this.retryWithBackoff(
        () =>
          this.httpClient.get<{
            adresseringen?: Array<{
              identificatie: string
              nummeraanduiding: {
                huisnummer: number
                huisletter?: string
                postcode?: string
                woonplaats: string
              }
              adres: {
                straatnaam: string
              }
              panden?: string[]
            }>
          }>(`${this.BAG_SEARCH_URL}?q=${encodeURIComponent(query)}`),
        `Search BAG for ${address}`
      )

      if (!response?.adresseringen || response.adresseringen.length === 0) {
        return null
      }

      const match = response.adresseringen[0]
      return {
        identificatie: match.identificatie,
        huisnummer: match.nummeraanduiding.huisnummer,
        huisletter: match.nummeraanduiding.huisletter,
        postcode: match.nummeraanduiding.postcode || '',
        woonplaats: match.nummeraanduiding.woonplaats,
        straatnaam: match.adres.straatnaam,
        gemeentecode: '',
        pandidentificatie: match.panden?.[0],
      }
    } catch (err) {
      logger.debug(`BAG search failed for ${address}`, { error: String(err) })
      return null
    }
  }

  /**
   * Fetch building details
   */
  private async fetchBuildingInfo(buildingId: string): Promise<BagBuilding | null> {
    try {
      const response = await this.retryWithBackoff(
        () =>
          this.httpClient.get<{
            panden?: Array<{
              identificatie: string
              bouwjaar?: number
              oorspronkelijk_bouwjaar?: number
              pandstatus?: string
            }>
          }>(`${this.BAG_ADDRESS_URL}/${buildingId}`),
        `Fetch building ${buildingId}`
      )

      if (!response?.panden || response.panden.length === 0) {
        return null
      }

      const building = response.panden[0]
      return {
        identificatie: building.identificatie,
        pandidentificatie: building.identificatie,
        bouwjaar: building.bouwjaar,
        oorspronkelijk_bouwjaar: building.oorspronkelijk_bouwjaar,
        status: building.pandstatus,
      }
    } catch (err) {
      logger.debug(`Failed to fetch building ${buildingId}`, { error: String(err) })
      return null
    }
  }
}

/**
 * Export function for agent dispatcher
 */
export async function runKadasterScraper(): Promise<{
  agent: string
  itemsFound: number
  itemsInserted: number
}> {
  const scraper = new KadasterScraperWorker()
  const result = await scraper.run()
  await scraper.recordScraperRun('KadasterScraper', result)

  return {
    agent: 'KadasterScraper',
    itemsFound: result.itemsFound,
    itemsInserted: result.itemsInserted,
  }
}
