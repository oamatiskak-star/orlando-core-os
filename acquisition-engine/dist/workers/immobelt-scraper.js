"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImmobeltScraperWorker = void 0;
exports.runImmobeltScraper = runImmobeltScraper;
const scraper_base_1 = require("../lib/scraper-base");
const http_client_1 = require("../lib/http-client");
const logger_1 = require("../lib/logger");
class ImmobeltScraperWorker extends scraper_base_1.ScraperBase {
    constructor() {
        const config = {
            name: 'immobelt-scraper',
            rateLimitPerHour: 500, // Conservative: 500 req/day = 20/hour
            retryAttempts: 2,
            retryDelayMs: 1000,
            timeoutMs: 12000,
            domain: 'immobelt.nl',
        };
        super(config);
        // ImmoBelt endpoints (public API)
        this.SEARCH_URL = 'https://www.immobelt.nl/api/listings/search';
        this.DETAIL_URL = 'https://www.immobelt.nl/api/listings';
        this.httpClient = new http_client_1.HttpClient({
            timeout: config.timeoutMs,
            retries: config.retryAttempts,
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        });
    }
    async run() {
        const startTime = Date.now();
        let totalFound = 0;
        let totalInserted = 0;
        let totalSkipped = 0;
        let error;
        try {
            logger_1.logger.info('ImmobeltScraper starting');
            // Search for recent commercial listings
            const listings = await this.searchListings();
            totalFound = listings.length;
            if (totalFound === 0) {
                return {
                    success: true,
                    itemsFound: 0,
                    itemsInserted: 0,
                    itemsSkipped: 0,
                    duration_ms: Date.now() - startTime,
                };
            }
            logger_1.logger.info(`ImmobeltScraper found ${totalFound} listings`);
            // Convert to RawDeal format
            const deals = listings.map(listing => this.mapListingToDeal(listing));
            // Insert to database
            const { inserted, skipped } = await this.insertDeals(deals);
            totalInserted = inserted;
            totalSkipped = skipped;
            logger_1.logger.info('ImmobeltScraper completed', {
                found: totalFound,
                inserted: totalInserted,
                skipped: totalSkipped,
                duration_ms: Date.now() - startTime,
            });
            return {
                success: true,
                itemsFound: totalFound,
                itemsInserted: totalInserted,
                itemsSkipped: totalSkipped,
                duration_ms: Date.now() - startTime,
            };
        }
        catch (err) {
            error = err instanceof Error ? err.message : String(err);
            logger_1.logger.error('ImmobeltScraper failed', { error, duration_ms: Date.now() - startTime });
            return {
                success: false,
                itemsFound: totalFound,
                itemsInserted: totalInserted,
                itemsSkipped: totalSkipped,
                error,
                duration_ms: Date.now() - startTime,
            };
        }
    }
    /**
     * Search ImmoBelt for recent commercial listings
     */
    async searchListings() {
        const listings = [];
        try {
            // Search parameters: commercial property types, last 30 days
            const searchParams = {
                types: ['kantoor', 'retail', 'logistiek', 'gemengd'],
                status: ['te_koop', 'biedingen'],
                sortBy: 'recent',
                pageSize: 50,
                page: 1,
            };
            let hasMore = true;
            let pageCount = 0;
            const maxPages = 10; // Limit to first 10 pages (500 listings)
            while (hasMore && pageCount < maxPages) {
                try {
                    const response = await this.retryWithBackoff(() => this.httpClient.post(this.SEARCH_URL, {
                        ...searchParams,
                        page: pageCount + 1,
                    }), `Fetch ImmoBelt page ${pageCount + 1}`);
                    if (!response?.listings || response.listings.length === 0) {
                        hasMore = false;
                        break;
                    }
                    listings.push(...response.listings);
                    pageCount += 1;
                    hasMore = response.hasMore !== false;
                    // Rate limiting: 2 seconds between pages
                    if (hasMore) {
                        await this.sleep(2000);
                    }
                }
                catch (err) {
                    logger_1.logger.warn(`Error on ImmoBelt page ${pageCount + 1}`, { error: String(err) });
                    hasMore = false;
                }
            }
            return listings;
        }
        catch (err) {
            logger_1.logger.error('Failed to search ImmoBelt listings', { error: String(err) });
            return listings;
        }
    }
    /**
     * Map ImmoBelt listing to RawDeal format
     */
    mapListingToDeal(listing) {
        const price = listing.price || listing.price_range?.min || 0;
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
        };
    }
    /**
     * Normalize ImmoBelt property types
     */
    normalizePropertyType(type) {
        const typeMap = {
            kantoor: 'Office',
            retail: 'Retail',
            logistiek: 'Logistics',
            gemengd: 'Mixed-Use',
            'kantoor / retail': 'Office-Retail',
            winkel: 'Shop',
            horeca: 'Hospitality',
            industrie: 'Industrial',
        };
        return typeMap[type.toLowerCase()] || type;
    }
}
exports.ImmobeltScraperWorker = ImmobeltScraperWorker;
/**
 * Export function for agent dispatcher
 */
async function runImmobeltScraper() {
    const scraper = new ImmobeltScraperWorker();
    const result = await scraper.run();
    await scraper.recordScraperRun('ImmobeltScraper', result);
    return {
        agent: 'ImmobeltScraper',
        itemsFound: result.itemsFound,
        itemsInserted: result.itemsInserted,
    };
}
//# sourceMappingURL=immobelt-scraper.js.map