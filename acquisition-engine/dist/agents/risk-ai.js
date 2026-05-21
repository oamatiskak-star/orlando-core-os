"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runRiskAI = runRiskAI;
const supabase_1 = require("../lib/supabase");
const logger_1 = require("../lib/logger");
// RiskAI: herberekent risk_scores voor deals die ai_score hebben maar verouderde risk_score.
async function runRiskAI() {
    const start = Date.now();
    const AGENT = 'RiskAI';
    await setAgentStatus(AGENT, 'running');
    const { data: deals } = await supabase_1.supabase
        .from('acq_deals')
        .select('id, asking_price, estimated_value, energy_label, build_year, province, object_type, area_m2, pipeline_stage')
        .eq('status', 'actief')
        .not('ai_score', 'is', null)
        .or('risk_score.is.null,risk_score.eq.0')
        .limit(50);
    let processed = 0;
    for (const deal of deals ?? []) {
        const risk = computeDetailedRisk(deal);
        await supabase_1.supabase
            .from('acq_deals')
            .update({ risk_score: risk, updated_at: new Date().toISOString() })
            .eq('id', deal.id);
        processed++;
    }
    await setAgentStatus(AGENT, 'idle');
    logger_1.logger.info(`RiskAI run done`, { processed, duration_ms: Date.now() - start });
    return { agent: AGENT, jobsProcessed: processed, jobsCreated: 0, duration_ms: Date.now() - start };
}
function computeDetailedRisk(deal) {
    let risk = 25;
    // Financieel risico
    if (deal.asking_price && deal.estimated_value) {
        const ratio = deal.asking_price / deal.estimated_value;
        if (ratio > 1.1)
            risk += 20; // overprijsd
        if (ratio < 0.85)
            risk += 10; // te goedkoop = verborgen gebreken risico
    }
    if (deal.asking_price && deal.asking_price > 2000000)
        risk += 10; // groot ticket
    // Technisch risico
    if (deal.energy_label && ['F', 'G'].includes(deal.energy_label))
        risk += 15;
    if (deal.build_year && deal.build_year < 1940)
        risk += 15;
    else if (deal.build_year && deal.build_year < 1970)
        risk += 8;
    // Marktrisico
    const highRiskTypes = ['horeca', 'winkel', 'industrie'];
    if (deal.object_type && highRiskTypes.includes(deal.object_type))
        risk += 12;
    // Pipeline risico (hoe later hoe meer sunk cost risk)
    if (deal.pipeline_stage === 'due_diligence')
        risk += 5;
    if (deal.pipeline_stage === 'bod')
        risk += 8;
    return Math.max(0, Math.min(100, risk));
}
async function setAgentStatus(name, status) {
    await supabase_1.supabase
        .from('acq_agent_registry')
        .update({ status, last_heartbeat: new Date().toISOString() })
        .eq('name', name);
}
//# sourceMappingURL=risk-ai.js.map