import { ScraperBase } from '../lib/scraper-base';
import { ScraperResult } from '../lib/types';
export declare class BuildingInspectionScraper extends ScraperBase {
    private httpClient;
    private apiKey;
    private readonly DVGO_INSPECTIONS_URL;
    private readonly BIM_PORTAL_URL;
    constructor();
    run(): Promise<ScraperResult>;
    /**
     * Fetch deals needing inspection enrichment
     */
    private fetchDealsNeedingEnrichment;
    /**
     * Fetch building inspections from DVGO API
     */
    private fetchBuildingInspections;
    /**
     * Map inspections to enrichment record
     */
    private mapToEnrichment;
    /**
     * Batch insert inspection enrichments
     */
    private insertInspectionEnrichments;
}
/**
 * Export function for agent dispatcher
 */
export declare function runBuildingInspectionScraper(): Promise<{
    agent: string;
    itemsFound: number;
    itemsInserted: number;
}>;
//# sourceMappingURL=building-inspection-scraper.d.ts.map