"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const os_1 = require("os");
const recovery_1 = require("./recovery");
const telegram_1 = require("./telegram");
const PORT = parseInt(process.env.PORT ?? '3007', 10);
const CHECK_INTERVAL_MS = parseInt(process.env.CHECK_INTERVAL_MS ?? '30000', 10);
const HOST_ID = process.env.WATCHDOG_HOST_ID || (0, os_1.hostname)();
const SELF_APP_NAME = process.env.SELF_APP_NAME || 'local-watchdog';
const DENY_LIST = new Set((process.env.WATCHDOG_DENYLIST ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean));
let lastTickAt = null;
let lastTickError = null;
let lastCheckedCount = 0;
let lastFailingApps = [];
const app = (0, express_1.default)();
app.get('/health', (_req, res) => {
    res.json({
        ok: true,
        hostId: HOST_ID,
        self: SELF_APP_NAME,
        lastTickAt,
        lastTickError,
        lastCheckedCount,
        lastFailingApps,
        checkIntervalMs: CHECK_INTERVAL_MS
    });
});
app.post('/check-now', async (_req, res) => {
    await tick();
    res.json({ ok: true, lastTickAt, lastTickError, lastFailingApps });
});
async function tick() {
    try {
        const result = await (0, recovery_1.checkLocalFleet)({
            hostId: HOST_ID,
            selfAppName: SELF_APP_NAME,
            denyList: DENY_LIST
        });
        lastCheckedCount = result.count;
        lastFailingApps = result.failing;
        lastTickAt = new Date().toISOString();
        lastTickError = null;
        console.log(`[local-watchdog] tick: ${result.count} apps checked${result.failing.length ? ` | failing=${result.failing.join(',')}` : ''}`);
    }
    catch (err) {
        lastTickError = err instanceof Error ? err.message : String(err);
        console.error('[local-watchdog] tick error:', lastTickError);
    }
}
async function main() {
    app.listen(PORT, '127.0.0.1', () => console.log(`[local-watchdog] host=${HOST_ID} health on 127.0.0.1:${PORT}`));
    await (0, telegram_1.sendTelegram)('info', `🟢 Local Watchdog online on ${HOST_ID}`, `Monitoring PM2 fleet every ${Math.round(CHECK_INTERVAL_MS / 1000)}s. Crash-loop rebuild + restart enabled. Self-skip: ${SELF_APP_NAME}.`);
    await tick();
    setInterval(() => {
        void tick();
    }, CHECK_INTERVAL_MS);
}
void main();
process.on('unhandledRejection', (err) => {
    console.error('[local-watchdog] unhandledRejection:', err);
});
process.on('uncaughtException', (err) => {
    console.error('[local-watchdog] uncaughtException:', err);
});
