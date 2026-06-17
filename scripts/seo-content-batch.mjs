#!/usr/bin/env node
// ============================================================================
// ACE-C — SEO content-generation batch (Aquier Commercial Engine, Phase C)
// ============================================================================
// Activeert de bestaande programmatic-SEO-infra (migratie 097): genereert
// title/meta/h1/body_md voor public.seo_pages met status='planned' via de
// Anthropic API, gegrond op de keyword-cluster + niche. Schrijft status='draft'
// (of 'published' met SEO_PUBLISH=1). Dependency-vrij (PostgREST + fetch).
//
// No-mock: zonder ANTHROPIC_API_KEY → no-op (exit 0). Genereert echte content;
// het model krijgt instructie GEEN cijfers/feiten te verzinnen — bij twijfel
// kwalitatief schrijven. Lege/foutieve generatie → rij blijft 'planned'.
//
// Env:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY   (verplicht)
//   ANTHROPIC_API_KEY                         (verplicht voor generatie)
//   SEO_MODEL        (default claude-haiku-4-5-20251001 — kostenefficiënt voor bulk)
//   SEO_BATCH_LIMIT  (default 10)
//   SEO_NICHE        (optioneel niche-slug filter)
//   SEO_PUBLISH      (1 → status=published; anders draft)
//   SEO_DRY_RUN      (1 → genereer + log, niet wegschrijven)
// ============================================================================

const SUPABASE_URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = process.env.SEO_MODEL || 'claude-haiku-4-5-20251001';
const LIMIT = parseInt(process.env.SEO_BATCH_LIMIT || '10');
const NICHE = process.env.SEO_NICHE || '';
const PUBLISH = process.env.SEO_PUBLISH === '1';
const DRY = process.env.SEO_DRY_RUN === '1';

if (!SUPABASE_URL || !KEY) { console.error('[seo] SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY vereist'); process.exit(1); }
if (!ANTHROPIC_KEY) { console.log('[seo] geen ANTHROPIC_API_KEY → no-op (exit 0)'); process.exit(0); }

async function pg(method, path, { body, prefer, query = '' } = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}${query}`, {
    method,
    headers: { apikey: KEY, authorization: `Bearer ${KEY}`, 'content-type': 'application/json', ...(prefer ? { prefer } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { ok: res.ok, status: res.status, text };
}

async function generate(page, cluster, niche) {
  const prompt = `Je bent SEO-contentspecialist voor Aquier (vastgoed intelligence-, financierings- en besluitvormingsplatform).
Schrijf een SEO-landingspagina in het Nederlands, geoptimaliseerd om geciteerd te worden door AI-zoekmachines (Google AI Overviews, ChatGPT, Perplexity, Gemini).

Niche: ${niche?.name ?? niche?.slug ?? '—'}
Cluster: ${cluster?.cluster ?? '—'}
Primair zoekwoord: ${cluster?.primary_keyword ?? page.slug}
Zoekintentie: ${cluster?.search_intent ?? 'informational'}
Slug: ${page.slug}

HARDE REGELS:
- Geen verzonnen cijfers, statistieken, klantnamen of claims. Schrijf kwalitatief; bij twijfel weglaten.
- Praktisch, autoriteit, conversiegericht. Sluit af met een duidelijke CTA naar een Aquier-analyse.

STRUCTUUR van body_md (markdown, ~600-900 woorden, GEEN H1 — die staat apart in h1):
1. ANTWOORD-ALINEA EERST: open met precies één alinea van 40-60 woorden die het primaire zoekwoord direct beantwoordt (definitie/kernantwoord, zelfstandig leesbaar zonder context). AI's citeren juist dit blok. Geen kop, geen "in dit artikel", geen omhaal.
2. Daarna ## H2/### H3-secties die de zoekintentie volledig uitwerken; lijsten waar nuttig.
3. Waar relevant: precies één markdown-vergelijkingstabel in GFM-format (headerrij + scheidingsrij "| --- | --- |" + datarijen). Tabellen worden het vaakst door AI geciteerd.
4. Sluit af met "## Veelgestelde vragen" met 3-5 vragen. Zet ELKE vraag op een eigen regel als vetgedrukte zin met vraagteken (exact zo: **Voorbeeldvraag?**), met daaronder 1-3 zinnen antwoord. Houd dit format exact aan — het voedt de FAQ-structured-data.

Geef UITSLUITEND geldige JSON terug, geen markdown-fences:
{"title": "<=60 tekens", "meta_description": "<=155 tekens", "h1": "...", "body_md": "..."}`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: MODEL, max_tokens: 2500, messages: [{ role: 'user', content: prompt }] }),
  });
  if (!res.ok) throw new Error(`anthropic ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = await res.json();
  let txt = (json.content?.[0]?.text ?? '').trim().replace(/^```json\s*/i, '').replace(/```$/, '').trim();
  const parsed = JSON.parse(txt);
  if (!parsed.title || !parsed.body_md) throw new Error('incomplete generatie');
  return parsed;
}

(async () => {
  // planned pagina's ophalen (optioneel niche-filter via niche_id is complex; filter post-fetch op niche-slug)
  const q = `?status=eq.planned&select=id,slug,title,niche_id,cluster_id&limit=${LIMIT}`;
  const r = await pg('GET', 'seo_pages', { query: q });
  if (!r.ok) { console.error('[seo] seo_pages onbereikbaar:', r.status, r.text.slice(0, 150)); process.exit(1); }
  const pages = JSON.parse(r.text);
  if (pages.length === 0) { console.log('[seo] geen planned pagina\'s — niets te doen.'); process.exit(0); }

  console.log(`[seo] ${pages.length} planned pagina(s), model=${MODEL}, publish=${PUBLISH}, dry=${DRY}`);
  let done = 0, failed = 0;
  for (const p of pages) {
    try {
      const [cr, nr] = await Promise.all([
        pg('GET', 'seo_keyword_clusters', { query: `?id=eq.${p.cluster_id}&select=cluster,primary_keyword,search_intent` }),
        pg('GET', 'seo_niches', { query: `?id=eq.${p.niche_id}&select=name,slug` }),
      ]);
      const cluster = cr.ok ? JSON.parse(cr.text)[0] : null;
      const niche = nr.ok ? JSON.parse(nr.text)[0] : null;
      if (NICHE && niche?.slug !== NICHE) continue;

      const gen = await generate(p, cluster, niche);
      if (DRY) { console.log(`[seo] DRY ${p.slug}: "${gen.title}"`); done++; continue; }

      const upd = await pg('PATCH', 'seo_pages', {
        query: `?id=eq.${p.id}`,
        body: { title: gen.title, meta_description: gen.meta_description, h1: gen.h1, body_md: gen.body_md,
                ai_model: MODEL, status: PUBLISH ? 'published' : 'draft',
                generated_at: new Date().toISOString(), ...(PUBLISH ? { published_at: new Date().toISOString() } : {}) },
        prefer: 'return=minimal',
      });
      if (upd.ok) { done++; console.log(`[seo] ${PUBLISH ? 'published' : 'draft'}: ${p.slug}`); }
      else { failed++; console.error(`[seo] update faalde ${p.slug}: ${upd.text.slice(0, 120)}`); }
    } catch (e) {
      failed++; console.error(`[seo] ${p.slug} faalde: ${e.message} — blijft 'planned' (no-mock)`);
    }
  }
  console.log(`[seo] klaar: ${done} gegenereerd, ${failed} gefaald.`);
})().catch((e) => { console.error('[seo] fout:', e.message); process.exit(1); });
