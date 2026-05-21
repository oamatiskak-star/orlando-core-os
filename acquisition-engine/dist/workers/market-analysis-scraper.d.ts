import { ScraperBase } from '../lib/scraper-base';
import { ScraperResult } from '../lib/types';
export declare class MarketAnalysisScraper extends ScraperBase {
    private httpClient;
    private readonly FUNDA_API;
    private readonly NVM_PORTAL;
    private readonly WOZ_DATA;
    constructor();
    run(): Promise<ScraperResult>;
    /**
     * Fetch deals needing market analysis
     */
    private fetchDealsNeedingAnalysis;
    /**
     * Fetch market data for a deal location
     */
    private fetchMarketData;
    /**
     * Fetch comparable sales in area
     */
    private fetchComparableSales;
    /**
     * Fetch market trends for location and type
     */
    private fetchMarketTrends;
    /**
     * Calculate similarity score between deal and comparable
     */
    private calculateSimilarity;
    /**
     * Estimate value based on comparables
     */
    private estimateValue;
    /**
     * Analyze market sentiment
     */
    private analyzeMarketSentiment;
    /**
     * Analyze supply/demand balance
     */
    private analyzeSupplyDemand;
    /**
     * Calculate investment score (0-100)
     */
    private calculateInvestmentScore;
    /**
     * Insert market analyses
     */
    private insertMarketAnalyses;
}
/**
 * Export function for agent dispatcher
 */
export declare function runMarketAnalysisScraper(): Promise<{
    agent: string;
    itemsFound: number;
    itemsInserted: number;
}>;
//# sourceMappingURL=market-analysis-scraper.d.ts.map