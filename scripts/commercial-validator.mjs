#!/usr/bin/env node
// ============================================================================
// Hermes Commercial Validation Engine (Prioriteit 0A)
// ============================================================================
// NIET "werkt het" maar "wil iemand BETALEN". Hermes beoordeelt elke pagina
// door de ogen van een KRITISCHE koper per doelgroep — "met een glas azijn in
// de mond": zoekt redenen om NIET te kopen. Per pagina × persona:
//   7 kernvragen + persona-specifieke vragen + zou-ik-betalen + waarom-niet +
//   ontbrekende info/CTA/onbeantwoorde bezwaren + conversie-scores + taalvalidatie.
// Aggregeert → COPY-QA-DIAGNOSE (welke persona's de copy nog niet overtuigt).
//
// KPI-REFRAME: dit is een content-QA-DIAGNOSTIEK, GEEN demand-metric. Would_Buy
// meet vijandige meningen over de copy, geen koopgedrag, en blijft tegen een
// azijn-rechter per definitie laag — daarom is het NIET de go/no-go conversiegate.
// De PRIMAIRE conversie-/scale-gate = echt gedrag via Buyer-Intent
// (scripts/buyer-intent-gate.mjs → vastgoed_core.v_buyer_intent), zodra er verkeer
// is. Gebruik deze validator om copy te verbeteren (why_not_buy/missing_info), niet
// om te beslissen of je opschaalt.
//
// No-mock: fetcht ECHTE pagina's + echte LLM-oordelen. Pagina onbereikbaar →
// vastleggen, niet verzinnen. Geen ANTHROPIC_API_KEY → no-op (exit 0).
//
// Env:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY   (verplicht)
//   AQUIER_URL_NL  (default https://aquier.com)
//   AQUIER_URL_US  (default https://aquier.com/en  — pas aan zodra US-locale live is)
//   CV_COUNTRY     (NL | US | both, default NL)
//   CV_MODEL       (default claude-sonnet-4-6 — scherp koop-oordeel; opus voor max)
//   CV_PAGES       (optioneel JSON-override van de pagina-lijst)
//   CV_DRY_RUN     (1 → evalueer + log, niet wegschrijven)
// ============================================================================

const SUPABASE_URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const URL_NL = process.env.AQUIER_URL_NL || 'https://aquier.com';
const URL_US = process.env.AQUIER_URL_US || 'https://aquier.com/en';
const COUNTRY = (process.env.CV_COUNTRY || 'NL').toUpperCase();
const MODEL = process.env.CV_MODEL || 'claude-sonnet-4-6';
const DRY = process.env.CV_DRY_RUN === '1';

if (!SUPABASE_URL || !KEY) { console.error('[cv] SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY vereist'); process.exit(1); }
if (!ANTHROPIC_KEY) { console.log('[cv] geen ANTHROPIC_API_KEY → no-op (exit 0)'); process.exit(0); }

async function pg(method, path, { body, prefer, query = '' } = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}${query}`, {
    method,
    headers: { apikey: KEY, authorization: `Bearer ${KEY}`, 'content-type': 'application/json',
      'accept-profile': 'hermes', 'content-profile': 'hermes', ...(prefer ? { prefer } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { ok: res.ok, status: res.status, text };
}

// ── Pagina's om te beoordelen (per land via base-URL) ──────────────────────
const DEFAULT_PAGES = [
  { path: '/',                 kind: 'homepage' },
  { path: '/producten',        kind: 'product-overzicht' },
  { path: '/pricing',          kind: 'pricing' },
  { path: '/ontwikkelaars',    kind: 'audience' },
  { path: '/beleggers',        kind: 'audience' },
  { path: '/makelaars',        kind: 'audience' },
  { path: '/financiers',       kind: 'audience' },
  { path: '/family-office',    kind: 'audience' },
  { path: '/dealfinders',      kind: 'audience' },
];
const PAGES = process.env.CV_PAGES ? JSON.parse(process.env.CV_PAGES) : DEFAULT_PAGES;

// ── Persona's met kritische, persona-specifieke vragen ─────────────────────
const PERSONAS = [
  { slug: 'ontwikkelaar', rol: 'senior vastgoedontwikkelaar',
    vragen: ['Hoe betrouwbaar is deze analyse?', 'Welke data gebruiken jullie?', 'Kan ik dit aan mijn investeerders laten zien?', 'Kan ik dit aan de bank laten zien?', 'Kan ik hier een aankoopbesluit op baseren?', 'Wat maakt jullie beter dan een adviseur?', 'Wat gebeurt er als de analyse fout zit?'] },
  { slug: 'financier', rol: 'kritische bankier / kredietcommissie',
    vragen: ['Waarom zou ik deze analyse vertrouwen?', 'Waar komt de data vandaan?', 'Hoe controleren jullie documenten?', 'Hoe betrouwbaar zijn de aannames?', 'Hoe valideer ik de uitkomst?', 'Welke risico\'s zijn afgedekt?'] },
  { slug: 'makelaar', rol: 'topmakelaar',
    vragen: ['Verkoop ik sneller?', 'Verkoop ik voor meer geld?', 'Krijg ik meer kopers?', 'Krijg ik meer investeerders?', 'Krijg ik meer opdrachten?'] },
  { slug: 'investeerder', rol: 'kritische belegger',
    vragen: ['Verdien ik meer?', 'Loop ik minder risico?', 'Bespaar ik tijd?', 'Vind ik betere deals?'] },
  { slug: 'bemiddelaar', rol: 'kritische bemiddelaar / dealfinder',
    vragen: ['Vind ik exclusievere deals?', 'Verdien ik meer courtage?', 'Kan ik kopers sneller overtuigen?', 'Wat is mijn voordeel t.o.v. zelf zoeken?'] },
  { slug: 'family_office', rol: 'kritische family office manager',
    vragen: ['Beschermt dit mijn kapitaal?', 'Hoe onafhankelijk/objectief is de analyse?', 'Past dit bij lange-termijn rendement + risico?', 'Kan ik dit aan de familie/raad verantwoorden?'] },
];

function baseFor(country) { return country === 'US' ? URL_US : URL_NL; }

function htmlToText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ').trim();
}

async function fetchPage(url) {
  try {
    const res = await fetch(url, { redirect: 'follow', headers: { 'user-agent': 'HermesCommercialValidator/1.0' } });
    if (!res.ok) return { ok: false, status: res.status, text: '' };
    const html = await res.text();
    return { ok: true, status: res.status, text: htmlToText(html).slice(0, 12000) };
  } catch (e) { return { ok: false, status: 0, text: '' }; }
}

function buildPrompt(persona, country, page, pageText) {
  const taal = country === 'US'
    ? 'Beoordeel ook de Engelse/US-toon: het moet GELOKALISEERD zijn (niet vertaald NL), upside/speed/opportunity/ROI-gericht, klinken als US real-estate.'
    : 'Beoordeel ook de NL-toon: klinkt dit als vastgoed/investering/financiering, professioneel, ZONDER AI-taal/marketingjargon/buzzwords?';
  return `Je bent een KRITISCHE ${persona.rol} in ${country}, met "een glas azijn in de mond". Je zoekt NIET waarom dit goed is — je zoekt redenen om NIET te kopen. Wees streng en eerlijk; bij twijfel = nee.

Beoordeel UITSLUITEND wat op deze pagina staat (geen aannames over niet-getoonde info).
PAGINA (${page.kind}, ${page.url}):
"""${pageText || '(geen/onbereikbare inhoud)'}"""

Beantwoord als deze persona. Persona-specifieke vragen om in 'persona_answers' te beantwoorden: ${JSON.stringify(persona.vragen)}.
${taal}

Geef UITSLUITEND geldige JSON terug (geen fences):
{
 "q1_understand_5s": bool,        // begrijp ik <5s wat Aquier doet?
 "q2_relevant_10s": bool,         // <10s waarom dit voor mij relevant is?
 "q3_what_i_get": bool,           // begrijp ik wat ik krijg?
 "q4_what_it_costs": bool,        // begrijp ik wat het kost?
 "q5_trust_score": 1-10,          // vertrouw ik dit bedrijf?
 "would_buy": bool,               // zou IK (deze kritische persona) hierop betalen?
 "why_not_buy": ["..."],          // VOLLEDIGE lijst redenen om NIET te kopen
 "missing_info": ["..."],         // ontbrekende informatie
 "unanswered_objections": ["..."],// onbeantwoorde bezwaren
 "missing_cta": ["..."],          // ontbrekende/zwakke CTA's
 "persona_answers": {"vraag":"antwoord"},
 "conversion_scores": {"trust":1-10,"authority":1-10,"clarity":1-10,"urgency":1-10,"proof":1-10,"conversion":1-10},
 "language_verdict": {"klinkt_vakkundig": bool, "geen_ai_jargon": bool, "lokalisatie_ok": bool, "opmerking":"..."},
 "verdict": "1 zin: zou deze persona kopen, en zo nee de #1 reden"
}`;
}

async function callLLM(prompt) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: MODEL, max_tokens: 4000, messages: [{ role: 'user', content: prompt }] }),
  });
  if (!res.ok) throw new Error(`anthropic ${res.status}: ${(await res.text()).slice(0, 160)}`);
  const j = await res.json();
  let t = (j.content?.[0]?.text ?? '').trim().replace(/^```json\s*/i, '').replace(/```$/, '').trim();
  return JSON.parse(t);
}

(async () => {
  const countries = COUNTRY === 'BOTH' ? ['NL', 'US'] : [COUNTRY];
  // open run
  let runId = null;
  if (!DRY) {
    const r = await pg('POST', 'commercial_validation_runs', {
      body: [{ scope: 'aquier', country: COUNTRY === 'BOTH' ? null : COUNTRY, status: 'running',
               model: MODEL, triggered_by: 'manual', started_at: new Date().toISOString() }],
      prefer: 'return=representation' });
    if (!r.ok) { console.error('[cv] run insert faalde — mig 111 toegepast?', r.status, r.text.slice(0,150)); process.exit(1); }
    runId = JSON.parse(r.text)[0].id;
  }

  let evals = 0, wouldBuy = 0;
  const personasBuy = {};
  const pageCache = {};

  for (const country of countries) {
    for (const page of PAGES) {
      const url = `${baseFor(country)}${page.path}`;
      const fetched = pageCache[url] ?? (pageCache[url] = await fetchPage(url));
      for (const persona of PERSONAS) {
        let v;
        try {
          v = await callLLM(buildPrompt(persona, country, { ...page, url }, fetched.text));
        } catch (e) { console.error(`[cv] ${persona.slug}@${url}: ${e.message}`); continue; }
        evals++;
        if (v.would_buy) { wouldBuy++; personasBuy[persona.slug] = true; }
        else if (!(persona.slug in personasBuy)) personasBuy[persona.slug] = personasBuy[persona.slug] || false;
        console.log(`[cv] ${country} ${persona.slug} @ ${page.path}: would_buy=${v.would_buy} trust=${v.q5_trust_score}`);
        if (DRY) continue;
        await pg('POST', 'commercial_validation', { prefer: 'return=minimal', body: [{
          run_id: runId, page_url: url, page_kind: page.kind, persona: persona.slug, country,
          q1_understand_5s: v.q1_understand_5s, q2_relevant_10s: v.q2_relevant_10s,
          q3_what_i_get: v.q3_what_i_get, q4_what_it_costs: v.q4_what_it_costs, q5_trust_score: v.q5_trust_score,
          why_not_buy: v.why_not_buy ?? [], missing_info: v.missing_info ?? [],
          would_buy: v.would_buy, unanswered_objections: v.unanswered_objections ?? [],
          missing_cta: v.missing_cta ?? [], persona_answers: v.persona_answers ?? {},
          conversion_scores: v.conversion_scores ?? {}, language_verdict: v.language_verdict ?? {},
          verdict: v.verdict ?? null }] });
      }
    }
  }

  // Copy-QA-diagnose: overtuigt de copy élke vereiste persona ergens? (NIET de
  // go/no-go — dat is de Buyer-Intent-gate op echt gedrag.)
  const required = PERSONAS.map(p => p.slug);
  const passed = required.filter(s => personasBuy[s]);
  const gateOpen = passed.length === required.length && evals > 0;

  if (!DRY && runId) {
    await pg('PATCH', 'commercial_validation_runs', { query: `?id=eq.${runId}`, prefer: 'return=minimal',
      body: { status: 'done', total_evals: evals, would_buy_count: wouldBuy,
              personas_passed: passed, gate_open: gateOpen,
              summary: { personas_buy: personasBuy, pages: PAGES.length, countries },
              finished_at: new Date().toISOString() } });
  }
  console.log(`[cv] klaar: ${evals} evaluaties, ${wouldBuy} would_buy. Persona's die de copy overtuigt: ${passed.join(', ') || 'geen'}.`);
  console.log(`[cv] COPY-QA-DIAGNOSE: ${gateOpen ? 'copy overtuigt alle persona\'s ✅' : 'copy overtuigt nog niet — ' + required.filter(s=>!personasBuy[s]).join(', ') + ' (zie why_not_buy/missing_info)'}`);
  console.log(`[cv] LET OP: dit is copy-QA-diagnostiek, GEEN go/no-go. Primaire conversie-/scale-gate = echt gedrag: node scripts/buyer-intent-gate.mjs (Buyer-Intent).`);
})().catch((e) => { console.error('[cv] fout:', e.message); process.exit(1); });
