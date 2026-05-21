import { ScraperBase } from '../lib/scraper-base';
import { ScraperResult } from '../lib/types';
export declare class EnvironmentalRiskScraper extends ScraperBase {
    private httpClient;
    private readonly BIS_URL;
    private readonly IMRO_URL;
    private readonly HIS_RASTER;
    private readonly RIVM_LUCHTKWALITEIT;
    private readonly MILIEULOKET;
    constructor();
    run(): Promise<ScraperResult>;
    /**
     * Fetch deals needing environmental analysis
     */
    private fetchDealsNeedingAnalysis;
    /**
     * Fetch all environmental risks for a location
     */
    private fetchEnvironmentalRisks;
    /**
     * Fetch soil contamination data
     */
    private fetchSoilContamination;
    /**
     * Fetch flood risk data
     */
    private fetchFloodRisk;
    /**
     * Fetch heritage/monument status
     */
    private fetchHeritageStatus;
    /**
     * Fetch noise pollution data
     */
    private fetchNoisePollution;
    /**
     * Fetch hazmat/chemical site risks
     */
    private fetchHazmatRisks;
    /**
     * Fetch air quality data
     */
    private fetchAirQuality;
    /**
     * Map risks to analysis
     */
    private mapToAnalysis;
    /**
     * Score soil contamination risk
     */
    private scoreSoilRisk;
    /**
     * Score flood risk
     */
    private scoreFloodRisk;
    /**
     * Score noise pollution risk
     */
    private scoreNoiseRisk;
    /**
     * Score air quality risk
     */
    private scoreAirQuality;
    /**
     * Score hazmat risk
     */
    private scoreHazmatRisk;
    /**
     * Identify red flags
     */
    private identifyRedFlags;
    /**
     * Generate recommendations
     */
    private generateRecommendations;
    /**
     * Insert environmental analyses
     */
    private insertEnvironmentalAnalyses;
}
/**
 * Export function for agent dispatcher
 */
export declare function runEnvironmentalRiskScraper(): Promise<{
    agent: string;
    itemsFound: number;
    itemsInserted: number;
}>;
//# sourceMappingURL=environmental-risk-scraper.d.ts.map