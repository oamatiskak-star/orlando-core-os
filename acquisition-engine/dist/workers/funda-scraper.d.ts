import { ScraperBase } from '../lib/scraper-base';
import { ScraperResult } from '../lib/types';
export declare class FundaScraperWorker extends ScraperBase {
    private httpClient;
    private robotsChecker;
    private readonly SEARCH_ENDPOINT;
    private readonly DETAIL_ENDPOINT;
    constructor();
    run(): Promise<ScraperResult>;
    /**
     * Fetch paginated listings from Funda app API
     * Implements aggressive rate limiting: 500ms-1s between requests
     */
    private fetchAllListings;
    /**
     * Search Funda listings via app API
     * Uses Elasticsearch-style search template
     */
    private searchFundaListings;
    /**
     * Build Elasticsearch search template for Funda API
     */
    private buildSearchQuery;
    /**
     * Map Funda listing to RawDeal format
     */
    private mapListingToDeal;
    /**
     * Dutch postal code → province mapping (simplified)
     */
    private extractProvinceFromPostalCode;
    /**
     * Normalize Funda property types to standard names
     */
    private normalizePropertyType;
}
/**
 * Export function for agent dispatcher
 */
export declare function runFundaScraper(): Promise<{
    agent: string;
    itemsFound: number;
    itemsInserted: number;
}>;
//# sourceMappingURL=funda-scraper.d.ts.map