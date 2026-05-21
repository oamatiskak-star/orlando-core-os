import { ScraperBase } from '../lib/scraper-base';
import { ScraperResult } from '../lib/types';
export declare class KvKCompanyProfilerWorker extends ScraperBase {
    private httpClient;
    private readonly SEARCH_URL;
    private readonly PROFILES_URL;
    constructor();
    run(): Promise<ScraperResult>;
    /**
     * Fetch deals that need company enrichment (kvk_number IS NULL)
     */
    private fetchDealsNeedingEnrichment;
    /**
     * Search KvK for real estate developers in location
     */
    private searchDevelopers;
    /**
     * Map KvK company to enrichment record
     */
    private mapCompanyToEnrichment;
    /**
     * Batch insert enrichments to database
     */
    private insertEnrichments;
}
/**
 * Export function for agent dispatcher
 */
export declare function runKvKCompanyProfiler(): Promise<{
    agent: string;
    itemsFound: number;
    itemsInserted: number;
}>;
//# sourceMappingURL=kvk-company-profiler.d.ts.map