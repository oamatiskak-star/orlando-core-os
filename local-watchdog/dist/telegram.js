"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendTelegram = sendTelegram;
const axios_1 = __importDefault(require("axios"));
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const ICONS = {
    info: 'ℹ️',
    warning: '⚠️',
    error: '🔴',
    critical: '🚨'
};
async function sendTelegram(severity, title, body) {
    if (!BOT_TOKEN || !CHAT_ID) {
        console.log(`[local-watchdog/telegram] (no credentials) ${severity} ${title}`);
        return;
    }
    const text = `${ICONS[severity]} <b>${escapeHtml(title)}</b>\n\n${escapeHtml(body).slice(0, 3500)}`;
    try {
        await axios_1.default.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, { chat_id: CHAT_ID, text, parse_mode: 'HTML', disable_web_page_preview: true }, { timeout: 10_000 });
    }
    catch (err) {
        console.error('[local-watchdog/telegram] send failed:', err instanceof Error ? err.message : err);
    }
}
function escapeHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
