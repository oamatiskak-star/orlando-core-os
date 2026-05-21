"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.KadasterScraperWorker = void 0;
exports.runKadasterScraper = runKadasterScraper;
const scraper_base_1 = require("../lib/scraper-base");
const http_client_1 = require("../lib/http-client");
const logger_1 = require("../lib/logger");
const supabase_1 = require("../lib/supabase");
class KadasterScraperWorker extends scraper_base_1.ScraperBase {
    constructor() {
        const config = {
            name: 'kadaster-scraper',
            rateLimitPerHour: 36000, // 100 req/10s = 36000/hour
            retryAttempts: 2,
            retryDelayMs: 500,
            timeoutMs: 10000,
            domain: 'bag.basisregistraties.overheid.nl',
        };
        super(config);
        // Kadaster public API endpoints
        this.BAG_SEARCH_URL = 'https://api.bag.basisregistraties.overheid.nl/edr/search/adres';
        this.BAG_ADDRESS_URL = 'https://api.bag.basisregistraties.overheid.nl/edr/v1/adresseringen';
        this.httpClient = new http_client_1.HttpClient({
            timeout: config.timeoutMs,
            retries: config.retryAttempts,
            userAgent: 'Mozilla/5.0 (acquisition-os/1.0) KadasterEnricher',
        });
    }
    async run() {
        const startTime = Date.now();
        let totalProcessed = 0;
        let totalEnriched = 0;
        let totalSkipped = 0;
        let error;
        try {
            logger_1.logger.info('KadasterScraper starting enrichment');
            // Fetch deals needing enrichment (no BAG ID yet)
            const { data: deals, error: fetchError } = await supabase_1.supabase
                .from('acq_deals')
                .select('id, address, postal_code, city')
                .is('bag_id', null)
                .limit(500); // Process up to 500 deals per run
            if (fetchError)
                throw fetchError;
            if (!deals || deals.length === 0) {
                return {
                    success: true,
                    itemsFound: 0,
                    itemsInserted: 0,
                    itemsSkipped: 0,
                    duration_ms: Date.now() - startTime,
                };
            }
            totalProcessed = deals.length;
            logger_1.logger.info(`KadasterScraper found ${totalProcessed} deals needing enrichment`);
            // Process in batches of 100 with 10s delays
            const batchSize = 100;
            for (let i = 0; i < deals.length; i += batchSize) {
                const batch = deals.slice(i, i + batchSize);
                const enrichments = await Promise.allSettled(batch.map(deal => this.enrichDeal(deal)));
                // Count successes
                for (const result of enrichments) {
                    if (result.status === 'fulfilled' && result.value) {
                        totalEnriched++;
                    }
                    else {
                        totalSkipped++;
                    }
                }
                // Rate limiting: wait 10s between batches (except last)
                if (i + batchSize < deals.length) {
                    await this.sleep(10000);
                }
            }
            logger_1.logger.info('KadasterScraper completed', {
                processed: totalProcessed,
                enriched: totalEnriched,
                skipped: totalSkipped,
                duration_ms: Date.now() - startTime,
            });
            return {
                success: true,
                itemsFound: totalProcessed,
                itemsInserted: totalEnriched,
                itemsSkipped: totalSkipped,
                duration_ms: Date.now() - startTime,
            };
        }
        catch (err) {
            error = err instanceof Error ? err.message : String(err);
            logger_1.logger.error('KadasterScraper failed', { error, duration_ms: Date.now() - startTime });
            return {
                success: false,
                itemsFound: totalProcessed,
                itemsInserted: totalEnriched,
                itemsSkipped: totalSkipped,
                error,
                duration_ms: Date.now() - startTime,
            };
        }
    }
    /**
     * Enrich a single deal with Kadaster data
     */
    async enrichDeal(deal) {
        try {
            const enrichment = await this.fetchBagData(deal.address, deal.postal_code, deal.city);
            if (!enrichment)
                return false;
            // Update deal with enrichment
            const { error } = await supabase_1.supabase
                .from('acq_deals')
                .update({
                bag_id: enrichment.bagId,
                building_id: enrichment.buildingId,
                build_year: enrichment.buildYear || undefined,
                property_status: enrichment.propertyStatus || undefined,
                woz_value: enrichment.wozValue || undefined,
                updated_at: new Date().toISOString(),
            })
                .eq('id', deal.id);
            if (error) {
                logger_1.logger.warn(`Failed to update deal ${deal.id} with Kadaster data`, { error: error.message });
                return false;
            }
            return true;
        }
        catch (err) {
            logger_1.logger.warn(`Error enriching deal ${deal.id}`, { error: String(err) });
            return false;
        }
    }
    /**
     * Fetch BAG data for an address
     */
    async fetchBagData(address, postalCode, city) {
        try {
            // Try to fetch via BAG API
            const bagAddress = await this.searchBagAddress(address, postalCode, city);
            if (!bagAddress)
                return null;
            // Fetch building info if we have the address ID
            const buildingInfo = bagAddress.pandidentificatie
                ? await this.fetchBuildingInfo(bagAddress.pandidentificatie)
                : null;
            return {
                bagId: bagAddress.identificatie,
                buildingId: bagAddress.pandidentificatie,
                buildYear: buildingInfo?.bouwjaar || buildingInfo?.oorspronkelijk_bouwjaar,
                propertyStatus: buildingInfo?.status,
            };
        }
        catch (err) {
            logger_1.logger.debug('Failed to fetch BAG data', { error: String(err) });
            return null;
        }
    }
    /**
     * Search for address in BAG
     */
    async searchBagAddress(address, postalCode, city) {
        try {
            const query = postalCode ? `${address} ${postalCode}` : address;
            const response = await this.retryWithBackoff(() => this.httpClient.get(`${this.BAG_SEARCH_URL}?q=${encodeURIComponent(query)}`), `Search BAG for ${address}`);
            if (!response?.adresseringen || response.adresseringen.length === 0) {
                return null;
            }
            const match = response.adresseringen[0];
            return {
                identificatie: match.identificatie,
                huisnummer: match.nummeraanduiding.huisnummer,
                huisletter: match.nummeraanduiding.huisletter,
                postcode: match.nummeraanduiding.postcode || '',
                woonplaats: match.nummeraanduiding.woonplaats,
                straatnaam: match.adres.straatnaam,
                gemeentecode: '',
                pandidentificatie: match.panden?.[0],
            };
        }
        catch (err) {
            logger_1.logger.debug(`BAG search failed for ${address}`, { error: String(err) });
            return null;
        }
    }
    /**
     * Fetch building details
     */
    async fetchBuildingInfo(buildingId) {
        try {
            const response = await this.retryWithBackoff(() => this.httpClient.get(`${this.BAG_ADDRESS_URL}/${buildingId}`), `Fetch building ${buildingId}`);
            if (!response?.panden || response.panden.length === 0) {
                return null;
            }
            const building = response.panden[0];
            return {
                identificatie: building.identificatie,
                pandidentificatie: building.identificatie,
                bouwjaar: building.bouwjaar,
                oorspronkelijk_bouwjaar: building.oorspronkelijk_bouwjaar,
                status: building.pandstatus,
            };
        }
        catch (err) {
            logger_1.logger.debug(`Failed to fetch building ${buildingId}`, { error: String(err) });
            return null;
        }
    }
}
exports.KadasterScraperWorker = KadasterScraperWorker;
/**
 * Export function for agent dispatcher
 */
async function runKadasterScraper() {
    const scraper = new KadasterScraperWorker();
    const result = await scraper.run();
    await scraper.recordScraperRun('KadasterScraper', result);
    return {
        agent: 'KadasterScraper',
        itemsFound: result.itemsFound,
        itemsInserted: result.itemsInserted,
    };
}
//# sourceMappingURL=kadaster-scraper.js.map