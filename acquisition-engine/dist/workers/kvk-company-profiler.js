"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.KvKCompanyProfilerWorker = void 0;
exports.runKvKCompanyProfiler = runKvKCompanyProfiler;
const scraper_base_1 = require("../lib/scraper-base");
const http_client_1 = require("../lib/http-client");
const logger_1 = require("../lib/logger");
const supabase_1 = require("../lib/supabase");
class KvKCompanyProfilerWorker extends scraper_base_1.ScraperBase {
    constructor() {
        const config = {
            name: 'kvk-profiler',
            rateLimitPerHour: 36000, // 10 req/sec
            retryAttempts: 2,
            retryDelayMs: 500,
            timeoutMs: 10000,
            domain: 'kvk.nl',
        };
        super(config);
        // KvK API endpoint (public API, no auth required)
        this.SEARCH_URL = 'https://api.kvk.nl/api/v1/search';
        this.PROFILES_URL = 'https://api.kvk.nl/api/v1/companies';
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
            logger_1.logger.info('KvKCompanyProfiler starting');
            // Fetch companies needing enrichment from acq_deals
            const dealsNeedingEnrichment = await this.fetchDealsNeedingEnrichment();
            totalFound = dealsNeedingEnrichment.length;
            if (totalFound === 0) {
                return {
                    success: true,
                    itemsFound: 0,
                    itemsInserted: 0,
                    itemsSkipped: 0,
                    duration_ms: Date.now() - startTime,
                };
            }
            logger_1.logger.info(`KvKCompanyProfiler found ${totalFound} deals needing enrichment`);
            // Process each deal: search for developer company
            const enrichments = [];
            for (let i = 0; i < dealsNeedingEnrichment.length; i++) {
                try {
                    const deal = dealsNeedingEnrichment[i];
                    // Search for companies in city/area that develop real estate
                    const companies = await this.searchDevelopers(deal.city, deal.province);
                    if (companies.length > 0) {
                        // Take first match (highest relevance)
                        const company = companies[0];
                        enrichments.push(this.mapCompanyToEnrichment(company, deal.id));
                    }
                    // Rate limiting: respect KvK's 10 req/sec
                    if (i < dealsNeedingEnrichment.length - 1) {
                        await this.sleep(100);
                    }
                }
                catch (err) {
                    logger_1.logger.warn(`Error enriching deal ${dealsNeedingEnrichment[i].id}`, {
                        error: String(err),
                    });
                }
            }
            // Insert enrichments to database
            const { inserted, skipped } = await this.insertEnrichments(enrichments);
            totalInserted = inserted;
            totalSkipped = skipped;
            logger_1.logger.info('KvKCompanyProfiler completed', {
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
            logger_1.logger.error('KvKCompanyProfiler failed', { error, duration_ms: Date.now() - startTime });
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
     * Fetch deals that need company enrichment (kvk_number IS NULL)
     */
    async fetchDealsNeedingEnrichment() {
        try {
            const { data, error } = await supabase_1.supabase
                .from('acq_deals')
                .select('id, city, province')
                .is('kvk_number', null)
                .limit(50); // Process max 50 per run
            if (error)
                throw error;
            return data || [];
        }
        catch (err) {
            logger_1.logger.error('Failed to fetch deals needing enrichment', { error: String(err) });
            return [];
        }
    }
    /**
     * Search KvK for real estate developers in location
     */
    async searchDevelopers(city, province) {
        const companies = [];
        try {
            // Search for real estate development companies
            const searchTerms = [
                'bouw',
                'ontwikkeling',
                'project',
                'ondernemer',
                'makelaar',
                'aannemer',
            ];
            for (const term of searchTerms) {
                try {
                    const response = await this.retryWithBackoff(() => this.httpClient.get(`${this.SEARCH_URL}?q=${term}%20${encodeURIComponent(city)}&limit=5`), `Search KvK for ${term} in ${city}`);
                    if (!response?.companies || response.companies.length === 0) {
                        continue;
                    }
                    // Fetch detailed profile for each result
                    for (const co of response.companies) {
                        try {
                            const detailed = await this.retryWithBackoff(() => this.httpClient.get(`${this.PROFILES_URL}/${co.kvkNumber}`), `Fetch KvK profile ${co.kvkNumber}`);
                            if (detailed && detailed.kvkNumber) {
                                companies.push(detailed);
                            }
                            await this.sleep(100);
                        }
                        catch (err) {
                            logger_1.logger.warn(`Failed to fetch KvK profile for ${co.kvkNumber}`, {
                                error: String(err),
                            });
                        }
                    }
                    // Rate limiting
                    await this.sleep(100);
                    // Stop after finding some matches
                    if (companies.length > 0)
                        break;
                }
                catch (err) {
                    logger_1.logger.warn(`Error searching KvK for ${term}`, { error: String(err) });
                }
            }
            return companies;
        }
        catch (err) {
            logger_1.logger.error(`Failed to search KvK developers in ${city}`, { error: String(err) });
            return companies;
        }
    }
    /**
     * Map KvK company to enrichment record
     */
    mapCompanyToEnrichment(company, dealId) {
        return {
            id: `${dealId}-kvk`,
            kvk_number: company.kvkNumber,
            company_name: company.name || company.businessName || 'Unknown',
            address: company.address,
            city: company.city,
            province: company.province,
            establishment_date: company.establishmentDate,
            business_status: company.businessStatus,
            sbi_codes: company.industries?.map(ind => ind.sbiCode) || [],
            employees: company.employees,
            website: company.websites?.[0],
            phone: company.phone,
            email: company.email,
            source_url: `https://www.kvk.nl/zoeken/?q=${company.kvkNumber}`,
            raw_data: {
                kvkNumber: company.kvkNumber,
                businessStatus: company.businessStatus,
                industries: company.industries,
                websites: company.websites,
            },
        };
    }
    /**
     * Batch insert enrichments to database
     */
    async insertEnrichments(enrichments) {
        if (enrichments.length === 0) {
            return { inserted: 0, skipped: 0 };
        }
        try {
            // Create or update acq_company_profiles table
            const { error, data } = await supabase_1.supabase
                .from('acq_company_profiles')
                .upsert(enrichments, {
                onConflict: 'id',
            });
            if (error)
                throw error;
            // Also update acq_deals with kvk_number reference
            const kvkUpdates = enrichments.map(e => ({
                id: e.id.split('-kvk')[0],
                kvk_number: e.kvk_number,
            }));
            for (const update of kvkUpdates) {
                try {
                    await supabase_1.supabase.from('acq_deals').update(update).eq('id', update.id);
                }
                catch (err) {
                    logger_1.logger.warn(`Failed to update deal ${update.id} with KvK reference`, {
                        error: String(err),
                    });
                }
            }
            return {
                inserted: enrichments.length,
                skipped: 0,
            };
        }
        catch (err) {
            logger_1.logger.error('Failed to insert company enrichments', { error: String(err) });
            return { inserted: 0, skipped: enrichments.length };
        }
    }
}
exports.KvKCompanyProfilerWorker = KvKCompanyProfilerWorker;
/**
 * Export function for agent dispatcher
 */
async function runKvKCompanyProfiler() {
    const profiler = new KvKCompanyProfilerWorker();
    const result = await profiler.run();
    await profiler.recordScraperRun('KvKCompanyProfiler', result);
    return {
        agent: 'KvKCompanyProfiler',
        itemsFound: result.itemsFound,
        itemsInserted: result.itemsInserted,
    };
}
//# sourceMappingURL=kvk-company-profiler.js.map