import { ScraperBase } from '../lib/scraper-base';
import { ScraperResult } from '../lib/types';
export declare class PermitsScraperWorker extends ScraperBase {
    private httpClient;
    private readonly IMOW_API;
    private readonly OVERHEID_API;
    constructor();
    run(): Promise<ScraperResult>;
    /**
     * Fetch recent building permits from IMOW
     */
    private fetchRecentPermits;
    /**
     * Insert permits to database with duplicate detection
     */
    private insertPermits;
    /**
     * Format address from location components
     */
    private formatAddress;
    /**
     * Map document types to permit type
     */
    private mapPermitType;
}
/**
 * Export function for agent dispatcher
 */
export declare function runPermitsScraper(): Promise<{
    agent: string;
    itemsFound: number;
    itemsInserted: number;
}>;
//# sourceMappingURL=permits-scraper.d.ts.map