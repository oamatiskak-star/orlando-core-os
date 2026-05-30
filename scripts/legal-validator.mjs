#!/usr/bin/env node
// ============================================================================
// Aquier Legal Compliance Validator — "Advocaat-AI" (LEGAL-AI, taak 23c92952)
// ============================================================================
// Een scherpe NL/EU-jurist-AI beoordeelt ELKE live Aquier-pagina (NL + /en) en
// FLAGT juridisch risico vóór marketing opschaalt. De AI flagt + stelt compliant
// copy voor; CERTIFICEERT NIET. Wft/AFM-eindpositionering + definitieve AV/
// privacyverklaring vereisen een menselijke jurist + Orlando-sign-off.
//
// Spiegelt commercial-validator.mjs: dependency-vrij (PostgREST + fetch + Anthropic).
// No-op zonder ANTHROPIC_API_KEY (exit 0). No-mock: onbereikbare pagina vastleggen,
// nooit verzinnen. Schrijft naar hermes.legal_review_runs + hermes.legal_findings
// (migratie 112) + view hermes.v_legal_gate.
//
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY (verplicht)
//      AQUIER_URL_NL (default https://aquier.com) · AQUIER_URL_US (default .../en)
//      LEGAL_MODEL (default claude-sonnet-4-6) · LEGAL_DRY_RUN (1 = log, geen DB)
// ============================================================================

const SUPABASE_URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const URL_NL = process.env.AQUIER_URL_NL || 'https://aquier.com';
const URL_US = process.env.AQUIER_URL_US || 'https://aquier.com/en';
const MODEL = process.env.LEGAL_MODEL || 'claude-sonnet-4-6';
const DRY = process.env.LEGAL_DRY_RUN === '1';

if (!SUPABASE_URL || !KEY) { console.error('[legal] SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY vereist'); process.exit(1); }
if (!ANTHROPIC_KEY) { console.log('[legal] geen ANTHROPIC_API_KEY → no-op (exit 0)'); process.exit(0); }

async function pg(method, path, { body, prefer, query = '' } = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}${query}`, {
    method,
    headers: { apikey: KEY, authorization: `Bearer ${KEY}`, 'content-type': 'application/json',
      'accept-profile': 'hermes', 'content-profile': 'hermes', ...(prefer ? { prefer } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { ok: res.ok, status: res.status, text: await res.text() };
}

// Pagina's NL + US (relatief pad; US-pagina's via /en-base).
const PAGES = [
  { path: '/', base: URL_NL }, { path: '/producten', base: URL_NL }, { path: '/pricing', base: URL_NL },
  { path: '/financiers', base: URL_NL }, { path: '/family-office', base: URL_NL }, { path: '/institutional', base: URL_NL },
  { path: '/beleggers', base: URL_NL }, { path: '/ontwikkelaars', base: URL_NL }, { path: '/makelaars', base: URL_NL },
  { path: '/dealfinders', base: URL_NL }, { path: '/hoe-we-werken', base: URL_NL },
  { path: '/privacybeleid', base: URL_NL }, { path: '/gebruiksvoorwaarden', base: URL_NL }, { path: '/garantiebeleid', base: URL_NL },
  { path: '', base: URL_US }, { path: '/pricing', base: URL_US }, { path: '/products', base: URL_US }, { path: '/how-it-works', base: URL_US },
];

function htmlToText(html) {
  return html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ').trim();
}
async function fetchPage(url) {
  try { const r = await fetch(url, { redirect: 'follow', headers: { 'user-agent': 'AquierLegalValidator/1.0' } });
    if (!r.ok) return { ok: false, status: r.status, text: '' };
    return { ok: true, status: r.status, text: htmlToText(await r.text()).slice(0, 14000) };
  } catch { return { ok: false, status: 0, text: '' }; }
}

function buildPrompt(url, country, text) {
  return `Je bent een scherpe Nederlandse advocaat (handelspraktijk + financieel toezicht + privacy), met EU-kennis. Beoordeel UITSLUITEND de tekst van deze ${country}-pagina van het vastgoed-intelligence-platform Aquier op JURIDISCH RISICO. Je FLAGT en stelt compliant copy voor; je CERTIFICEERT NIET.

Toets op deze categorieën:
1. misleidende_claims — Wet oneerlijke handelspraktijken / EU UCPD: verzonnen metrics, ongefundeerde superlatieven, suggestie van gerealiseerde klantresultaten, track record dat niet duidelijk als REKENVOORBEELD/gemodelleerd is gelabeld.
2. rendement_garantie — impliciete/expliciete rendementsgarantie; ROI/BAR/marge zonder "illustratief + band-afgeleid + disclaimer".
3. wft_afm — suggestie van beleggings-/financieel advies of bemiddeling (Aquier = screening/intelligence op publieke data, GEEN advies/bemiddeling). Flag elke zin die naar gereguleerd advies/bemiddeling neigt (incl. financieringspad).
4. avg_privacy — ontbrekende/ontoereikende privacy-/cookie-consent voor tracking (intent_events/GA4/PostHog), PII in copy, ontbrekend bezwaar/inzage.
5. voorwaarden — opzegtermijn, automatische verlenging (Wet van Dam), prijswijziging, herroepingsrecht (consument vs B2B).
6. sla_datakwaliteit — onhoudbare beloften (uptime/refresh/datakwaliteit) zonder onderbouwing.
7. social_proof — 'trusted by'/logos/testimonials/aantallen zonder echte basis.
8. ie_bronnen — onjuiste attributie/inbreuk (STABU, bouwkosten.nl), niet-transparante data-herkomst.
9. us_en — (alleen /en) US-beleggings-/RE-adviesclaims, ontbrekende 'not investment advice'/FTC-disclosure, misleidende vertaling.

PAGINA (${url}):
"""${text || '(geen/onbereikbare inhoud)'}"""

Geef UITSLUITEND geldige JSON (geen fences):
{"findings":[{"category":"<één van bovenstaande>","severity":"high|medium|low","risk_sentence":"<exacte risicozin uit de pagina>","legal_basis":"<juridische grondslag>","fix":"<concrete fix>","suggested_copy":"<compliant herformulering>"}],"page_ok":bool}
AVG: neem GEEN NAW/namen/adressen/telefoon/e-mail over in je output. Lege pagina → findings:[] + page_ok:false.`;
}

async function callLLM(prompt) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST', headers: { 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: MODEL, max_tokens: 4000, messages: [{ role: 'user', content: prompt }] }),
  });
  if (!r.ok) throw new Error(`anthropic ${r.status}: ${(await r.text()).slice(0,160)}`);
  const j = await r.json();
  let t = (j.content?.[0]?.text ?? '').trim().replace(/^```json\s*/i, '').replace(/```$/, '').trim();
  return JSON.parse(t);
}

(async () => {
  let runId = null;
  if (!DRY) {
    const r = await pg('POST', 'legal_review_runs', { body: [{ scope: 'aquier', status: 'running', model: MODEL, started_at: new Date().toISOString() }], prefer: 'return=representation' });
    if (!r.ok) { console.error('[legal] run insert faalde — migratie 112 toegepast?', r.status, r.text.slice(0,150)); process.exit(1); }
    runId = JSON.parse(r.text)[0].id;
  }
  let pages = 0, high = 0, medium = 0, low = 0; const openCats = new Set();
  for (const p of PAGES) {
    const url = `${p.base}${p.path}`; const country = p.base === URL_US ? 'US' : 'NL';
    const fetched = await fetchPage(url); pages++;
    let v; try { v = await callLLM(buildPrompt(url, country, fetched.text)); }
    catch (e) { console.error(`[legal] ${url}: ${e.message}`); continue; }
    for (const f of (v.findings ?? [])) {
      if (f.severity === 'high') high++; else if (f.severity === 'medium') medium++; else low++;
      if (f.severity !== 'low') openCats.add(f.category);
      console.log(`[legal] ${country} ${url} [${f.severity}] ${f.category}: ${(f.risk_sentence||'').slice(0,80)}`);
      if (DRY) continue;
      await pg('POST', 'legal_findings', { prefer: 'return=minimal', body: [{
        run_id: runId, page_url: url, country, category: f.category, severity: f.severity,
        risk_sentence: f.risk_sentence ?? null, legal_basis: f.legal_basis ?? null, fix: f.fix ?? null, suggested_copy: f.suggested_copy ?? null }] });
    }
  }
  if (!DRY && runId) {
    await pg('PATCH', 'legal_review_runs', { query: `?id=eq.${runId}`, prefer: 'return=minimal',
      body: { status: 'done', total_pages: pages, high_count: high, medium_count: medium, low_count: low,
        gate_open: high === 0, summary: { open_categories: [...openCats] }, finished_at: new Date().toISOString() } });
  }
  console.log(`[legal] klaar: ${pages} pagina's · ${high} high · ${medium} medium · ${low} low. Open risico-categorieën: ${[...openCats].join(', ') || 'geen'}.`);
  console.log(`[legal] LEGAL-GATE: ${high === 0 ? 'geen high-risk ✅ (medium/low review nodig)' : 'DICHT 🔒 — ' + high + ' high-risk findings'}. AI flagt, certificeert niet — Wft/AFM + AV/privacy: menselijke jurist + Orlando-sign-off.`);
})().catch((e) => { console.error('[legal] fout:', e.message); process.exit(1); });
