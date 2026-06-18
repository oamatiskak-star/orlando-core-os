#!/usr/bin/env node
// ============================================================================
// SEO GSC + GA4 sync (Aquier kennisbank) — voedt vastgoed_core.seo_gsc_daily
// en seo_ga4_daily, die v_seo_revenue.impressions/clicks/ctr vullen (mig 215).
// ============================================================================
// Beantwoordt "worden de 274 kennisbank-pagina's opgepakt + hoeveel traffic":
//   - GSC Search Analytics  → impressions/clicks/ctr/positie per URL/dag
//   - GA4 Data API          → sessions/organic/engaged/conversions per landing
//
// Dependency-vrij: service-account JWT (RS256 via node:crypto) → OAuth token →
// REST calls → PostgREST upsert. Geen googleapis-package nodig.
//
// No-mock: zonder volledige creds → no-op (exit 0). Geen verzonnen cijfers.
//
// Env (verplicht voor sync):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//   GOOGLE_SA_EMAIL            service-account client_email
//   GOOGLE_SA_PRIVATE_KEY      service-account private_key (PEM; \n of echte newlines)
//   GSC_SITE_URL              bv. "sc-domain:aquier.com" of "https://aquier.com/"
//   GA4_PROPERTY_ID           numeriek GA4 property-id (zonder "properties/")
// Optioneel:
//   SEO_SYNC_DAYS             default 7 (GSC heeft ~2-3d data-lag)
//   SEO_SYNC_PATH_PREFIX      default "/kennisbank/"
// ============================================================================

import crypto from 'node:crypto';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SR_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SA_EMAIL = process.env.GOOGLE_SA_EMAIL;
const SA_KEY = (process.env.GOOGLE_SA_PRIVATE_KEY || '').replace(/\\n/g, '\n');
const GSC_SITE = process.env.GSC_SITE_URL;
const GA4_PROPERTY = process.env.GA4_PROPERTY_ID;
const DAYS = parseInt(process.env.SEO_SYNC_DAYS || '7', 10);
const PREFIX = process.env.SEO_SYNC_PATH_PREFIX || '/kennisbank/';

function ymd(d) { return d.toISOString().slice(0, 10); }
function daysAgo(n) { const d = new Date(); d.setUTCDate(d.getUTCDate() - n); return d; }

// ---- Service-account → OAuth2 access token (JWT bearer, RS256) -------------
function b64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}
async function getAccessToken(scope) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = b64url(JSON.stringify({
    iss: SA_EMAIL, scope, aud: 'https://oauth2.googleapis.com/token',
    iat: now, exp: now + 3600,
  }));
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(`${header}.${claim}`);
  const sig = b64url(signer.sign(SA_KEY));
  const jwt = `${header}.${claim}.${sig}`;
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });
  if (!res.ok) throw new Error(`token ${res.status}: ${await res.text()}`);
  return (await res.json()).access_token;
}

// ---- PostgREST upsert ------------------------------------------------------
async function upsert(table, rows, onConflict) {
  if (!rows.length) return 0;
  // schema vastgoed_core via Content-Profile header
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?on_conflict=${onConflict}`, {
      method: 'POST',
      headers: {
        apikey: SR_KEY, authorization: `Bearer ${SR_KEY}`,
        'content-type': 'application/json',
        'content-profile': 'vastgoed_core',
        prefer: 'resolution=merge-duplicates',
      },
      body: JSON.stringify(chunk),
    });
    if (!res.ok) throw new Error(`upsert ${table} ${res.status}: ${await res.text()}`);
  }
  return rows.length;
}

// ---- GSC Search Analytics --------------------------------------------------
async function syncGsc(token) {
  const body = {
    startDate: ymd(daysAgo(DAYS)), endDate: ymd(daysAgo(0)),
    dimensions: ['date', 'page'],
    dimensionFilterGroups: [{ filters: [{ dimension: 'page', operator: 'contains', expression: PREFIX }] }],
    rowLimit: 25000,
  };
  const res = await fetch(
    `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(GSC_SITE)}/searchAnalytics/query`,
    { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify(body) },
  );
  if (!res.ok) throw new Error(`gsc ${res.status}: ${await res.text()}`);
  const rows = ((await res.json()).rows || []).map((r) => ({
    date: r.keys[0],
    page: r.keys[1],
    clicks: Math.round(r.clicks || 0),
    impressions: Math.round(r.impressions || 0),
    ctr: +(r.ctr || 0).toFixed(4),
    position: +(r.position || 0).toFixed(2),
  }));
  const n = await upsert('seo_gsc_daily', rows, 'date,page');
  return { rows: n };
}

// ---- GA4 Data API ----------------------------------------------------------
async function syncGa4(token) {
  const body = {
    dateRanges: [{ startDate: `${DAYS}daysAgo`, endDate: 'today' }],
    dimensions: [{ name: 'date' }, { name: 'landingPagePlusQueryString' }],
    metrics: [{ name: 'sessions' }, { name: 'engagedSessions' }, { name: 'conversions' }],
    dimensionFilter: { filter: { fieldName: 'landingPagePlusQueryString', stringFilter: { matchType: 'CONTAINS', value: PREFIX } } },
    limit: 100000,
  };
  const res = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${GA4_PROPERTY}:runReport`,
    { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify(body) },
  );
  if (!res.ok) throw new Error(`ga4 ${res.status}: ${await res.text()}`);
  const rows = ((await res.json()).rows || []).map((r) => {
    const d = r.dimensionValues[0].value; // YYYYMMDD
    const path = (r.dimensionValues[1].value || '').split('?')[0];
    const m = r.metricValues;
    return {
      date: `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`,
      landing_path: path,
      sessions: Math.round(+m[0].value || 0),
      organic_sessions: 0, // optioneel later via sessionDefaultChannelGroup-segment
      engaged_sessions: Math.round(+m[1].value || 0),
      conversions: Math.round(+m[2].value || 0),
    };
  });
  const n = await upsert('seo_ga4_daily', rows, 'date,landing_path');
  return { rows: n };
}

async function main() {
  if (!SUPABASE_URL || !SR_KEY || !SA_EMAIL || !SA_KEY) {
    console.log('[seo-sync] creds incompleet → no-op'); return;
  }
  const out = {};
  if (GSC_SITE) {
    try { out.gsc = await syncGsc(await getAccessToken('https://www.googleapis.com/auth/webmasters.readonly')); }
    catch (e) { out.gsc = { error: String(e.message || e) }; }
  } else { out.gsc = 'GSC_SITE_URL ontbreekt → overslaan'; }
  if (GA4_PROPERTY) {
    try { out.ga4 = await syncGa4(await getAccessToken('https://www.googleapis.com/auth/analytics.readonly')); }
    catch (e) { out.ga4 = { error: String(e.message || e) }; }
  } else { out.ga4 = 'GA4_PROPERTY_ID ontbreekt → overslaan'; }
  console.log('[seo-sync]', JSON.stringify(out));
}

main().catch((e) => { console.error('[seo-sync] fatal', e); process.exit(1); });
