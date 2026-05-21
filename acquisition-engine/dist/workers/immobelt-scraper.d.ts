import { ScraperBase } from '../lib/scraper-base';
import { ScraperResult } from '../lib/types';
export declare class ImmobeltScraperWorker extends ScraperBase {
    private httpClient;
    private readonly SEARCH_URL;
    private readonly DETAIL_URL;
    constructor();
    run(): Promise<ScraperResult>;
    /**
     * Search ImmoBelt for recent commercial listings
     */
    private searchListings;
    /**
     * Map ImmoBelt listing to RawDeal format
     */
    private mapListingToDeal;
    /**
     * Normalize ImmoBelt property types
     */
    private normalizePropertyType;
}
/**
 * Export function for agent dispatcher
 */
export declare function runImmobeltScraper(): Promise<{
    agent: string;
    itemsFound: number;
    itemsInserted: number;
}>;
//# sourceMappingURL=immobelt-scraper.d.ts.map