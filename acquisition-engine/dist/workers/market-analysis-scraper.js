"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MarketAnalysisScraper = void 0;
exports.runMarketAnalysisScraper = runMarketAnalysisScraper;
const scraper_base_1 = require("../lib/scraper-base");
const http_client_1 = require("../lib/http-client");
const logger_1 = require("../lib/logger");
const supabase_1 = require("../lib/supabase");
class MarketAnalysisScraper extends scraper_base_1.ScraperBase {
    constructor() {
        const config = {
            name: 'market-analysis-scraper',
            rateLimitPerHour: 2000, // 500 req/hour per source × 4 sources
            retryAttempts: 2,
            retryDelayMs: 500,
            timeoutMs: 15000,
            domain: 'funda.nl',
        };
        super(config);
        // Data sources
        this.FUNDA_API = 'https://api.funda.nl/api/v1/market-analysis';
        this.NVM_PORTAL = 'https://www.nvm.nl/api/market-data';
        this.WOZ_DATA = 'https://data.overheid.nl/woz-values';
        this.httpClient = new http_client_1.HttpClient({
            timeout: config.timeoutMs,
            retries: config.retryAttempts,
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        });
    }
    async run() {
        const startTime = Date.now();
        let totalFound = 0;
        let totalInserted = 0;
        let totalSkipped = 0;
        let error;
        try {
            logger_1.logger.info('MarketAnalysisScraper starting');
            // Fetch deals needing market analysis
            const dealsNeedingAnalysis = await this.fetchDealsNeedingAnalysis();
            totalFound = dealsNeedingAnalysis.length;
            if (totalFound === 0) {
                return {
                    success: true,
                    itemsFound: 0,
                    itemsInserted: 0,
                    itemsSkipped: 0,
                    duration_ms: Date.now() - startTime,
                };
            }
            logger_1.logger.info(`MarketAnalysisScraper found ${totalFound} deals needing analysis`);
            // Process each deal
            const analyses = [];
            for (let i = 0; i < dealsNeedingAnalysis.length; i++) {
                try {
                    const deal = dealsNeedingAnalysis[i];
                    const marketData = await this.fetchMarketData(deal);
                    if (marketData) {
                        analyses.push(marketData);
                    }
                    // Rate limiting: 500 req/hour = 7.2s per request (conservative)
                    if (i < dealsNeedingAnalysis.length - 1) {
                        await this.sleep(500);
                    }
                }
                catch (err) {
                    logger_1.logger.warn(`Error analyzing deal ${dealsNeedingAnalysis[i].id}`, {
                        error: String(err),
                    });
                }
            }
            // Insert analyses
            const { inserted, skipped } = await this.insertMarketAnalyses(analyses);
            totalInserted = inserted;
            totalSkipped = skipped;
            logger_1.logger.info('MarketAnalysisScraper completed', {
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
            logger_1.logger.error('MarketAnalysisScraper failed', { error, duration_ms: Date.now() - startTime });
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
     * Fetch deals needing market analysis
     */
    async fetchDealsNeedingAnalysis() {
        try {
            const { data, error } = await supabase_1.supabase
                .from('acq_deals')
                .select('id, address, city, province, object_type, area_m2, asking_price')
                .is('market_analysis_status', null)
                .limit(40);
            if (error)
                throw error;
            return (data || []).map(d => ({
                id: d.id,
                address: d.address,
                city: d.city,
                province: d.province,
                object_type: d.object_type,
                area_m2: d.area_m2,
                price: d.asking_price,
            }));
        }
        catch (err) {
            logger_1.logger.error('Failed to fetch deals needing analysis', { error: String(err) });
            return [];
        }
    }
    /**
     * Fetch market data for a deal location
     */
    async fetchMarketData(deal) {
        try {
            // Fetch comparable sales in area
            const comparables = await this.fetchComparableSales(deal);
            // Fetch market trends
            const marketTrends = await this.fetchMarketTrends(deal.city, deal.object_type);
            if (!comparables || comparables.length === 0) {
                return null;
            }
            // Calculate estimated value based on comparables
            const estimatedValue = this.estimateValue(comparables, deal);
            // Analyze market sentiment
            const sentiment = this.analyzeMarketSentiment(marketTrends);
            const balanceScore = this.analyzeSupplyDemand(marketTrends);
            // Calculate investment score
            const investmentScore = this.calculateInvestmentScore(deal, comparables, estimatedValue, sentiment);
            return {
                id: `${deal.id}-market`,
                deal_id: deal.id,
                address: deal.address,
                city: deal.city,
                property_type: deal.object_type || 'unknown',
                area_m2: deal.area_m2,
                estimated_value: estimatedValue,
                market_comparison: {
                    last_3_months: {
                        avg_price: marketTrends.last_3m?.avg_price,
                        median_price: marketTrends.last_3m?.median_price,
                        transactions: marketTrends.last_3m?.transaction_count,
                    },
                    last_12_months: {
                        avg_price: marketTrends.last_12m?.avg_price,
                        median_price: marketTrends.last_12m?.median_price,
                        transactions: marketTrends.last_12m?.transaction_count,
                        trend: marketTrends.last_12m?.trend,
                    },
                },
                comparable_sales: comparables.slice(0, 5), // Top 5 most similar
                market_sentiment: sentiment,
                supply_demand_balance: balanceScore,
                investment_score: investmentScore,
                raw_data: {
                    comparable_count: comparables.length,
                    market_data: marketTrends,
                },
            };
        }
        catch (err) {
            logger_1.logger.error(`Failed to fetch market data for ${deal.address}`, { error: String(err) });
            return null;
        }
    }
    /**
     * Fetch comparable sales in area
     */
    async fetchComparableSales(deal) {
        try {
            const response = await this.retryWithBackoff(() => this.httpClient.get(`${this.FUNDA_API}/comparables?city=${encodeURIComponent(deal.city)}&type=${deal.object_type || 'all'}&limit=10`), `Fetch comparables for ${deal.city}`);
            if (!response?.comparables) {
                return [];
            }
            // Score similarity
            return response.comparables
                .map(c => ({
                id: c.id,
                address: c.address,
                city: c.city,
                type: c.type,
                price: c.price,
                sale_date: c.saleDate,
                area_m2: c.areaSqm,
                year_built: c.yearBuilt,
                distance_km: c.distanceKm,
                similarity_score: this.calculateSimilarity(deal, c),
            }))
                .sort((a, b) => b.similarity_score - a.similarity_score);
        }
        catch (err) {
            logger_1.logger.warn(`Failed to fetch comparables for ${deal.city}`, { error: String(err) });
            return [];
        }
    }
    /**
     * Fetch market trends for location and type
     */
    async fetchMarketTrends(city, propertyType) {
        try {
            const response = await this.retryWithBackoff(() => this.httpClient.get(`${this.FUNDA_API}/trends?city=${encodeURIComponent(city)}&type=${propertyType || 'all'}`), `Fetch market trends for ${city}`);
            const trends = {};
            if (response?.periods) {
                for (const p of response.periods) {
                    if (p.period === 'last_3_months') {
                        trends.last_3m = {
                            location: city,
                            property_type: propertyType || 'all',
                            period: p.period,
                            avg_price: p.avgPrice,
                            median_price: p.medianPrice,
                            transaction_count: p.transactions,
                            source: 'funda',
                        };
                    }
                    else if (p.period === 'last_12_months') {
                        trends.last_12m = {
                            location: city,
                            property_type: propertyType || 'all',
                            period: p.period,
                            avg_price: p.avgPrice,
                            median_price: p.medianPrice,
                            transaction_count: p.transactions,
                            price_trend: p.trend,
                            source: 'funda',
                        };
                    }
                }
            }
            return trends;
        }
        catch (err) {
            logger_1.logger.warn(`Failed to fetch trends for ${city}`, { error: String(err) });
            return {};
        }
    }
    /**
     * Calculate similarity score between deal and comparable
     */
    calculateSimilarity(deal, comparable) {
        let score = 50; // Base score
        // Same type bonus
        if (deal.object_type === comparable.type) {
            score += 20;
        }
        // Similar size bonus (within 20%)
        if (deal.area_m2 && comparable.areaSqm) {
            const diff = Math.abs(deal.area_m2 - comparable.areaSqm) / deal.area_m2;
            if (diff < 0.2) {
                score += 20;
            }
            else if (diff < 0.5) {
                score += 10;
            }
        }
        // Recent sale bonus
        const saleDate = new Date(comparable.saleDate);
        const monthsAgo = (Date.now() - saleDate.getTime()) / (30 * 24 * 60 * 60 * 1000);
        if (monthsAgo < 3) {
            score += 15;
        }
        else if (monthsAgo < 12) {
            score += 10;
        }
        return Math.min(100, Math.max(0, score));
    }
    /**
     * Estimate value based on comparables
     */
    estimateValue(comparables, deal) {
        if (comparables.length === 0) {
            return deal.price || 0;
        }
        // Weight by similarity score
        let totalPrice = 0;
        let totalWeight = 0;
        for (const comp of comparables.slice(0, 5)) {
            const weight = comp.similarity_score / 100;
            totalPrice += comp.price * weight;
            totalWeight += weight;
        }
        return totalWeight > 0 ? Math.round(totalPrice / totalWeight) : deal.price || 0;
    }
    /**
     * Analyze market sentiment
     */
    analyzeMarketSentiment(marketTrends) {
        const trend = marketTrends.last_12m?.trend || 0;
        if (trend > 5) {
            return 'bullish';
        }
        else if (trend < -5) {
            return 'bearish';
        }
        return 'neutral';
    }
    /**
     * Analyze supply/demand balance
     */
    analyzeSupplyDemand(marketTrends) {
        const last3mTrans = marketTrends.last_3m?.transaction_count || 0;
        const last12mTrans = (marketTrends.last_12m?.transaction_count || 1) / 4;
        const ratio = last3mTrans / last12mTrans;
        if (ratio > 1.3) {
            return 'demand_surplus';
        }
        else if (ratio < 0.7) {
            return 'supply_surplus';
        }
        return 'balanced';
    }
    /**
     * Calculate investment score (0-100)
     */
    calculateInvestmentScore(deal, comparables, estimatedValue, sentiment) {
        let score = 50;
        // Value assessment (comparing asking price to estimated value)
        if (deal.price && estimatedValue) {
            const ratio = deal.price / estimatedValue;
            if (ratio < 0.85) {
                score += 20; // Good deal (15%+ below market)
            }
            else if (ratio < 0.95) {
                score += 10; // Slight discount
            }
            else if (ratio > 1.2) {
                score -= 15; // Overpriced
            }
        }
        // Market sentiment
        if (sentiment === 'bullish') {
            score += 10;
        }
        else if (sentiment === 'bearish') {
            score -= 10;
        }
        // Comparable availability
        if (comparables.length > 5) {
            score += 5;
        }
        return Math.min(100, Math.max(0, score));
    }
    /**
     * Insert market analyses
     */
    async insertMarketAnalyses(analyses) {
        if (analyses.length === 0) {
            return { inserted: 0, skipped: 0 };
        }
        try {
            const { error } = await supabase_1.supabase
                .from('acq_market_analysis')
                .upsert(analyses, {
                onConflict: 'id',
            });
            if (error)
                throw error;
            // Update deals with valuation and investment score
            for (const analysis of analyses) {
                try {
                    await supabase_1.supabase
                        .from('acq_deals')
                        .update({
                        estimated_value: analysis.estimated_value,
                        market_analysis_status: 'analyzed',
                    })
                        .eq('id', analysis.deal_id);
                }
                catch (err) {
                    logger_1.logger.warn(`Failed to update deal ${analysis.deal_id}`, { error: String(err) });
                }
            }
            return {
                inserted: analyses.length,
                skipped: 0,
            };
        }
        catch (err) {
            logger_1.logger.error('Failed to insert market analyses', { error: String(err) });
            return { inserted: 0, skipped: analyses.length };
        }
    }
}
exports.MarketAnalysisScraper = MarketAnalysisScraper;
/**
 * Export function for agent dispatcher
 */
async function runMarketAnalysisScraper() {
    const scraper = new MarketAnalysisScraper();
    const result = await scraper.run();
    await scraper.recordScraperRun('MarketAnalysisScraper', result);
    return {
        agent: 'MarketAnalysisScraper',
        itemsFound: result.itemsFound,
        itemsInserted: result.itemsInserted,
    };
}
//# sourceMappingURL=market-analysis-scraper.js.map