"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SpatialPlanningScraper = void 0;
exports.runSpatialPlanningScraper = runSpatialPlanningScraper;
const scraper_base_1 = require("../lib/scraper-base");
const http_client_1 = require("../lib/http-client");
const logger_1 = require("../lib/logger");
const supabase_1 = require("../lib/supabase");
class SpatialPlanningScraper extends scraper_base_1.ScraperBase {
    constructor() {
        const config = {
            name: 'spatial-planning-scraper',
            rateLimitPerHour: 3600, // 1 req/sec average (varies by municipality)
            retryAttempts: 2,
            retryDelayMs: 1000,
            timeoutMs: 15000,
            domain: 'ruimtelijkeplannen.nl',
        };
        super(config);
        // RUD API endpoints — WFS (Web Feature Service) for spatial data
        this.RUD_WFS_URL = 'https://www.ruimtelijkeplannen.nl/geonetwork/wfs';
        this.RUD_SEARCH_URL = 'https://www.ruimtelijkeplannen.nl/web/guest/plannen/list';
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
            logger_1.logger.info('SpatialPlanningScraper starting');
            // Fetch unique municipalities from deals
            const municipalities = await this.fetchUniqueMunicipalities();
            totalFound = municipalities.length;
            if (totalFound === 0) {
                return {
                    success: true,
                    itemsFound: 0,
                    itemsInserted: 0,
                    itemsSkipped: 0,
                    duration_ms: Date.now() - startTime,
                };
            }
            logger_1.logger.info(`SpatialPlanningScraper found ${totalFound} municipalities needing enrichment`);
            // Process each municipality
            const enrichments = [];
            for (let i = 0; i < municipalities.length; i++) {
                try {
                    const municipality = municipalities[i];
                    const planData = await this.fetchSpatialPlanData(municipality);
                    if (planData.length > 0) {
                        // Get deals in this municipality
                        const dealsInMuni = await this.fetchDealsInMunicipality(municipality);
                        for (const deal of dealsInMuni) {
                            const enrichment = this.mapToEnrichment(deal, municipality, planData);
                            enrichments.push(enrichment);
                        }
                    }
                    // Rate limiting: 1s per municipality (conservative)
                    if (i < municipalities.length - 1) {
                        await this.sleep(1000);
                    }
                }
                catch (err) {
                    logger_1.logger.warn(`Error processing municipality ${municipalities[i]}`, {
                        error: String(err),
                    });
                }
            }
            // Insert enrichments
            const { inserted, skipped } = await this.insertSpatialEnrichments(enrichments);
            totalInserted = inserted;
            totalSkipped = skipped;
            logger_1.logger.info('SpatialPlanningScraper completed', {
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
            logger_1.logger.error('SpatialPlanningScraper failed', { error, duration_ms: Date.now() - startTime });
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
     * Fetch unique municipalities from acq_deals
     */
    async fetchUniqueMunicipalities() {
        try {
            const { data, error } = await supabase_1.supabase
                .from('acq_deals')
                .select('city')
                .not('city', 'is', null)
                .limit(100);
            if (error)
                throw error;
            // Get unique cities
            const unique = [...new Set((data || []).map(d => d.city))].filter(Boolean);
            return unique;
        }
        catch (err) {
            logger_1.logger.error('Failed to fetch municipalities', { error: String(err) });
            return [];
        }
    }
    /**
     * Fetch spatial plan data for municipality from RUD WFS
     */
    async fetchSpatialPlanData(municipality) {
        const zones = [];
        try {
            // WFS query for spatial planning zones (allotmentplans, buildingzones)
            const wfsParams = {
                service: 'WFS',
                version: '2.0.0',
                request: 'GetFeature',
                typeName: 'app:Bestemmingsplangebied', // Zoning plan areas
                CQL_FILTER: `gemeente='${municipality}'`, // Municipality filter
                outputFormat: 'application/json',
                maxfeatures: '100',
            };
            const queryString = new URLSearchParams(wfsParams).toString();
            const response = await this.retryWithBackoff(() => this.httpClient.get(`${this.RUD_WFS_URL}?${queryString}`), `Fetch RUD zones for ${municipality}`);
            if (!response?.features || response.features.length === 0) {
                return zones;
            }
            // Map features to zone objects
            for (const feature of response.features) {
                try {
                    const zone = this.mapFeatureToZone(feature, municipality);
                    if (zone) {
                        zones.push(zone);
                    }
                }
                catch (err) {
                    logger_1.logger.warn(`Error mapping RUD feature for ${municipality}`, { error: String(err) });
                }
            }
            return zones;
        }
        catch (err) {
            logger_1.logger.error(`Failed to fetch RUD data for ${municipality}`, { error: String(err) });
            return zones;
        }
    }
    /**
     * Map WFS feature to SpatialPlanningZone
     */
    mapFeatureToZone(feature, municipality) {
        const props = feature.properties || {};
        if (!props.identificatie) {
            return null;
        }
        const zoneType = this.normalizeZoneType(props.bestemmingsplantype);
        return {
            id: props.identificatie,
            municipality,
            zone_name: props.naam || 'Onbekend',
            zone_type: zoneType,
            designation: props.bestemmingsplantype || 'mixed-use',
            allowed_uses: this.extractAllowedUses(props.bestemmingsplantype),
            development_potential: this.assessDevelopmentPotential(props.bestemmingsplantype),
            status: props.voorkomen?.[0]?.eindGeldigheid ? 'expired' : 'approved',
            valid_from: props.voorkomen?.[0]?.beginGeldigheid,
            valid_until: props.voorkomen?.[0]?.eindGeldigheid,
            geometry: feature.geometry,
            source_url: `https://www.ruimtelijkeplannen.nl/web/guest/plannen`,
        };
    }
    /**
     * Normalize Dutch zone types to English
     */
    normalizeZoneType(dutchType) {
        const typeMap = {
            woongebied: 'residential',
            bedrijventerrein: 'commercial',
            gemengd: 'mixed-use',
            industrie: 'industrial',
            landbouw: 'agricultural',
            groen: 'green',
            recreatie: 'recreational',
            kantoor: 'office',
            detailhandel: 'retail',
        };
        const normalized = typeMap[dutchType?.toLowerCase()] || 'mixed-use';
        return normalized;
    }
    /**
     * Extract allowed uses from zone type
     */
    extractAllowedUses(zoneType) {
        const useMap = {
            woongebied: ['residential', 'small-scale-retail'],
            bedrijventerrein: ['commercial', 'light-industrial', 'storage'],
            gemengd: ['residential', 'commercial', 'office'],
            industrie: ['industrial', 'manufacturing', 'logistics'],
            landbouw: ['agriculture', 'farming'],
            kantoor: ['office', 'professional-services'],
        };
        return useMap[zoneType?.toLowerCase()] || ['mixed-use'];
    }
    /**
     * Assess development potential based on zone type
     */
    assessDevelopmentPotential(zoneType) {
        const potentialMap = {
            bedrijventerrein: 'high',
            gemengd: 'high',
            woongebied: 'medium',
            kantoor: 'medium',
            groen: 'low',
            landbouw: 'low',
            industrie: 'restricted',
        };
        return potentialMap[zoneType?.toLowerCase()] || 'medium';
    }
    /**
     * Fetch deals in specific municipality
     */
    async fetchDealsInMunicipality(municipality) {
        try {
            const { data, error } = await supabase_1.supabase
                .from('acq_deals')
                .select('id')
                .eq('city', municipality)
                .is('spatial_planning_status', null)
                .limit(50);
            if (error)
                throw error;
            return data || [];
        }
        catch (err) {
            logger_1.logger.error(`Failed to fetch deals in ${municipality}`, { error: String(err) });
            return [];
        }
    }
    /**
     * Map to enrichment record
     */
    mapToEnrichment(deal, municipality, planData) {
        const opportunities = [];
        const restrictions = [];
        const riskIndicators = [];
        for (const zone of planData) {
            if (zone.development_potential === 'high') {
                opportunities.push(`High development potential in ${zone.zone_name}`);
            }
            if (zone.zone_type === 'agricultural') {
                restrictions.push(`Restricted use: ${zone.zone_name} is agricultural`);
            }
            if (zone.status === 'expired') {
                riskIndicators.push(`Expired planning status: ${zone.zone_name}`);
            }
        }
        return {
            id: `${deal.id}-spatial`,
            deal_id: deal.id,
            municipality,
            zones: planData.map(z => ({
                zone_type: z.zone_type,
                designation: z.designation,
                allowed_uses: z.allowed_uses,
                development_potential: z.development_potential,
            })),
            planning_status: planData.length > 0 ? 'analyzed' : 'pending',
            restrictions,
            opportunities,
            risk_indicators: riskIndicators,
            source_url: 'https://www.ruimtelijkeplannen.nl/web/guest/plannen',
            raw_data: {
                zones: planData.length,
                planData,
            },
        };
    }
    /**
     * Batch insert spatial enrichments
     */
    async insertSpatialEnrichments(enrichments) {
        if (enrichments.length === 0) {
            return { inserted: 0, skipped: 0 };
        }
        try {
            // Insert into acq_spatial_planning table
            const { error } = await supabase_1.supabase.from('acq_spatial_planning').upsert(enrichments, {
                onConflict: 'id',
            });
            if (error)
                throw error;
            // Update deals with planning status
            for (const enrichment of enrichments) {
                try {
                    await supabase_1.supabase
                        .from('acq_deals')
                        .update({
                        spatial_planning_status: enrichment.planning_status,
                    })
                        .eq('id', enrichment.deal_id);
                }
                catch (err) {
                    logger_1.logger.warn(`Failed to update deal ${enrichment.deal_id}`, { error: String(err) });
                }
            }
            return {
                inserted: enrichments.length,
                skipped: 0,
            };
        }
        catch (err) {
            logger_1.logger.error('Failed to insert spatial enrichments', { error: String(err) });
            return { inserted: 0, skipped: enrichments.length };
        }
    }
}
exports.SpatialPlanningScraper = SpatialPlanningScraper;
/**
 * Export function for agent dispatcher
 */
async function runSpatialPlanningScraper() {
    const scraper = new SpatialPlanningScraper();
    const result = await scraper.run();
    await scraper.recordScraperRun('SpatialPlanningScraper', result);
    return {
        agent: 'SpatialPlanningScraper',
        itemsFound: result.itemsFound,
        itemsInserted: result.itemsInserted,
    };
}
//# sourceMappingURL=spatial-planning-scraper.js.map