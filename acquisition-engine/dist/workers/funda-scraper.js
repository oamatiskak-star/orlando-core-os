"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FundaScraperWorker = void 0;
exports.runFundaScraper = runFundaScraper;
const scraper_base_1 = require("../lib/scraper-base");
const http_client_1 = require("../lib/http-client");
const robots_checker_1 = require("../lib/robots-checker");
const logger_1 = require("../lib/logger");
class FundaScraperWorker extends scraper_base_1.ScraperBase {
    constructor() {
        const config = {
            name: 'funda-scraper',
            rateLimitPerHour: 360, // 6 per minute max = 360/hour (conservative)
            retryAttempts: 3,
            retryDelayMs: 500,
            timeoutMs: 15000,
            domain: 'funda.io',
        };
        super(config);
        // Funda app-facing API endpoints (from pyfunda research)
        this.SEARCH_ENDPOINT = 'https://listing-search-wonen.funda.io/_msearch/template';
        this.DETAIL_ENDPOINT = 'https://listing-detail-page.funda.io/api/v4/listing/object/nl';
        this.httpClient = new http_client_1.HttpClient({
            timeout: config.timeoutMs,
            retries: config.retryAttempts,
            userAgent: 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36',
        });
        this.robotsChecker = new robots_checker_1.RobotsChecker();
    }
    async run() {
        const startTime = Date.now();
        let totalFound = 0;
        let totalInserted = 0;
        let totalSkipped = 0;
        let error;
        try {
            // Check robots.txt for funda.nl
            const { allowed } = await this.robotsChecker.canScrape('funda.nl');
            if (!allowed) {
                return {
                    success: false,
                    itemsFound: 0,
                    itemsInserted: 0,
                    itemsSkipped: 0,
                    error: 'Scraping disallowed by funda.nl/robots.txt',
                    duration_ms: Date.now() - startTime,
                };
            }
            // Default search: all active property listings
            const searchParams = {
                pageSize: 50,
            };
            logger_1.logger.info('FundaScraper starting', { params: searchParams });
            // Fetch listings (paginate through results)
            const listings = await this.fetchAllListings(searchParams);
            totalFound = listings.length;
            logger_1.logger.info(`FundaScraper fetched ${totalFound} listings`, { duration_ms: Date.now() - startTime });
            // Convert to RawDeal format
            const deals = listings.map(listing => this.mapListingToDeal(listing));
            // Insert to database
            const { inserted, skipped } = await this.insertDeals(deals);
            totalInserted = inserted;
            totalSkipped = skipped;
            logger_1.logger.info('FundaScraper completed', {
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
            logger_1.logger.error('FundaScraper failed', { error, duration_ms: Date.now() - startTime });
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
     * Fetch paginated listings from Funda app API
     * Implements aggressive rate limiting: 500ms-1s between requests
     */
    async fetchAllListings(params) {
        const allListings = [];
        let page = 1;
        const maxPages = 10; // Limit to avoid excessive scraping (500 listings)
        let hasMore = true;
        while (hasMore && page <= maxPages) {
            try {
                // Build search query (Elasticsearch template)
                const response = await this.retryWithBackoff(() => this.searchFundaListings(page, params), `Fetch Funda page ${page}`);
                if (!response) {
                    hasMore = false;
                    break;
                }
                const listings = response;
                if (listings.length === 0) {
                    hasMore = false;
                    break;
                }
                allListings.push(...listings);
                page += 1;
                // Rate limiting: aggressive delay between pages
                await this.sleep(1000); // 1 second between pages
            }
            catch (err) {
                logger_1.logger.warn(`Error on Funda page ${page}`, { error: String(err) });
                hasMore = false;
            }
        }
        return allListings;
    }
    /**
     * Search Funda listings via app API
     * Uses Elasticsearch-style search template
     */
    async searchFundaListings(page, params) {
        try {
            // Build Elasticsearch query (based on pyfunda reverse-engineering)
            const query = this.buildSearchQuery(page, params);
            const response = await this.httpClient.post(this.SEARCH_ENDPOINT, query);
            if (!response || !response.responses || response.responses.length === 0) {
                return null;
            }
            const listings = response.responses[0]?.hits?.hits?.map(hit => hit._source) || [];
            return listings;
        }
        catch (err) {
            logger_1.logger.error('Failed to search Funda listings', { error: String(err) });
            return null;
        }
    }
    /**
     * Build Elasticsearch search template for Funda API
     */
    buildSearchQuery(page, params) {
        const from = (page - 1) * (params.pageSize || 50);
        // Elasticsearch query structure
        return {
            requests: [
                {
                    index: 'wonen-alias-prod',
                    type: '_doc',
                    body: {
                        query: {
                            bool: {
                                must: [
                                    {
                                        match_all: {},
                                    },
                                ],
                                filter: [
                                    {
                                        term: {
                                            status: 'active',
                                        },
                                    },
                                    {
                                        term: {
                                            'transaction_type.raw': 'sales',
                                        },
                                    },
                                ],
                            },
                        },
                        size: params.pageSize || 50,
                        from,
                        sort: [{ published_date: 'desc' }],
                        _source: [
                            'global_id',
                            'title',
                            'price',
                            'address',
                            'postal_code',
                            'city',
                            'number_of_bedrooms',
                            'surface_area',
                            'parcel_surface_area',
                            'property_type',
                            'building_year',
                            'energy_label',
                            'url',
                            'images',
                            'published_date',
                            'broker',
                        ],
                    },
                },
            ],
        };
    }
    /**
     * Map Funda listing to RawDeal format
     */
    mapListingToDeal(listing) {
        return {
            id: listing.global_id,
            title: listing.title || 'Unknown',
            address: listing.address,
            city: listing.city,
            province: this.extractProvinceFromPostalCode(listing.postal_code),
            price: listing.price?.amount,
            type: this.normalizePropertyType(listing.property_type),
            area_m2: listing.surface_area,
            energy_label: listing.energy_label,
            build_year: listing.building_year,
            source: 'funda',
            source_url: listing.url,
            raw_data: {
                parcel_surface_area: listing.parcel_surface_area,
                bedrooms: listing.number_of_bedrooms,
                broker_name: listing.broker?.name,
                published_date: listing.published_date,
            },
        };
    }
    /**
     * Dutch postal code → province mapping (simplified)
     */
    extractProvinceFromPostalCode(postalCode) {
        if (!postalCode)
            return undefined;
        const firstDigits = postalCode.substring(0, 2);
        const provinceMap = {
            '12': 'Groningen',
            '13': 'Friesland',
            '14': 'Drenthe',
            '15': 'Flevoland',
            '16': 'IJsselmeer',
            '17': 'Overijssel',
            '18': 'Gelderland',
            '19': 'Limburg',
            '20': 'Limburg',
            '21': 'Noord-Brabant',
            '22': 'Noord-Brabant',
            '23': 'Noord-Brabant',
            '24': 'Noord-Brabant',
            '25': 'Utrecht',
            '26': 'Utrecht',
            '27': 'Utrecht',
            '28': 'Utrecht',
            '29': 'Utrecht',
            '30': 'Utrecht',
            '31': 'Utrecht',
            '32': 'Utrecht',
            '33': 'Utrecht',
            '34': 'Flevoland',
            '35': 'Flevoland',
            '36': 'Flevoland',
            '37': 'Overijssel',
            '38': 'Overijssel',
            '39': 'Overijssel',
            '40': 'Overijssel',
            '41': 'Overijssel',
            '42': 'Overijssel',
            '43': 'Overijssel',
            '44': 'Overijssel',
            '45': 'Overijssel',
            '46': 'Overijssel',
            '47': 'Overijssel',
            '48': 'Overijssel',
            '49': 'Overijssel',
            '50': 'Gelderland',
            '51': 'Gelderland',
            '52': 'Gelderland',
            '53': 'Gelderland',
            '54': 'Gelderland',
            '55': 'Gelderland',
            '56': 'Gelderland',
            '57': 'Gelderland',
            '58': 'Gelderland',
            '59': 'Gelderland',
            '60': 'Gelderland',
            '61': 'Gelderland',
            '62': 'Gelderland',
            '63': 'Gelderland',
            '64': 'Gelderland',
            '65': 'Gelderland',
            '66': 'Gelderland',
            '67': 'Gelderland',
            '68': 'North-Holland',
            '69': 'North-Holland',
            '70': 'North-Holland',
            '71': 'North-Holland',
            '72': 'North-Holland',
            '73': 'North-Holland',
            '74': 'North-Holland',
            '75': 'North-Holland',
            '76': 'North-Holland',
            '77': 'North-Holland',
            '78': 'North-Holland',
            '79': 'North-Holland',
            '80': 'South-Holland',
            '81': 'South-Holland',
            '82': 'South-Holland',
            '83': 'South-Holland',
            '84': 'South-Holland',
            '85': 'South-Holland',
            '86': 'South-Holland',
            '87': 'South-Holland',
            '88': 'South-Holland',
            '89': 'South-Holland',
            '90': 'South-Holland',
            '91': 'South-Holland',
            '92': 'South-Holland',
            '93': 'South-Holland',
            '94': 'South-Holland',
            '95': 'South-Holland',
            '96': 'South-Holland',
            '97': 'South-Holland',
            '98': 'South-Holland',
            '99': 'South-Holland',
        };
        return provinceMap[firstDigits];
    }
    /**
     * Normalize Funda property types to standard names
     */
    normalizePropertyType(type) {
        if (!type)
            return undefined;
        const typeMap = {
            Eengezinswoning: 'House',
            Appartement: 'Apartment',
            Woonhuis: 'House',
            'Studio / kamer': 'Studio',
            Bungalow: 'Bungalow',
            'Twee-onder-een-kapwoning': 'Semi-Detached',
            Penthouse: 'Penthouse',
        };
        return typeMap[type] || type;
    }
}
exports.FundaScraperWorker = FundaScraperWorker;
/**
 * Export function for agent dispatcher
 */
async function runFundaScraper() {
    const scraper = new FundaScraperWorker();
    const result = await scraper.run();
    await scraper.recordScraperRun('FundaScraper', result);
    return {
        agent: 'FundaScraper',
        itemsFound: result.itemsFound,
        itemsInserted: result.itemsInserted,
    };
}
//# sourceMappingURL=funda-scraper.js.map