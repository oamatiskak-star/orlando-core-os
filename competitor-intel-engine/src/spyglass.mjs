// spyglass.mjs — Competitor Intelligence agent (CONQUEST-USA / Spyglass)
// Analyseert PUBLIEKE marketing/SEO van US-concurrenten. GEEN MOCK:
// elk snapshot is een echte fetch+extractie. Velden die externe API-keys
// vereisen (backlink/keyword-volume) blijven null tot die connector live is.
import { select, insert, update } from './supabase.mjs'
import { ANTHROPIC_API_KEY, HAIKU } from './config.mjs'

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
const CTA_RE = /\b(sign\s?up|get\s?started|start\s+free|free\s+trial|try\s+(it\s+)?free|book\s+a?\s*demo|request\s+a?\s*demo|see\s+pricing|view\s+plans|buy\s+now|subscribe|create\s+account|talk\s+to\s+sales|get\s+access)\b/i

// Domein-signalen voor acquisition_focus (echte tekst-detectie)
const FOCUS_TERMS = {
  distressed:   ['foreclosure', 'pre-foreclosure', 'distressed', 'auction', 'reo', 'tax lien', 'tax delinquent', 'probate', 'bankruptcy'],
  off_market:   ['off-market', 'off market', 'motivated seller', 'skip trace', 'driving for dollars', 'wholesale', 'wholesaling'],
  multifamily:  ['multifamily', 'multi-family', 'apartment', 'units', 'build-to-rent', 'build to rent'],
  commercial:   ['commercial', 'cre', 'office', 'industrial', 'retail', 'self-storage', 'self storage'],
  data_api:     ['api', 'bulk data', 'data feed', 'property data', 'comps', 'avm', 'valuation'],
  investor:     ['investor', 'investment property', 'cash flow', 'cap rate', 'roi', 'rental'],
}

const US_STATES = ['texas','florida','arizona','georgia','north carolina','tennessee','nevada','south carolina','utah','colorado','california','new york']

async function fetchHtml(url, timeoutMs = 12000) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml' },
      redirect: 'follow',
      signal: ctrl.signal,
    })
    const body = await res.text()
    return { status: res.status, body, finalUrl: res.url }
  } finally {
    clearTimeout(t)
  }
}

function textContent(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function metaTag(html, name) {
  const re = new RegExp(`<meta[^>]+(?:name|property)=["']${name}["'][^>]*content=["']([^"']*)["']`, 'i')
  const m = html.match(re)
  return m ? m[1].trim() : null
}

function collect(re, html, max) {
  const out = []
  let m
  const g = new RegExp(re.source, 'gi')
  while ((m = g.exec(html)) && out.length < max) {
    const v = (m[1] || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    if (v && !out.includes(v)) out.push(v)
  }
  return out
}

function extract(html, baseUrl) {
  const title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '').replace(/\s+/g, ' ').trim()
  const description = metaTag(html, 'description')
  const og = { title: metaTag(html, 'og:title'), description: metaTag(html, 'og:description') }
  const h1 = collect(/<h1[^>]*>([\s\S]*?)<\/h1>/, html, 6)
  const h2 = collect(/<h2[^>]*>([\s\S]*?)<\/h2>/, html, 12)

  // CTA's uit knoppen/links
  const anchorTexts = collect(/<(?:a|button)[^>]*>([\s\S]*?)<\/(?:a|button)>/, html, 200)
  const ctas = anchorTexts.filter(t => t.length <= 40 && CTA_RE.test(t))
    .filter((v, i, a) => a.indexOf(v) === i).slice(0, 12)

  // interne links → pricing/feature detectie
  const hrefs = collect(/<a[^>]+href=["']([^"']+)["']/, html, 400)
  const pricingLink = hrefs.find(h => /pricing|plans|\/price/i.test(h)) || null

  const text = textContent(html).toLowerCase()
  const acquisition_focus = {}
  for (const [k, terms] of Object.entries(FOCUS_TERMS)) {
    const hits = terms.filter(term => text.includes(term))
    if (hits.length) acquisition_focus[k] = hits
  }
  const state_focus = US_STATES.filter(s => text.includes(s))
  if (state_focus.length) acquisition_focus.state_focus = state_focus

  // ruwe keyword-kandidaten = h1+h2 woordgroepen (search_volume blijft null → connector waiting)
  const keywords = [...h1, ...h2]
    .map(s => s.toLowerCase())
    .filter(s => s.length >= 4 && s.length <= 60)
    .filter((v, i, a) => a.indexOf(v) === i)
    .slice(0, 25)

  return {
    meta: { title, description, og },
    content_structure: { h1, h2 },
    ctas,
    funnel_structure: { pricing_link: pricingLink ? new URL(pricingLink, baseUrl).href : null, cta_count: ctas.length },
    keywords,
    acquisition_focus,
  }
}

// Optionele AI-verrijking (haiku). Faalt stil → ruwe extractie blijft leidend (geen mock).
async function enrichWithClaude(name, base) {
  if (!ANTHROPIC_API_KEY) return null
  const prompt = `Je analyseert de publieke marketingpagina van vastgoed-dataplatform "${name}".
Op basis van deze geextraheerde signalen, geef beknopt JSON terug met velden:
positioning (1 zin), primary_segment, notable_ctas (max 3), gap_for_aquier (1 zin, waar Aquier kan winnen).
Signalen: ${JSON.stringify({ meta: base.meta, h1: base.content_structure.h1, ctas: base.ctas, focus: base.acquisition_focus }).slice(0, 3500)}
Antwoord ALLEEN met JSON.`
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ model: HAIKU, max_tokens: 400, messages: [{ role: 'user', content: prompt }] }),
    })
    if (!res.ok) return null
    const data = await res.json()
    const txt = data?.content?.[0]?.text || ''
    const json = txt.match(/\{[\s\S]*\}/)
    return json ? JSON.parse(json[0]) : null
  } catch {
    return null
  }
}

export async function runSpyglass({ log = console.log } = {}) {
  const startedAt = Date.now()
  const platforms = await select('competitor_platforms', 'select=id,slug,name,homepage_url&is_active=eq.true', 'vastgoed_core')
  log(`Spyglass: ${platforms.length} platforms te analyseren`)

  let ok = 0, failed = 0
  const results = []
  for (const p of platforms) {
    try {
      const home = await fetchHtml(p.homepage_url)
      const base = extract(home.body, home.finalUrl || p.homepage_url)
      let pagesFetched = 1

      // pricing-pagina ophalen indien gevonden (extra echte data)
      let pricingExtract = null
      if (base.funnel_structure.pricing_link) {
        try {
          const pr = await fetchHtml(base.funnel_structure.pricing_link)
          pricingExtract = extract(pr.body, pr.finalUrl)
          pagesFetched++
        } catch { /* pricing optioneel */ }
      }

      const ai = await enrichWithClaude(p.name, base)

      const snapshot = {
        platform_id: p.id,
        source: 'public_fetch',
        http_status: home.status,
        pages_fetched: pagesFetched,
        top_pages: [{ url: home.finalUrl || p.homepage_url, title: base.meta.title }],
        meta: base.meta,
        content_structure: base.content_structure,
        ctas: base.ctas,
        funnel_structure: base.funnel_structure,
        pricing: pricingExtract ? [{ source_url: base.funnel_structure.pricing_link, headings: pricingExtract.content_structure.h2 }] : [],
        keywords: base.keywords,
        trending_topics: [],
        backlink_signals: null, // connector waiting_for_credentials
        youtube_strategy: {},
        acquisition_focus: base.acquisition_focus,
        analyzed_by: ai ? HAIKU : null,
        raw_notes: ai ? JSON.stringify(ai) : null,
      }
      await insert('competitor_seo_snapshots', [snapshot], 'vastgoed_core')
      ok++
      results.push({ platform: p.slug, status: home.status, ctas: base.ctas.length, focus: Object.keys(base.acquisition_focus) })
      log(`  ✓ ${p.slug} (${home.status}) — ${base.ctas.length} CTA's, focus: ${Object.keys(base.acquisition_focus).join(',') || 'n/a'}`)
    } catch (err) {
      failed++
      results.push({ platform: p.slug, error: String(err?.message || err) })
      log(`  ✗ ${p.slug} — ${err?.message || err}`)
    }
  }

  const total = platforms.length
  const successRatio = total ? Math.round((ok / total) * 10000) / 100 : 0

  // Update build-tracker sectie met ECHTE cijfers
  const totalSnapshots = await select(
    'competitor_seo_snapshots', 'select=id', 'vastgoed_core',
  ).then(r => r.length).catch(() => ok)

  await update(
    'aquier_project_sections',
    'section_key=eq.competitor_intelligence',
    {
      status: ok > 0 ? 'live' : 'building',
      live_workers: 0,
      failed_tasks: failed,
      success_ratio: successRatio,
      growth_metrics: { platforms_tracked: total, snapshots: totalSnapshots, last_run_ok: ok, last_run_failed: failed },
      updated_at: new Date().toISOString(),
    },
  )

  await insert('aquier_monitor_events', [{
    severity: failed > ok ? 'warning' : 'success',
    category: 'market',
    source_agent: 'SPYGLASS-CI',
    title: `Competitor intelligence run — ${ok}/${total} platforms`,
    detail: `Publieke SEO/marketing geanalyseerd. ${totalSnapshots} snapshots totaal. ${failed} fout.`,
    advice: 'Lever Ahrefs/SEMrush key om backlink/keyword-volume connector live te zetten.',
  }])

  // persona status terug naar offline na run
  await update('agent_personas', 'name=eq.Spyglass', { status: 'offline', updated_at: new Date().toISOString() })
    .catch(() => {})

  const durationMs = Date.now() - startedAt
  log(`Spyglass klaar: ${ok} ok / ${failed} fout in ${Math.round(durationMs / 1000)}s — ${totalSnapshots} snapshots totaal`)
  return { ok, failed, total, successRatio, totalSnapshots, durationMs, results }
}
