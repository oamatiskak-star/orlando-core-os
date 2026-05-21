import { ScraperBase } from '../lib/scraper-base';
import { ScraperResult } from '../lib/types';
export declare class KadasterScraperWorker extends ScraperBase {
    private httpClient;
    private readonly BAG_SEARCH_URL;
    private readonly BAG_ADDRESS_URL;
    constructor();
    run(): Promise<ScraperResult>;
    /**
     * Enrich a single deal with Kadaster data
     */
    private enrichDeal;
    /**
     * Fetch BAG data for an address
     */
    private fetchBagData;
    /**
     * Search for address in BAG
     */
    private searchBagAddress;
    /**
     * Fetch building details
     */
    private fetchBuildingInfo;
}
/**
 * Export function for agent dispatcher
 */
export declare function runKadasterScraper(): Promise<{
    agent: string;
    itemsFound: number;
    itemsInserted: number;
}>;
//# sourceMappingURL=kadaster-scraper.d.ts.map