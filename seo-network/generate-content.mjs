#!/usr/bin/env node
/**
 * M4 Programmatic SEO Network — content generator.
 * Vult seo_pages.body_md voor pagina's met status='planned'.
 * Dependency-free ESM (native fetch). Key-gated: draait pas met ANTHROPIC_API_KEY.
 * No-mock: schrijft NIETS naar body_md tenzij de AI echte content teruggeeft.
 *
 * Run:  node seo-network/generate-content.mjs [batch]
 * Env:  SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY
 *       SEO_MODEL (default claude-haiku-4-5-20251001), SEO_BATCH (default 10)
 */

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY
const MODEL = process.env.SEO_MODEL || 'claude-haiku-4-5-20251001'
const BATCH = Number(process.argv[2] || process.env.SEO_BATCH || 10)

function die(msg) { console.error(`[seo-content] ${msg}`); process.exit(1) }
if (!SUPABASE_URL || !SERVICE_KEY) die('SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY vereist')
if (!ANTHROPIC_KEY) die('ANTHROPIC_API_KEY ontbreekt — content-generatie is key-gated. Zet de key in de runtime-env.')

const sbHeaders = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
}

async function sb(path, opts = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { ...opts, headers: { ...sbHeaders, ...(opts.headers || {}) } })
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`)
  return res.status === 204 ? null : res.json()
}

async function fetchPlanned(limit) {
  // join niche + cluster voor context
  const q = `seo_pages?status=eq.planned&body_md=is.null&limit=${limit}` +
    `&select=id,slug,title,h1,niche_id,cluster_id,` +
    `seo_niches(slug,naam,beschrijving,channel_link),` +
    `seo_keyword_clusters(primary_keyword,cluster,search_intent)`
  return sb(q)
}

function buildPrompt(page) {
  const niche = page.seo_niches || {}
  const cl = page.seo_keyword_clusters || {}
  return `Je bent een Nederlandse financiële content-redacteur. Schrijf een SEO-geoptimaliseerd artikel in het Nederlands.

ONDERWERP (H1): ${page.h1}
NICHE: ${niche.naam} — ${niche.beschrijving || ''}
PRIMAIR ZOEKWOORD: ${cl.primary_keyword || page.h1}
ZOEKINTENTIE: ${cl.search_intent || 'informational'}

EISEN:
- 700-1000 woorden, markdown (## koppen, lijsten waar nuttig).
- Begin met een directe, waardevolle intro (geen "in dit artikel").
- Feitelijk, concreet, geen verzonnen cijfers of bronnen. Bij twijfel: algemeen formuleren.
- Geen persoonlijke naam, geen "ik". Naamloze, professionele toon (NL SEO-regel).
- Eindig met een korte, natuurlijke call-to-action richting het YouTube-kanaal ${niche.channel_link} voor meer.
- GEEN frontmatter, GEEN titel-H1 (die staat al vast). Begin met de intro-paragraaf.

Geef ALLEEN de markdown-body terug.`
}

async function generate(page) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: MODEL, max_tokens: 2000, messages: [{ role: 'user', content: buildPrompt(page) }] }),
  })
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`)
  const data = await res.json()
  let text = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n').trim()
  // Strip een leidende H1 — de render-laag toont h1 al uit het title-veld (geen duplicate H1).
  text = text.replace(/^#\s+.*\r?\n+/, '').trim()
  if (!text || text.length < 200) throw new Error('lege/te korte AI-output — niet opgeslagen (no-mock)')
  return text
}

async function patchPage(id, body) {
  await sb(`seo_pages?id=eq.${id}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ body_md: body, status: 'draft', ai_model: MODEL, generated_at: new Date().toISOString() }),
  })
}

async function main() {
  const pages = await fetchPlanned(BATCH)
  console.log(`[seo-content] ${pages.length} pagina's te genereren (model ${MODEL})`)
  let ok = 0, fail = 0
  for (const p of pages) {
    try {
      const body = await generate(p)
      await patchPage(p.id, body)
      ok++; console.log(`  ✓ ${p.slug}`)
    } catch (e) {
      fail++; console.error(`  ✗ ${p.slug}: ${e.message}`)
    }
  }
  console.log(`[seo-content] klaar — ${ok} ok / ${fail} fout`)
}

main().catch(e => die(e.message))
