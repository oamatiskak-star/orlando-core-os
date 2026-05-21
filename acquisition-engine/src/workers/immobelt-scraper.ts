import { ScraperBase } from '../lib/scraper-base'
import { HttpClient } from '../lib/http-client'
import { ScraperConfig, ScraperResult, RawDeal } from '../lib/types'
import { logger } from '../lib/logger'

/**
 * ImmoBelt Commercial Real Estate Scraper
 * Fetches institutional real estate listings and opportunities
 * from ImmoBelt (Dutch commercial property platform)
 *
 * Rate limit: 500 req/day (1 req/2s delay)
 * No authentication required — scrapes public listings
 */

interface ImmobeltListing {
  id: string
  title: string
  address: string
  postal_code?: string
  city: string
  province?: string
  price?: number
  price_range?: { min: number; max: number }
  surface_area?: number
  property_type: string // 'kantoor', 'retail', 'logistiek', 'gemengd'
  year_built?: number
  status: string // 'te_koop', 'te_huur', 'biedingen'
  listed_date?: string
  url: string
  description?: string
  images?: string[]
  owner?: string
  broker?: {
    name?: string
    phone?: string
  }
}

export class ImmobeltScraperWorker extends ScraperBase {
  private httpClient: HttpClient

  // ImmoBelt endpoints (public API)
  private readonly SEARCH_URL = 'https://www.immobelt.nl/api/listings/search'
  private readonly DETAIL_URL = 'https://www.immobelt.nl/api/listings'

  constructor() {
    const config: ScraperConfig = {
      name: 'immobelt-scraper',
      rateLimitPerHour: 500, // Conservative: 500 req/day = 20/hour
      retryAttempts: 2,
      retryDelayMs: 1000,
      timeoutMs: 12000,
      domain: 'immobelt.nl',
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
      logger.info('ImmobeltScraper starting')

      // Search for recent commercial listings
      const listings = await this.searchListings()
      totalFound = listings.length

      if (totalFound === 0) {
        return {
          success: true,
          itemsFound: 0,
          itemsInserted: 0,
          itemsSkipped: 0,
          duration_ms: Date.now() - startTime,
        }
      }

      logger.info(`ImmobeltScraper found ${totalFound} listings`)

      // Convert to RawDeal format
      const deals: RawDeal[] = listings.map(listing => this.mapListingToDeal(listing))

      // Insert to database
      const { inserted, skipped } = await this.insertDeals(deals)
      totalInserted = inserted
      totalSkipped = skipped

      logger.info('ImmobeltScraper completed', {
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
      logger.error('ImmobeltScraper failed', { error, duration_ms: Date.now() - startTime })

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
   * Search ImmoBelt for recent commercial listings
   */
  private async searchListings(): Promise<ImmobeltListing[]> {
    const listings: ImmobeltListing[] = []

    try {
      // Search parameters: commercial property types, last 30 days
      const searchParams = {
        types: ['kantoor', 'retail', 'logistiek', 'gemengd'],
        status: ['te_koop', 'biedingen'],
        sortBy: 'recent',
        pageSize: 50,
        page: 1,
      }

      let hasMore = true
      let pageCount = 0
      const maxPages = 10 // Limit to first 10 pages (500 listings)

      while (hasMore && pageCount < maxPages) {
        try {
          const response = await this.retryWithBackoff(
            () =>
              this.httpClient.post<{
                listings?: Array<ImmobeltListing>
                total?: number
                hasMore?: boolean
              }>(this.SEARCH_URL, {
                ...searchParams,
                page: pageCount + 1,
              }),
            `Fetch ImmoBelt page ${pageCount + 1}`
          )

          if (!response?.listings || response.listings.length === 0) {
            hasMore = false
            break
          }

          listings.push(...response.listings)
          pageCount += 1
          hasMore = response.hasMore !== false

          // Rate limiting: 2 seconds between pages
          if (hasMore) {
            await this.sleep(2000)
          }
        } catch (err) {
          logger.warn(`Error on ImmoBelt page ${pageCount + 1}`, { error: String(err) })
          hasMore = false
        }
      }

      return listings
    } catch (err) {
      logger.error('Failed to search ImmoBelt listings', { error: String(err) })
      return listings
    }
  }

  /**
   * Map ImmoBelt listing to RawDeal format
   */
  private mapListingToDeal(listing: ImmobeltListing): RawDeal {
    const price = listing.price || listing.price_range?.min || 0

    return {
      id: listing.id,
      title: listing.title || 'Commercial Property',
      address: listing.address,
      city: listing.city,
      province: listing.province,
      price,
      type: this.normalizePropertyType(listing.property_type),
      area_m2: listing.surface_area,
      build_year: listing.year_built,
      source: 'immobelt',
      source_url: listing.url,
      raw_data: {
        property_type: listing.property_type,
        status: listing.status,
        listed_date: listing.listed_date,
        owner: listing.owner,
        broker_name: listing.broker?.name,
        description: listing.description,
        images_count: listing.images?.length || 0,
      },
    }
  }

  /**
   * Normalize ImmoBelt property types
   */
  private normalizePropertyType(type: string): string {
    const typeMap: Record<string, string> = {
      kantoor: 'Office',
      retail: 'Retail',
      logistiek: 'Logistics',
      gemengd: 'Mixed-Use',
      'kantoor / retail': 'Office-Retail',
      winkel: 'Shop',
      horeca: 'Hospitality',
      industrie: 'Industrial',
    }

    return typeMap[type.toLowerCase()] || type
  }
}

/**
 * Export function for agent dispatcher
 */
export async function runImmobeltScraper(): Promise<{
  agent: string
  itemsFound: number
  itemsInserted: number
}> {
  const scraper = new ImmobeltScraperWorker()
  const result = await scraper.run()
  await scraper.recordScraperRun('ImmobeltScraper', result)

  return {
    agent: 'ImmobeltScraper',
    itemsFound: result.itemsFound,
    itemsInserted: result.itemsInserted,
  }
}
