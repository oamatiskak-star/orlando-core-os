/**
 * Apify Engine — Orlando Core OS
 * 5 categorieën:
 *   Cat 1 apify:cf2-intelligence   → youtube-blok (06:00-07:00)
 *   Cat 2 apify:vastgoed-scrapers  → intl_eu-blok (10:30-12:00)
 *   Cat 3 apify:hermes-mcp         → acq_ai-blok  (17:00-18:30)
 *   Cat 4 apify:aquier-leads       → acq_ai-blok  (17:00-18:30)
 *   Cat 5 apify:cf2-distribution   → youtube-blok (06:00-07:00)
 */
import http from 'node:http'
import { PORT, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, APIFY_TOKEN, LOADED_ENV_FILES, SUPABASE_URL, SERVICE_KEY } from './config.mjs'
import { windowOpen, heartbeat } from './lib/supabase.mjs'
import { run as runCf2Intelligence }  from './workers/cf2-intelligence.mjs'
import { run as runVastgoed }         from './workers/vastgoed-scrapers.mjs'
import { run as runHermesMcp }        from './workers/hermes-mcp-registry.mjs'
import { run as runAquierLeads }      from './workers/aquier-leads.mjs'
import { run as runCf2Distribution }  from './workers/cf2-distribution.mjs'

const WORKERS = [
  { key: 'apify:cf2-intelligence',  fn: runCf2Intelligence,  name: 'CF2 Intelligence' },
  { key: 'apify:vastgoed-scrapers', fn: runVastgoed,          name: 'Vastgoed Scrapers' },
  { key: 'apify:hermes-mcp',        fn: runHermesMcp,         name: 'Hermes MCP Registry' },
  { key: 'apify:aquier-leads',      fn: runAquierLeads,       name: 'Aquier Leads' },
  { key: 'apify:cf2-distribution',  fn: runCf2Distribution,   name: 'CF2 Distributie' },
]

let running = false
const lastRun = {}

async function dispatch(trigger = 'cron') {
  if (running) return { skipped: 'already_running' }
  running = true
  const results = {}
  try {
    for (const w of WORKERS) {
      const open = await windowOpen(w.key).catch(() => true) // default open bij DB-fout
      if (!open) {
        results[w.key] = 'window_closed'
        continue
      }
      const now = Date.now()
      const dayKey = new Date().toISOString().slice(0, 10)
      if (lastRun[w.key] === dayKey && trigger === 'cron') {
        results[w.key] = 'already_ran_today'
        continue
      }
      console.log(`[apify-engine] → ${w.name} (${trigger})`)
      try {
        results[w.key] = await w.fn(msg => console.log(`  ${msg}`))
        lastRun[w.key] = dayKey
      } catch (err) {
        console.error(`[apify-engine] ✗ ${w.name}: ${err.message}`)
        results[w.key] = { error: err.message }
        await sendTelegram(`⚠️ apify-engine: ${w.name} mislukt\n${err.message}`)
      }
    }
  } finally {
    running = false
  }
  await heartbeat('engine.apify-engine.tick', { trigger, results })
  return results
}

async function sendTelegram(text) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text }),
    })
  } catch { /* non-critical */ }
}

// ── HTTP health / manual trigger ────────────────────────────────
const server = http.createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    return res.end(JSON.stringify({
      service: 'apify-engine',
      running,
      lastRun,
      apify_token: APIFY_TOKEN ? `${APIFY_TOKEN.slice(0, 12)}… (${APIFY_TOKEN.length}c)` : 'MISSING',
      supabase_url: SUPABASE_URL ? `${SUPABASE_URL.slice(0, 30)}…` : 'MISSING',
      service_key: SERVICE_KEY ? `${SERVICE_KEY.slice(0, 10)}… (${SERVICE_KEY.length}c)` : 'MISSING',
      env_files: LOADED_ENV_FILES,
      time: new Date().toISOString(),
    }))
  }
  if (req.method === 'GET' && req.url === '/test-apify') {
    try {
      if (!APIFY_TOKEN) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        return res.end(JSON.stringify({ ok: false, error: 'APIFY_TOKEN not set', env_files: LOADED_ENV_FILES }))
      }
      const r = await fetch(`https://api.apify.com/v2/users/me?token=${APIFY_TOKEN}`)
      const body = await r.json().catch(() => r.text())
      res.writeHead(r.ok ? 200 : r.status, { 'Content-Type': 'application/json' })
      return res.end(JSON.stringify({ ok: r.ok, status: r.status, token_prefix: APIFY_TOKEN.slice(0, 12), body }))
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' })
      return res.end(JSON.stringify({ ok: false, error: err.message }))
    }
  }
  if (req.method === 'POST' && req.url === '/run') {
    const result = await dispatch('manual').catch(e => ({ error: String(e?.message || e) }))
    res.writeHead(result.error ? 500 : 200, { 'Content-Type': 'application/json' })
    return res.end(JSON.stringify(result))
  }
  // Individuele worker triggeren: POST /run/cf2-intelligence
  if (req.method === 'POST' && req.url?.startsWith('/run/')) {
    const slug = req.url.replace('/run/', '')
    const worker = WORKERS.find(w => w.key === `apify:${slug}` || w.key.endsWith(slug))
    if (!worker) {
      res.writeHead(404, { 'Content-Type': 'application/json' })
      return res.end(JSON.stringify({ error: `Worker '${slug}' niet gevonden` }))
    }
    const result = await worker.fn(msg => console.log(`  ${msg}`))
      .catch(e => ({ error: String(e?.message || e) }))
    res.writeHead(result?.error ? 500 : 200, { 'Content-Type': 'application/json' })
    return res.end(JSON.stringify(result))
  }
  res.writeHead(404)
  res.end()
})

server.listen(PORT, () => console.log(`apify-engine luistert op :${PORT}`))

// ── Minuut-cron: check windows elke minuut ───────────────────────
setInterval(() => dispatch('cron').catch(err => console.error('[cron]', err.message)), 60_000)

// ── Eerste heartbeat bij opstart ──────────────────────────────────
heartbeat('engine.apify-engine.tick', { started: true }).catch(() => {})
console.log('[apify-engine] gestart — workers:', WORKERS.map(w => w.name).join(', '))
console.log('[apify-engine] env-files geladen:', LOADED_ENV_FILES.join(', '))
console.log(`[apify-engine] APIFY_TOKEN: ${APIFY_TOKEN ? `${APIFY_TOKEN.slice(0, 12)}… (${APIFY_TOKEN.length} chars)` : 'NIET GEVONDEN ⚠️'}`)
