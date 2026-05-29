// usa-scripts.mjs — Fase 4 scriptgenerator voor AQUIER_USA_DOMINATION_ENGINE.
// Leest de geplande episodes uit public.aquier_content_plan, grondt elke video
// op ECHTE Aquier-data (vastgoed_core views), laat Claude een volledig
// YouTube-script schrijven en schrijft script + status='scripted' terug.
//
// HARDE NO-MOCK REGEL:
//   - Grounding komt live uit de DB. Lege bronnen (bv. distress_signals=0)
//     worden expliciet als "geen live data" doorgegeven; het script mag dan
//     GEEN cijfers verzinnen, alleen het mechanisme/competitor-signaal duiden.
//   - Faalt Claude of de DB, dan blijft de rij 'planned' (geen halve/mock vulling).
//
// Run:  node src/generators/usa-scripts.mjs           (alle planned)
//       node src/generators/usa-scripts.mjs --force    (ook reeds scripted opnieuw)
//       DRY_RUN=1 node src/generators/usa-scripts.mjs  (genereer, niet wegschrijven)

import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ── env loader (zelfde patroon als competitor-intel-engine) ──────────────────
function loadEnvFile(path) {
  if (!path || !existsSync(path)) return false
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (!m) continue
    let val = m[2].trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1)
    if (val && process.env[m[1]] === undefined) process.env[m[1]] = val
  }
  return true
}
loadEnvFile(process.env.DOTENV_PATH)
loadEnvFile(join(__dirname, '..', '..', '.env'))            // content-worker/.env
loadEnvFile(join(__dirname, '..', '..', '..', '.env.gh-secrets')) // repo-root secrets

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || ''
const MODEL = process.env.SCRIPT_MODEL || 'claude-sonnet-4-6'
const DRY_RUN = process.env.DRY_RUN === '1'
const FORCE = process.argv.includes('--force')

if (!SUPABASE_URL || !SERVICE_KEY) throw new Error('SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY vereist')
if (!ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY vereist (fase 4 blocker)')

const REST = `${SUPABASE_URL}/rest/v1`
function headers(schema, extra = {}) {
  const h = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json', ...extra }
  if (schema) { h['Accept-Profile'] = schema; h['Content-Profile'] = schema }
  return h
}
async function sel(table, params, schema = 'public') {
  const res = await fetch(`${REST}/${table}?${params}`, { headers: headers(schema) })
  if (!res.ok) throw new Error(`select ${table} ${res.status}: ${await res.text()}`)
  return res.json()
}
async function patch(table, filter, body, schema = 'public') {
  const res = await fetch(`${REST}/${table}?${filter}`, {
    method: 'PATCH', headers: headers(schema, { Prefer: 'return=representation' }), body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`patch ${table} ${res.status}: ${await res.text()}`)
  return res.json()
}

// ── Kanaal-stem (spiegelt usa-realestate-channels.ts) ────────────────────────
const CHANNEL_VOICE = {
  aquier_usa: 'Aquier USA — authoritative, data-driven, confident US investor educator. Audience: US real estate investors (flip, rental, multifamily, off-market).',
  private_investor_tv: 'Private Investor TV — measured, sophisticated, capital-allocator perspective. Audience: HNW / family-office / private capital seeking institutional acquisition intelligence.',
}

// ── Live grounding uit vastgoed_core ─────────────────────────────────────────
async function buildGrounding() {
  // state forecast (top high-prob)
  const stateForecast = await sel('v_state_opportunity_forecast',
    'select=state_code,scored,high_probability,high_prob_pct,avg_flip,avg_rental,avg_transformation,dominant_play&order=high_prob_pct.desc.nullslast&limit=8',
    'vastgoed_core')

  // opportunity mix — aggregeer in JS (PostgREST group-by vermijden)
  const opp = await sel('v_opportunity_engine', 'select=best_opportunity,best_score,is_elite', 'vastgoed_core')
  const mixMap = {}
  for (const r of opp) {
    const k = r.best_opportunity || 'unknown'
    ;(mixMap[k] ??= { best_opportunity: k, n: 0, sumScore: 0, elite: 0 })
    mixMap[k].n++; mixMap[k].sumScore += Number(r.best_score) || 0; if (r.is_elite) mixMap[k].elite++
  }
  const opportunityMix = Object.values(mixMap)
    .map(m => ({ best_opportunity: m.best_opportunity, n: m.n, avg_score: Math.round((m.sumScore / m.n) * 10) / 10, elite: m.elite }))
    .sort((a, b) => b.n - a.n)

  const trends = await sel('v_trend_signals_live',
    'select=keyword,category,score,momentum_pct,source&order=momentum_pct.desc.nullslast&limit=8', 'vastgoed_core')

  // competitor focus — laatste snapshot per platform, join in JS
  const platforms = await sel('competitor_platforms', 'select=id,slug,name', 'vastgoed_core')
  const snaps = await sel('competitor_seo_snapshots',
    'select=platform_id,captured_at,acquisition_focus,ctas&order=captured_at.desc&limit=80', 'vastgoed_core')
  const latest = new Map()
  for (const s of snaps) if (!latest.has(s.platform_id)) latest.set(s.platform_id, s)
  const competitorFocus = platforms.map(p => {
    const s = latest.get(p.id)
    return { slug: p.slug, focus: s?.acquisition_focus ? Object.keys(s.acquisition_focus) : [], cta_count: Array.isArray(s?.ctas) ? s.ctas.length : 0 }
  })

  // distress (kan leeg zijn → eerlijk doorgeven)
  let distressTotal = 0
  try {
    const res = await fetch(`${REST}/distress_signals?select=id&limit=1`, { headers: headers('vastgoed_core', { Prefer: 'count=exact' }) })
    const cr = res.headers.get('content-range') // bv. 0-0/123
    distressTotal = cr && cr.includes('/') ? parseInt(cr.split('/')[1], 10) || 0 : 0
  } catch { distressTotal = 0 }

  return { stateForecast, opportunityMix, trends, competitorFocus, distressTotal }
}

// ── Prompt + Claude-call ─────────────────────────────────────────────────────
function buildPrompt(ep, g) {
  const isShort = ep.format === 'short'
  return `You are the head scriptwriter for "${CHANNEL_VOICE[ep.channel_key] || ep.channel_key}".

Write a complete, ready-to-record YouTube ${isShort ? 'SHORT (45-60s, ~130-160 words)' : 'LONG-FORM video (8-11 min, ~1300-1700 words)'} script.

VIDEO
- Title: ${ep.title}
- Opening hook (use/improve this): ${ep.hook}
- SEO target keywords (weave in naturally, no stuffing): ${(ep.target_keywords || []).join(', ')}
- Intended data source: ${ep.data_source}

REAL AQUIER DATA (this is live; ground every claim in it — do NOT invent numbers):
- State opportunity forecast (top): ${JSON.stringify(g.stateForecast)}
- Opportunity mix across scored US properties: ${JSON.stringify(g.opportunityMix)}
- Live trend signals: ${JSON.stringify(g.trends)}
- Competitor acquisition focus (from our scraper): ${JSON.stringify(g.competitorFocus)}
- Distress signals currently in DB: ${g.distressTotal} rows${g.distressTotal === 0 ? ' (EMPTY — do not cite distress counts; speak about the method/competitor signals instead, and frame distress data as "coming online")' : ''}

HARD RULES
- No mock data. Every statistic must trace to the REAL data above. If a needed datapoint is absent, speak qualitatively, never fabricate a figure.
- Sound like a sharp human operator, not an AI. No filler, no "in this video we will".
- ${isShort ? 'Single punchy arc: hook → one sharp insight backed by a real number → CTA.' : 'Structure: HOOK → why it matters → 3-4 sections each anchored in a real Aquier datapoint → contrarian/edge insight → recap → CTA to Aquier.'}
- End with a natural CTA to Aquier (the AI acquisition intelligence platform).

OUTPUT
Return ONLY the script as clean markdown:
# <punchy title>
**Hook:** ...
${isShort ? '**Script:** ...' : '## <section>\\n...'}
**CTA:** ...`
}

async function generateScript(ep, g) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: ep.format === 'short' ? 1200 : 3000,
      messages: [{ role: 'user', content: buildPrompt(ep, g) }],
    }),
  })
  if (!res.ok) throw new Error(`anthropic ${res.status}: ${(await res.text()).slice(0, 300)}`)
  const data = await res.json()
  const txt = (data?.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n').trim()
  if (!txt || txt.length < 120) throw new Error('lege/te korte scriptoutput')
  return txt
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const log = (...a) => console.log(`[${new Date().toISOString()}]`, ...a)
  log(`USA scriptgenerator — model=${MODEL} dry_run=${DRY_RUN} force=${FORCE}`)

  const filter = FORCE ? 'order=channel_key,content_type_key' : 'status=eq.planned&order=channel_key,content_type_key'
  const episodes = await sel('aquier_content_plan', `select=id,channel_key,content_type_key,title,format,hook,target_keywords,data_source,status&${filter}`)
  log(`${episodes.length} episodes te verwerken`)
  if (episodes.length === 0) { log('niets te doen'); return }

  log('grounding ophalen uit vastgoed_core…')
  const g = await buildGrounding()
  log(`grounding: ${g.stateForecast.length} states, ${g.opportunityMix.length} opp-types, ${g.trends.length} trends, ${g.competitorFocus.length} competitors, distress=${g.distressTotal}`)

  let ok = 0, failed = 0
  for (const ep of episodes) {
    try {
      const script = await generateScript(ep, g)
      if (!DRY_RUN) {
        await patch('aquier_content_plan', `id=eq.${ep.id}`, {
          script, status: 'scripted', updated_at: new Date().toISOString(),
        })
      }
      ok++
      log(`  ✓ ${ep.channel_key}/${ep.content_type_key} (${ep.format}) — ${script.length} chars${DRY_RUN ? ' [dry]' : ''}`)
    } catch (err) {
      failed++
      log(`  ✗ ${ep.channel_key}/${ep.content_type_key} — ${err?.message || err}`)
    }
  }

  // build-tracker sectie bijwerken met ECHTE telling
  if (!DRY_RUN) {
    try {
      const all = await sel('aquier_content_plan', 'select=status')
      const scripted = all.filter(r => r.status !== 'planned').length
      await patch('aquier_project_sections', 'section_key=eq.content_engine', {
        status: scripted > 0 ? 'live' : 'building',
        success_ratio: episodes.length ? Math.round((ok / episodes.length) * 10000) / 100 : 0,
        growth_metrics: {
          channels: 2, content_types: 10, planned_episodes: all.length, scripts_generated: scripted,
          model: MODEL, last_run_ok: ok, last_run_failed: failed,
        },
        updated_at: new Date().toISOString(),
      })
    } catch (e) { log('sectie-update faalde (niet fataal):', e?.message || e) }
  }

  log(`klaar: ${ok} ok / ${failed} fout`)
  if (failed > 0) process.exitCode = 1
}

main().catch(e => { console.error('fatale fout:', e); process.exit(1) })
