#!/usr/bin/env node
// ============================================================================
// Buyer-Intent Gate — PRIMAIRE conversie-/scale-gate (KPI-REFRAME)
// ============================================================================
// Would_Buy (commercial-validator.mjs) = content-QA DIAGNOSTIEK: het toetst of de
// COPY de bezwaren van een vijandige koper wegneemt. Het is GEEN vraag-metric en
// blijft per definitie laag tegen een "glas azijn"-rechter — dus niet de go/no-go.
//
// De ECHTE conversie-/scale-beslissing draait op GEDRAG: de Buyer-Intent-engine
// (vastgoed_core.intent_events + v_buyer_intent) meet eerstpartij koopintentie van
// echte bezoekers. Dit script leest die view en geeft het scale-verdict — zodra er
// verkeer is. Geen verkeer → INSUFFICIENT DATA (blijf optimaliseren + Would_Buy als
// copy-diagnose), niet "dicht".
//
// No-mock: leest ECHTE productie-data. AVG: alleen anonieme visitor_id's, geen PII.
//
// Env:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY            (verplicht; anders no-op exit 0)
//   BI_MIN_VISITORS     (default 50)  minimaal aantal bezoekers met intent vóór signaal
//   BI_MIN_SALES_READY  (default 5)   Sales-Ready bezoekers om de scale-gate te openen
//   BI_MIN_HOTPLUS_PCT  (default 10)  % bezoekers op Hot+ (Hot + Sales-Ready)
// ============================================================================

const SUPABASE_URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const MIN_VISITORS = Number(process.env.BI_MIN_VISITORS || 50);
const MIN_SALES_READY = Number(process.env.BI_MIN_SALES_READY || 5);
const MIN_HOTPLUS_PCT = Number(process.env.BI_MIN_HOTPLUS_PCT || 10);

if (!SUPABASE_URL || !KEY) {
  console.log('[bi-gate] SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY vereist → no-op (exit 0)');
  process.exit(0);
}

async function rest(path, { count = false, range } = {}) {
  const headers = {
    apikey: KEY, authorization: `Bearer ${KEY}`,
    'accept-profile': 'vastgoed_core', accept: 'application/json',
  };
  if (count) headers.prefer = 'count=exact';
  if (range) headers.range = range;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers });
  const cr = res.headers.get('content-range'); // bv. "0-0/123"
  const total = cr && cr.includes('/') ? Number(cr.split('/')[1]) : null;
  const body = await res.json().catch(() => []);
  return { ok: res.ok, status: res.status, body, total };
}

function isoDaysAgo(d) { return new Date(Date.now() - d * 86400000).toISOString(); }

(async () => {
  // 1. Tier-verdeling per bezoeker uit de view.
  const v = await rest('v_buyer_intent?select=tier');
  if (!v.ok) { console.error('[bi-gate] v_buyer_intent onbereikbaar:', v.status, JSON.stringify(v.body).slice(0, 160)); process.exit(1); }
  const rows = Array.isArray(v.body) ? v.body : [];
  const visitors = rows.length;
  const by = { Cold: 0, Warm: 0, Hot: 0, 'Sales Ready': 0 };
  for (const r of rows) if (r.tier in by) by[r.tier]++;
  const salesReady = by['Sales Ready'];
  const hotPlus = by.Hot + by['Sales Ready'];
  const hotPlusPct = visitors ? Math.round((hotPlus / visitors) * 1000) / 10 : 0;

  // 2. 7d-trend op echte events (laatste 7d vs de 7d daarvoor).
  const last7 = await rest(`intent_events?select=id&created_at=gte.${isoDaysAgo(7)}`, { count: true, range: '0-0' });
  const prev7 = await rest(`intent_events?select=id&created_at=gte.${isoDaysAgo(14)}&created_at=lt.${isoDaysAgo(7)}`, { count: true, range: '0-0' });
  const e7 = last7.total ?? 0, ePrev = prev7.total ?? 0;
  const trendPct = ePrev > 0 ? Math.round(((e7 - ePrev) / ePrev) * 100) : (e7 > 0 ? 100 : 0);

  // 3. Verdict.
  let gate, reason;
  if (visitors < MIN_VISITORS) {
    gate = 'INSUFFICIENT DATA';
    reason = `slechts ${visitors} bezoekers met intent (< ${MIN_VISITORS}). Blijf optimaliseren + verkeer sturen; gebruik Would_Buy als copy-diagnose. Nog geen gedrag om op te beslissen.`;
  } else if (salesReady >= MIN_SALES_READY && hotPlusPct >= MIN_HOTPLUS_PCT && trendPct >= 0) {
    gate = 'OPEN — SCALE';
    reason = `${salesReady} Sales-Ready, ${hotPlusPct}% Hot+ (≥ ${MIN_HOTPLUS_PCT}%), trend ${trendPct >= 0 ? '+' : ''}${trendPct}%. Echt koopgedrag bevestigt conversie → schaal verkeer op.`;
  } else {
    gate = 'WAIT — OPTIMIZE';
    reason = `${salesReady} Sales-Ready (drempel ${MIN_SALES_READY}), ${hotPlusPct}% Hot+ (drempel ${MIN_HOTPLUS_PCT}%), trend ${trendPct >= 0 ? '+' : ''}${trendPct}%. Onvoldoende gedrag-signaal → eerst conversie optimaliseren, niet opschalen.`;
  }

  console.log('═══════════════════════════════════════════════════════════');
  console.log(' BUYER-INTENT GATE  (primaire conversie-/scale-gate)');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(` Bezoekers met intent : ${visitors}`);
  console.log(` Cold/Warm/Hot/SR     : ${by.Cold} / ${by.Warm} / ${by.Hot} / ${by['Sales Ready']}`);
  console.log(` Hot+ aandeel         : ${hotPlusPct}%`);
  console.log(` Events 7d (vs vorige): ${e7} (was ${ePrev}, ${trendPct >= 0 ? '+' : ''}${trendPct}%)`);
  console.log('───────────────────────────────────────────────────────────');
  console.log(` GATE: ${gate}`);
  console.log(` ${reason}`);
  console.log('───────────────────────────────────────────────────────────');
  console.log(' Would_Buy (commercial-validator) = copy-QA-diagnostiek, GEEN go/no-go.');
  console.log('═══════════════════════════════════════════════════════════');

  // Machine-leesbaar verdict (voor orchestratie).
  console.log(JSON.stringify({
    kind: 'buyer_intent_gate', visitors, tiers: by, sales_ready: salesReady,
    hot_plus_pct: hotPlusPct, events_7d: e7, events_prev_7d: ePrev, trend_pct: trendPct, gate,
  }));
})().catch((e) => { console.error('[bi-gate] fout:', e.message); process.exit(1); });
