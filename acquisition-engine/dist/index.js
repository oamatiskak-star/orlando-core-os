"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const node_cron_1 = __importDefault(require("node-cron"));
const logger_1 = require("./lib/logger");
const supabase_1 = require("./lib/supabase");
const deal_hunter_1 = require("./agents/deal-hunter");
const offmarket_ai_1 = require("./agents/offmarket-ai");
const permit_ai_1 = require("./agents/permit-ai");
const municipality_ai_1 = require("./agents/municipality-ai");
const investor_ai_1 = require("./agents/investor-ai");
const outreach_ai_1 = require("./agents/outreach-ai");
const risk_ai_1 = require("./agents/risk-ai");
const acquisition_director_1 = require("./agents/acquisition-director");
const build_opps_scanner_1 = require("./agents/build-opps-scanner");
const funda_scraper_1 = require("./workers/funda-scraper");
const kadaster_scraper_1 = require("./workers/kadaster-scraper");
const permits_scraper_1 = require("./workers/permits-scraper");
const app = (0, express_1.default)();
app.use(express_1.default.json());
const PORT = parseInt(process.env.PORT ?? '3005', 10);
const TZ = process.env.AGENT_TIMEZONE ?? 'Europe/Amsterdam';
async function withAgentGuard(agentName, fn) {
    try {
        const result = await fn();
        return result;
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await supabase_1.supabase
            .from('acq_agent_registry')
            .update({ status: 'error', last_heartbeat: new Date().toISOString() })
            .eq('name', agentName);
        logger_1.logger.error(`${agentName} guard caught error`, { message });
        throw err;
    }
}
// ── Health ───────────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
    res.json({
        status: 'ok',
        service: 'acquisition-engine',
        time: new Date().toISOString(),
        tz: TZ,
    });
});
// ── Manual trigger endpoints ─────────────────────────────────────────────────
app.post('/agents/deal-hunter/run', async (_req, res) => {
    try {
        const result = await withAgentGuard('DealHunter', deal_hunter_1.runDealHunter);
        res.json({ status: 'ok', ...result });
    }
    catch (err) {
        res.status(500).json({ status: 'error', error: err.message });
    }
});
app.post('/agents/offmarket-ai/run', async (_req, res) => {
    try {
        const result = await withAgentGuard('OffMarketAI', offmarket_ai_1.runOffMarketAI);
        res.json({ status: 'ok', ...result });
    }
    catch (err) {
        res.status(500).json({ status: 'error', error: err.message });
    }
});
app.post('/agents/permit-ai/run', async (_req, res) => {
    try {
        const result = await withAgentGuard('PermitAI', permit_ai_1.runPermitAI);
        res.json({ status: 'ok', ...result });
    }
    catch (err) {
        res.status(500).json({ status: 'error', error: err.message });
    }
});
app.post('/agents/municipality-ai/run', async (_req, res) => {
    try {
        const result = await withAgentGuard('MunicipalityAI', municipality_ai_1.runMunicipalityAI);
        res.json({ status: 'ok', ...result });
    }
    catch (err) {
        res.status(500).json({ status: 'error', error: err.message });
    }
});
app.post('/agents/investor-ai/run', async (_req, res) => {
    try {
        const result = await withAgentGuard('InvestorAI', investor_ai_1.runInvestorAI);
        res.json({ status: 'ok', ...result });
    }
    catch (err) {
        res.status(500).json({ status: 'error', error: err.message });
    }
});
app.post('/agents/outreach-ai/run', async (_req, res) => {
    try {
        const result = await withAgentGuard('OutreachAI', outreach_ai_1.runOutreachAI);
        res.json({ status: 'ok', ...result });
    }
    catch (err) {
        res.status(500).json({ status: 'error', error: err.message });
    }
});
app.post('/agents/risk-ai/run', async (_req, res) => {
    try {
        const result = await withAgentGuard('RiskAI', risk_ai_1.runRiskAI);
        res.json({ status: 'ok', ...result });
    }
    catch (err) {
        res.status(500).json({ status: 'error', error: err.message });
    }
});
app.post('/agents/director/run', async (_req, res) => {
    try {
        const result = await withAgentGuard('AcquisitionDirectorAI', acquisition_director_1.runAcquisitionDirector);
        res.json({ status: 'ok', ...result });
    }
    catch (err) {
        res.status(500).json({ status: 'error', error: err.message });
    }
});
app.post('/agents/build-opps-scanner/run', async (_req, res) => {
    try {
        const result = await withAgentGuard('BuildOppsScanner', build_opps_scanner_1.runBuildOppsScanner);
        res.json({ status: 'ok', ...result });
    }
    catch (err) {
        res.status(500).json({ status: 'error', error: err.message });
    }
});
app.post('/workers/funda-scraper/run', async (_req, res) => {
    try {
        const result = await withAgentGuard('FundaScraper', funda_scraper_1.runFundaScraper);
        res.json({ status: 'ok', ...result });
    }
    catch (err) {
        res.status(500).json({ status: 'error', error: err.message });
    }
});
app.post('/workers/kadaster-scraper/run', async (_req, res) => {
    try {
        const result = await withAgentGuard('KadasterScraper', kadaster_scraper_1.runKadasterScraper);
        res.json({ status: 'ok', ...result });
    }
    catch (err) {
        res.status(500).json({ status: 'error', error: err.message });
    }
});
app.post('/workers/permits-scraper/run', async (_req, res) => {
    try {
        const result = await withAgentGuard('PermitsScraper', permits_scraper_1.runPermitsScraper);
        res.json({ status: 'ok', ...result });
    }
    catch (err) {
        res.status(500).json({ status: 'error', error: err.message });
    }
});
// ── Scan jobs endpoint (Vercel cron callback) ────────────────────────────────
// POST /scan — Vercel cron routes inserteren scan_jobs, worker pakt ze op
app.post('/scan', async (_req, res) => {
    try {
        const results = await Promise.allSettled([
            withAgentGuard('DealHunter', deal_hunter_1.runDealHunter),
            withAgentGuard('PermitAI', permit_ai_1.runPermitAI),
            withAgentGuard('RiskAI', risk_ai_1.runRiskAI),
            withAgentGuard('InvestorAI', investor_ai_1.runInvestorAI),
        ]);
        res.json({ status: 'ok', results: results.map(r => r.status === 'fulfilled' ? r.value : { error: r.reason.message }) });
    }
    catch (err) {
        res.status(500).json({ status: 'error', error: err.message });
    }
});
// ── Cron schedules ────────────────────────────────────────────────────────────
// DealHunter: elk uur scan van queued jobs + ongescoorde deals
node_cron_1.default.schedule('0 * * * *', () => {
    withAgentGuard('DealHunter', deal_hunter_1.runDealHunter)
        .catch(err => logger_1.logger.error('Scheduled DealHunter failed', { err: String(err) }));
}, { timezone: TZ });
// OffMarketAI: elke 2 uur nieuwe leads verrijken
node_cron_1.default.schedule('0 */2 * * *', () => {
    withAgentGuard('OffMarketAI', offmarket_ai_1.runOffMarketAI)
        .catch(err => logger_1.logger.error('Scheduled OffMarketAI failed', { err: String(err) }));
}, { timezone: TZ });
// PermitAI: elke 4 uur relevantie-scores bijwerken
node_cron_1.default.schedule('30 */4 * * *', () => {
    withAgentGuard('PermitAI', permit_ai_1.runPermitAI)
        .catch(err => logger_1.logger.error('Scheduled PermitAI failed', { err: String(err) }));
}, { timezone: TZ });
// MunicipalityAI: dagelijks om 06:00 gemeente-profielen verrijken
node_cron_1.default.schedule('0 6 * * *', () => {
    withAgentGuard('MunicipalityAI', municipality_ai_1.runMunicipalityAI)
        .catch(err => logger_1.logger.error('Scheduled MunicipalityAI failed', { err: String(err) }));
}, { timezone: TZ });
// InvestorAI: 3x per dag investor-deal matching
node_cron_1.default.schedule('0 8,13,18 * * *', () => {
    withAgentGuard('InvestorAI', investor_ai_1.runInvestorAI)
        .catch(err => logger_1.logger.error('Scheduled InvestorAI failed', { err: String(err) }));
}, { timezone: TZ });
// OutreachAI: elke 30 min geplande berichten genereren
node_cron_1.default.schedule('*/30 * * * *', () => {
    withAgentGuard('OutreachAI', outreach_ai_1.runOutreachAI)
        .catch(err => logger_1.logger.error('Scheduled OutreachAI failed', { err: String(err) }));
}, { timezone: TZ });
// RiskAI: elke 2 uur risk scores bijwerken
node_cron_1.default.schedule('15 */2 * * *', () => {
    withAgentGuard('RiskAI', risk_ai_1.runRiskAI)
        .catch(err => logger_1.logger.error('Scheduled RiskAI failed', { err: String(err) }));
}, { timezone: TZ });
// AcquisitionDirectorAI: dagelijkse briefing om 07:30
node_cron_1.default.schedule('30 7 * * *', () => {
    withAgentGuard('AcquisitionDirectorAI', acquisition_director_1.runAcquisitionDirector)
        .catch(err => logger_1.logger.error('Scheduled AcquisitionDirector failed', { err: String(err) }));
}, { timezone: TZ });
// BuildOppsScanner: dagelijks om 06:30 (na bouw-scan cron)
node_cron_1.default.schedule('30 6 * * *', () => {
    withAgentGuard('BuildOppsScanner', build_opps_scanner_1.runBuildOppsScanner)
        .catch(err => logger_1.logger.error('Scheduled BuildOppsScanner failed', { err: String(err) }));
}, { timezone: TZ });
// FundaScraper: elke 4 uur (00:00, 04:00, 08:00, etc.) — 150 listings/run
node_cron_1.default.schedule('0 */4 * * *', () => {
    withAgentGuard('FundaScraper', funda_scraper_1.runFundaScraper)
        .catch(err => logger_1.logger.error('Scheduled FundaScraper failed', { err: String(err) }));
}, { timezone: TZ });
// KadasterScraper: dagelijks om 05:00 deals verrijken met BAG data
node_cron_1.default.schedule('0 5 * * *', () => {
    withAgentGuard('KadasterScraper', kadaster_scraper_1.runKadasterScraper)
        .catch(err => logger_1.logger.error('Scheduled KadasterScraper failed', { err: String(err) }));
}, { timezone: TZ });
// PermitsScraper: dagelijks om 07:00 recente bouwvergunningen ophalen
node_cron_1.default.schedule('0 7 * * *', () => {
    withAgentGuard('PermitsScraper', permits_scraper_1.runPermitsScraper)
        .catch(err => logger_1.logger.error('Scheduled PermitsScraper failed', { err: String(err) }));
}, { timezone: TZ });
// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
    logger_1.logger.info(`Acquisition Engine started on :${PORT} (tz=${TZ})`);
    logger_1.logger.info('11 cron schedules: DealHunter, OffMarketAI, PermitAI, MunicipalityAI, InvestorAI, OutreachAI, RiskAI, AcquisitionDirectorAI, FundaScraper, KadasterScraper, PermitsScraper');
});
process.on('SIGTERM', () => {
    logger_1.logger.info('SIGTERM received — shutting down');
    process.exit(0);
});
//# sourceMappingURL=index.js.map