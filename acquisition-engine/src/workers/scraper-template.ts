import { ScraperBase } from '../lib/scraper-base'
import { HttpClient } from '../lib/http-client'
import { RobotsChecker } from '../lib/robots-checker'
import { ScraperConfig, ScraperResult, RawDeal } from '../lib/types'
import { logger } from '../lib/logger'

/**
 * Template for implementing scrapers.
 * Each scraper should:
 * 1. Extend ScraperBase with config
 * 2. Implement async run() method
 * 3. Use retryWithBackoff for external calls
 * 4. Insert deals via insertDeals()
 * 5. Return ScraperResult
 */

export class TemplateScraperWorker extends ScraperBase {
  private httpClient: HttpClient
  private robotsChecker: RobotsChecker

  constructor() {
    const config: ScraperConfig = {
      name: 'template-scraper',
      rateLimitPerHour: 150, // Adjust per API limits
      retryAttempts: 3,
      retryDelayMs: 1000,
      timeoutMs: 10000,
      domain: 'api.example.com',
    }
    super(config)
    this.httpClient = new HttpClient({ timeout: config.timeoutMs, retries: config.retryAttempts })
    this.robotsChecker = new RobotsChecker()
  }

  async run(): Promise<ScraperResult> {
    const startTime = Date.now()
    let itemsFound = 0
    let itemsInserted = 0
    let itemsSkipped = 0
    let error: string | undefined

    try {
      // Step 1: Check robots.txt
      const { allowed, crawlDelay } = await this.robotsChecker.canScrape(this.config.domain)
      if (!allowed) {
        return {
          success: false,
          itemsFound: 0,
          itemsInserted: 0,
          itemsSkipped: 0,
          error: `Scraping disallowed by ${this.config.domain}/robots.txt`,
          duration_ms: Date.now() - startTime,
        }
      }

      logger.info(`${this.config.name} starting. Crawl delay: ${crawlDelay}ms`)

      // Step 2: Fetch data
      const deals = await this.retryWithBackoff(
        () => this.fetchDeals(),
        'Fetch deals'
      )

      if (!deals) {
        return {
          success: false,
          itemsFound: 0,
          itemsInserted: 0,
          itemsSkipped: 0,
          error: 'Failed to fetch deals after retries',
          duration_ms: Date.now() - startTime,
        }
      }

      itemsFound = deals.length

      // Step 3: Respect crawl delay between batches
      await this.sleep(crawlDelay)

      // Step 4: Insert to database
      const { inserted, skipped } = await this.insertDeals(deals)
      itemsInserted = inserted
      itemsSkipped = skipped

      logger.info(`${this.config.name} completed`, {
        found: itemsFound,
        inserted: itemsInserted,
        skipped: itemsSkipped,
        duration_ms: Date.now() - startTime,
      })

      return {
        success: true,
        itemsFound,
        itemsInserted,
        itemsSkipped,
        duration_ms: Date.now() - startTime,
      }
    } catch (err) {
      error = err instanceof Error ? err.message : String(err)
      logger.error(`${this.config.name} failed`, { error })

      return {
        success: false,
        itemsFound,
        itemsInserted,
        itemsSkipped,
        error,
        duration_ms: Date.now() - startTime,
      }
    }
  }

  private async fetchDeals(): Promise<RawDeal[]> {
    // TODO: Implement API call + parsing
    // Example:
    // const response = await this.httpClient.get<ApiResponse>('https://api.example.com/listings')
    // return response?.items?.map(item => this.mapToRawDeal(item)) || []

    throw new Error('fetchDeals() not implemented - use this as a template')
  }

  // Helper: map API response to RawDeal format
  protected mapToRawDeal(apiItem: Record<string, unknown>): RawDeal {
    return {
      id: String(apiItem.id || ''),
      title: String(apiItem.title || ''),
      address: String(apiItem.address || ''),
      city: apiItem.city ? String(apiItem.city) : undefined,
      province: apiItem.province ? String(apiItem.province) : undefined,
      price: apiItem.price ? Number(apiItem.price) : undefined,
      type: apiItem.type ? String(apiItem.type) : undefined,
      area_m2: apiItem.area_m2 ? Number(apiItem.area_m2) : undefined,
      energy_label: apiItem.energy_label ? String(apiItem.energy_label) : undefined,
      build_year: apiItem.build_year ? Number(apiItem.build_year) : undefined,
      source: 'template-scraper', // Change to actual source name
      source_url: String(apiItem.url || apiItem.link || ''),
      raw_data: apiItem,
    }
  }
}

// Export factory function
export async function runTemplateScraper(): Promise<{ agent: string; itemsFound: number; itemsInserted: number }> {
  const scraper = new TemplateScraperWorker()
  const result = await scraper.run()
  await scraper.recordScraperRun('TemplateScraper', result)

  return {
    agent: 'TemplateScraper',
    itemsFound: result.itemsFound,
    itemsInserted: result.itemsInserted,
  }
}
