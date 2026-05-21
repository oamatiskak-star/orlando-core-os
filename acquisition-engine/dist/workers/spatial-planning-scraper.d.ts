import { ScraperBase } from '../lib/scraper-base';
import { ScraperResult } from '../lib/types';
export declare class SpatialPlanningScraper extends ScraperBase {
    private httpClient;
    private readonly RUD_WFS_URL;
    private readonly RUD_SEARCH_URL;
    constructor();
    run(): Promise<ScraperResult>;
    /**
     * Fetch unique municipalities from acq_deals
     */
    private fetchUniqueMunicipalities;
    /**
     * Fetch spatial plan data for municipality from RUD WFS
     */
    private fetchSpatialPlanData;
    /**
     * Map WFS feature to SpatialPlanningZone
     */
    private mapFeatureToZone;
    /**
     * Normalize Dutch zone types to English
     */
    private normalizeZoneType;
    /**
     * Extract allowed uses from zone type
     */
    private extractAllowedUses;
    /**
     * Assess development potential based on zone type
     */
    private assessDevelopmentPotential;
    /**
     * Fetch deals in specific municipality
     */
    private fetchDealsInMunicipality;
    /**
     * Map to enrichment record
     */
    private mapToEnrichment;
    /**
     * Batch insert spatial enrichments
     */
    private insertSpatialEnrichments;
}
/**
 * Export function for agent dispatcher
 */
export declare function runSpatialPlanningScraper(): Promise<{
    agent: string;
    itemsFound: number;
    itemsInserted: number;
}>;
//# sourceMappingURL=spatial-planning-scraper.d.ts.map