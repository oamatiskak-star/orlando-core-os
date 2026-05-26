// index.mjs — Competitor Intelligence Engine entrypoint.
// Dependency-free (Node >=20): built-in http server + setInterval scheduler.
//   START_MODE=once   → draait één run en stopt (smoke test / cron-callback)
//   anders            → http server (GET /health, POST /run) + dagelijkse cron
import http from 'node:http'
import { PORT, CRON_HOUR } from './config.mjs'
import { runSpyglass } from './spyglass.mjs'
import { update } from './supabase.mjs'

function log(...args) {
  console.log(`[${new Date().toISOString()}]`, ...args)
}

let running = false
async function runGuarded(trigger) {
  if (running) return { skipped: 'already_running' }
  running = true
  try {
    await update('agent_personas', 'name=eq.Spyglass', { status: 'busy', updated_at: new Date().toISOString() }).catch(() => {})
    log(`run start (trigger=${trigger})`)
    const result = await runSpyglass({ log })
    return result
  } finally {
    running = false
  }
}

if (process.env.START_MODE === 'once') {
  runGuarded('once')
    .then(r => { log('once done', r); process.exit(0) })
    .catch(e => { console.error('once failed', e); process.exit(1) })
} else {
  const server = http.createServer(async (req, res) => {
    if (req.method === 'GET' && req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      return res.end(JSON.stringify({ status: 'ok', service: 'competitor-intel-engine', running, time: new Date().toISOString() }))
    }
    if (req.method === 'POST' && req.url === '/run') {
      const result = await runGuarded('manual').catch(e => ({ error: String(e?.message || e) }))
      res.writeHead(result.error ? 500 : 200, { 'Content-Type': 'application/json' })
      return res.end(JSON.stringify(result))
    }
    res.writeHead(404, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'not found' }))
  })
  server.listen(PORT, () => log(`competitor-intel-engine luistert op :${PORT} (dagelijkse cron ${CRON_HOUR}:15 UTC)`))

  // Simpele dagelijkse scheduler: check elk uur of het het cron-uur is.
  let lastRunDay = null
  setInterval(async () => {
    const now = new Date()
    const dayKey = now.toISOString().slice(0, 10)
    if (now.getUTCHours() === CRON_HOUR && lastRunDay !== dayKey) {
      lastRunDay = dayKey
      await runGuarded('cron').catch(e => console.error('cron run failed', e))
    }
  }, 60 * 1000)
}
