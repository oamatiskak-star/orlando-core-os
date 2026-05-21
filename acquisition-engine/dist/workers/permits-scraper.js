"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PermitsScraperWorker = void 0;
exports.runPermitsScraper = runPermitsScraper;
const scraper_base_1 = require("../lib/scraper-base");
const http_client_1 = require("../lib/http-client");
const logger_1 = require("../lib/logger");
const supabase_1 = require("../lib/supabase");
class PermitsScraperWorker extends scraper_base_1.ScraperBase {
    constructor() {
        const config = {
            name: 'permits-scraper',
            rateLimitPerHour: 1800, // 1 req/2s = 1800/hour (conservative)
            retryAttempts: 2,
            retryDelayMs: 1000,
            timeoutMs: 15000,
            domain: 'imow.overheid.nl',
        };
        super(config);
        // IMOW API and gemeente data portals
        this.IMOW_API = 'https://api.omgevingswet.overheid.nl/omgevingsdocumenten';
        this.OVERHEID_API = 'https://data.overheid.nl';
        this.httpClient = new http_client_1.HttpClient({
            timeout: config.timeoutMs,
            retries: config.retryAttempts,
            userAgent: 'Mozilla/5.0 (acquisition-os/1.0) PermitsScraper',
        });
    }
    async run() {
        const startTime = Date.now();
        let totalFound = 0;
        let totalInserted = 0;
        let totalSkipped = 0;
        let error;
        try {
            logger_1.logger.info('PermitsScraper starting');
            // Fetch recent permits from IMOW (last 30 days)
            const permits = await this.fetchRecentPermits();
            totalFound = permits.length;
            if (totalFound === 0) {
                return {
                    success: true,
                    itemsFound: 0,
                    itemsInserted: 0,
                    itemsSkipped: 0,
                    duration_ms: Date.now() - startTime,
                };
            }
            logger_1.logger.info(`PermitsScraper found ${totalFound} permits`);
            // Insert to database with duplicate detection
            const { inserted, skipped } = await this.insertPermits(permits);
            totalInserted = inserted;
            totalSkipped = skipped;
            logger_1.logger.info('PermitsScraper completed', {
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
            logger_1.logger.error('PermitsScraper failed', { error, duration_ms: Date.now() - startTime });
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
     * Fetch recent building permits from IMOW
     */
    async fetchRecentPermits() {
        const permits = [];
        try {
            // Fetch last 30 days of permits
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            const fromDate = thirtyDaysAgo.toISOString().split('T')[0];
            const response = await this.retryWithBackoff(() => this.httpClient.get(`${this.IMOW_API}?type=bouwvergunning&gemeentecode=*&wijzigingsdatum>${fromDate}&pageSize=100`), 'Fetch IMOW permits');
            if (!response?.documenten) {
                logger_1.logger.warn('No permits found in IMOW response');
                return permits;
            }
            // Map IMOW permits to common format
            for (const doc of response.documenten) {
                if (!doc.locatie)
                    continue;
                permits.push({
                    id: doc.identificatie,
                    address: this.formatAddress(doc.locatie),
                    postal_code: doc.locatie.postcode || '',
                    city: doc.locatie.woonplaatsnaam || '',
                    municipality: doc.locatie.woonplaatsnaam || '',
                    permit_type: this.mapPermitType(doc.documenttypes),
                    status: 'verleend', // IMOW typically shows published permits
                    application_date: doc.ingangsdatum || new Date().toISOString(),
                    permit_url: `https://omgevingswet.overheid.nl/omgevingsdocumenten/${doc.identificatie}`,
                    project_description: doc.onderwerp,
                });
            }
            return permits;
        }
        catch (err) {
            logger_1.logger.error('Failed to fetch IMOW permits', { error: String(err) });
            return permits;
        }
    }
    /**
     * Insert permits to database with duplicate detection
     */
    async insertPermits(permits) {
        let inserted = 0;
        let skipped = 0;
        // Batch insert with duplicate detection on (source, source_url)
        const permitRecords = permits.map(p => ({
            id: p.id,
            address: p.address,
            postal_code: p.postal_code,
            city: p.city,
            permit_type: p.permit_type,
            status: p.status,
            application_date: p.application_date,
            decision_date: p.decision_date || null,
            permit_source_url: p.permit_url,
            project_description: p.project_description,
            construction_area: p.surface_area,
            source: 'imow',
            source_url: p.permit_url || `imow://${p.id}`,
        }));
        try {
            const { error, count } = await supabase_1.supabase
                .from('acq_permits')
                .upsert(permitRecords, {
                onConflict: 'source,source_url',
                ignoreDuplicates: true,
            });
            if (error) {
                logger_1.logger.error('Error inserting permits', { error: error.message });
                return { inserted: 0, skipped: permits.length };
            }
            inserted = count || 0;
            skipped = permits.length - inserted;
            return { inserted, skipped };
        }
        catch (err) {
            logger_1.logger.error('Failed to insert permits', { error: String(err) });
            return { inserted: 0, skipped: permits.length };
        }
    }
    /**
     * Format address from location components
     */
    formatAddress(location) {
        const parts = [];
        if (location.straatnaam)
            parts.push(location.straatnaam);
        if (location.huisnummer)
            parts.push(location.huisnummer.toString());
        return parts.join(' ');
    }
    /**
     * Map document types to permit type
     */
    mapPermitType(documentTypes) {
        if (!documentTypes || documentTypes.length === 0)
            return 'bouwvergunning';
        const type = documentTypes[0].toLowerCase();
        if (type.includes('aanvraag'))
            return 'aanvraag';
        if (type.includes('meldingsproces'))
            return 'meldingsproces';
        return 'bouwvergunning';
    }
}
exports.PermitsScraperWorker = PermitsScraperWorker;
/**
 * Export function for agent dispatcher
 */
async function runPermitsScraper() {
    const scraper = new PermitsScraperWorker();
    const result = await scraper.run();
    await scraper.recordScraperRun('PermitsScraper', result);
    return {
        agent: 'PermitsScraper',
        itemsFound: result.itemsFound,
        itemsInserted: result.itemsInserted,
    };
}
//# sourceMappingURL=permits-scraper.js.map