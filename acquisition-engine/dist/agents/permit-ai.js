"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runPermitAI = runPermitAI;
const supabase_1 = require("../lib/supabase");
const logger_1 = require("../lib/logger");
// PermitAI: berekent relevantie-scores voor vergunningaanvragen zonder score.
// Kijkt naar overlap met deals (zelfde gemeente / type), en update relevance_score.
async function runPermitAI() {
    const start = Date.now();
    const AGENT = 'PermitAI';
    await setAgentStatus(AGENT, 'running');
    const { data: permits } = await supabase_1.supabase
        .from('acq_permits')
        .select('id, municipality, permit_type, object_type, area_m2, status')
        .is('relevance_score', null)
        .limit(30);
    // Haal actieve deals op voor relevantie-match
    const { data: activeDeals } = await supabase_1.supabase
        .from('acq_deals')
        .select('city, province, object_type')
        .eq('status', 'actief');
    const dealCities = new Set((activeDeals ?? []).map(d => (d.city ?? '').toLowerCase()));
    const dealTypes = new Set((activeDeals ?? []).map(d => d.object_type ?? ''));
    let processed = 0;
    for (const permit of permits ?? []) {
        const score = scorePermit(permit, dealCities, dealTypes);
        await supabase_1.supabase
            .from('acq_permits')
            .update({ relevance_score: score })
            .eq('id', permit.id);
        processed++;
    }
    await setAgentStatus(AGENT, 'idle');
    logger_1.logger.info(`PermitAI run done`, { processed, duration_ms: Date.now() - start });
    return { agent: AGENT, jobsProcessed: processed, jobsCreated: 0, duration_ms: Date.now() - start };
}
function scorePermit(permit, dealCities, dealTypes) {
    let score = 20;
    if (dealCities.has(permit.municipality.toLowerCase()))
        score += 30;
    if (permit.object_type && dealTypes.has(permit.object_type))
        score += 20;
    const highValueTypes = ['omgevingsvergunning', 'splitsingsvergunning', 'bestemmingswijziging'];
    if (permit.permit_type && highValueTypes.includes(permit.permit_type))
        score += 20;
    if (permit.area_m2 !== null && permit.area_m2 >= 200)
        score += 10;
    if (permit.status === 'verleend')
        score += 5;
    return Math.max(0, Math.min(100, score));
}
async function setAgentStatus(name, status) {
    await supabase_1.supabase
        .from('acq_agent_registry')
        .update({ status, last_heartbeat: new Date().toISOString() })
        .eq('name', name);
}
//# sourceMappingURL=permit-ai.js.map