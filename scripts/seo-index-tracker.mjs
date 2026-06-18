#!/usr/bin/env node
// ============================================================================
// SEO index-tracker (Aquier kennisbank) — wekelijks.
// Inspecteert elke gepubliceerde /kennisbank/-pagina via de GSC URL-Inspection
// API, telt de coverage-states (indexed / crawled-not-indexed / discovered /
// unknown), schrijft een snapshot naar vastgoed_core.seo_index_snapshots en
// stuurt optioneel een Telegram-rapport. Toont voortgang van de 274 pagina's.
//
// Dependency-vrij (node:crypto + fetch). No-mock: zonder creds → no-op (exit 0).
//
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GOOGLE_SA_EMAIL,
//      GOOGLE_SA_PRIVATE_KEY, GSC_SITE_URL (sc-domain:aquier.com)
// Optioneel: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, SEO_INDEX_LIMIT,
//            NEXT_PUBLIC_APP_URL (default https://aquier.com)
// ============================================================================

import crypto from 'node:crypto';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SR_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SA_EMAIL = process.env.GOOGLE_SA_EMAIL;
const SA_KEY = (process.env.GOOGLE_SA_PRIVATE_KEY || '').replace(/\\n/g, '\n');
const GSC_SITE = process.env.GSC_SITE_URL || 'sc-domain:aquier.com';
const BASE = (process.env.NEXT_PUBLIC_APP_URL || 'https://aquier.com').replace(/\/$/, '');
const LIMIT = parseInt(process.env.SEO_INDEX_LIMIT || '0', 10); // 0 = alle
const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TG_CHAT = process.env.TELEGRAM_CHAT_ID;

const b64url = (b) => Buffer.from(b).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

async function getToken() {
  const now = Math.floor(Date.now() / 1000);
  const h = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const c = b64url(JSON.stringify({
    iss: SA_EMAIL, scope: 'https://www.googleapis.com/auth/webmasters.readonly',
    aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600,
  }));
  const s = crypto.createSign('RSA-SHA256'); s.update(`${h}.${c}`);
  const jwt = `${h}.${c}.${b64url(s.sign(SA_KEY))}`;
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }),
  });
  if (!r.ok) throw new Error(`token ${r.status}: ${await r.text()}`);
  return (await r.json()).access_token;
}

async function listUrls() {
  let sel = 'url&status=eq.published&url=like./kennisbank/*';
  const r = await fetch(`${SUPABASE_URL}/rest/v1/seo_pages?select=${sel}&order=published_at.desc`, {
    headers: { apikey: SR_KEY, authorization: `Bearer ${SR_KEY}` },
  });
  if (!r.ok) throw new Error(`list ${r.status}: ${await r.text()}`);
  let rows = (await r.json()).map((x) => (x.url.startsWith('http') ? x.url : BASE + x.url));
  if (LIMIT > 0) rows = rows.slice(0, LIMIT);
  return rows;
}

function bucket(cov) {
  const c = (cov || '').toLowerCase();
  if (c.includes('unknown')) return 'unknown';
  if (c.includes('crawled') && c.includes('not indexed')) return 'crawled_not_indexed';
  if (c.includes('discovered') && c.includes('not indexed')) return 'discovered_not_indexed';
  if (c.includes('not indexed')) return 'other';
  if (c.includes('indexed')) return 'indexed';
  return 'other';
}

async function inspect(token, url) {
  const r = await fetch('https://searchconsole.googleapis.com/v1/urlInspection/index:inspect', {
    method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ inspectionUrl: url, siteUrl: GSC_SITE }),
  });
  if (r.status === 429) { await new Promise((s) => setTimeout(s, 2000)); return inspect(token, url); }
  if (!r.ok) return { url, cov: `error ${r.status}` };
  const cov = (await r.json()).inspectionResult?.indexStatusResult?.coverageState || 'no-data';
  return { url, cov };
}

async function main() {
  if (!SUPABASE_URL || !SR_KEY || !SA_EMAIL || !SA_KEY) { console.log('[seo-index] creds incompleet → no-op'); return; }
  const token = await getToken();
  const urls = await listUrls();
  const tally = { indexed: 0, crawled_not_indexed: 0, discovered_not_indexed: 0, unknown: 0, other: 0 };
  const byState = {};
  // beperkte concurrency (4) om quota/rate te respecteren
  const q = [...urls];
  async function worker() {
    while (q.length) {
      const u = q.shift();
      const { cov } = await inspect(token, u);
      tally[bucket(cov)]++;
      byState[cov] = (byState[cov] || 0) + 1;
    }
  }
  await Promise.all(Array.from({ length: 4 }, worker));

  const snapshot = { total: urls.length, ...tally, details: byState };
  const ins = await fetch(`${SUPABASE_URL}/rest/v1/seo_index_snapshots`, {
    method: 'POST',
    headers: { apikey: SR_KEY, authorization: `Bearer ${SR_KEY}`, 'content-type': 'application/json', 'content-profile': 'vastgoed_core' },
    body: JSON.stringify(snapshot),
  });
  if (!ins.ok) console.error('[seo-index] snapshot-insert faalde', ins.status, await ins.text());

  const pct = urls.length ? Math.round((100 * tally.indexed) / urls.length) : 0;
  const msg = `📊 Aquier kennisbank-indexatie\n` +
    `${tally.indexed}/${urls.length} geïndexeerd (${pct}%)\n` +
    `• Gecrawld, niet geïndexeerd: ${tally.crawled_not_indexed}\n` +
    `• Ontdekt, niet geïndexeerd: ${tally.discovered_not_indexed}\n` +
    `• Onbekend bij Google: ${tally.unknown}\n` +
    `• Overig: ${tally.other}`;
  console.log('[seo-index]', JSON.stringify(snapshot));
  console.log(msg);

  if (TG_TOKEN && TG_CHAT) {
    try {
      await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ chat_id: TG_CHAT, text: msg }),
      });
    } catch (e) { console.error('[seo-index] telegram faalde', String(e.message || e)); }
  }
}

main().catch((e) => { console.error('[seo-index] fatal', e); process.exit(1); });
