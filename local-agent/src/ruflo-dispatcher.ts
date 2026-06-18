import './ws-shim'   // MOET eerst — zet global WebSocket vóór elke @supabase-import
import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import { spawn } from 'child_process'

/**
 * Ruflo Dispatcher — AI-orchestratie in het 'ai' tijdblok (04:00-06:00 NL).
 *
 * Verantwoordelijkheden:
 *   1. Engine-window check  → draait alleen als engine_window_open('ai:ruflo-coordinator') = true
 *   2. Ruflo research-agent → analyseert viral_patterns + trending topics via ruflo CLI
 *   3. AgentDB memory       → slaat dagcontext op voor de YouTube-pipeline (06:00+)
 *   4. Heartbeat            → schrijft naar infra_watchdog_heartbeats elke poll-cyclus
 *
 * Spawnt ruflo via CLI (npx ruflo@latest); geen directe MCP-serververbinding nodig.
 * Gedraagt zich correct als ruflo niet geïnstalleerd is: logt één keer en blijft idle.
 *
 * Harde regels (conform CLAUDE.md):
 * - Raakt NOOIT youtube_upload_queue, cf2_jobs of content-productiedata.
 * - Geen externe API-call zonder key.
 * - Graceful degradatie: ontbreekt SUPABASE_URL → exit(1); ontbreekt ruflo → log + skip.
 */

const SUPABASE_URL              = process.env.SUPABASE_URL!
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const ENGINE_KEY                = 'ai:ruflo-coordinator'
const AGENTDB_ENGINE_KEY        = 'ai:agentdb-sync'
const POLL_INTERVAL_MS          = Number(process.env.RUFLO_POLL_INTERVAL_MS) || 5 * 60_000  // 5 min
const RUFLO_BIN                 = process.env.RUFLO_BIN || 'npx'
const RUFLO_ARGS_PREFIX         = process.env.RUFLO_BIN ? [] : ['ruflo@latest']

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('[ruflo-dispatcher] SUPABASE_URL en SUPABASE_SERVICE_ROLE_KEY zijn verplicht.')
  process.exit(1)
}

const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

function log(msg: string, ...args: unknown[]) {
  console.log(`[${new Date().toISOString()}] [ruflo-dispatcher] ${msg}`, ...args)
}

async function engineWindowOpen(key: string): Promise<boolean> {
  const { data, error } = await db.rpc('engine_window_open', { p_engine_key: key })
  if (error) { log('engine_window_open fout:', error.message); return false }
  return !!data
}

async function heartbeat(status: 'ok' | 'skipped' | 'error', meta?: Record<string, unknown>) {
  await db.from('infra_watchdog_heartbeats')
    .upsert({ slug: 'engine.ruflo-dispatcher.tick', last_seen_at: new Date().toISOString(), status, meta: meta ?? null, updated_at: new Date().toISOString() }, { onConflict: 'slug' })
}

function runRuflo(args: string[]): Promise<{ ok: boolean; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const fullArgs = [...RUFLO_ARGS_PREFIX, ...args]
    const proc = spawn(RUFLO_BIN, fullArgs, { env: { ...process.env, NODE_NO_WARNINGS: '1' } })
    let stdout = ''
    let stderr = ''
    proc.stdout.on('data', (d: Buffer) => { stdout += d.toString() })
    proc.stderr.on('data', (d: Buffer) => { stderr += d.toString() })
    proc.on('close', (code) => resolve({ ok: code === 0, stdout: stdout.trim(), stderr: stderr.trim() }))
    proc.on('error', (err) => resolve({ ok: false, stdout: '', stderr: err.message }))
    setTimeout(() => { proc.kill(); resolve({ ok: false, stdout, stderr: 'timeout' }) }, 60_000)
  })
}

async function runCoordinatorCycle() {
  log('AI-venster open — start ruflo coordinator-cyclus')

  // 1. Verifieer ruflo bereikbaarheid
  const status = await runRuflo(['status'])
  if (!status.ok) {
    log('ruflo niet bereikbaar — sla cyclus over. stderr:', status.stderr)
    await heartbeat('error', { reason: 'ruflo_unavailable', stderr: status.stderr.slice(0, 200) })
    return
  }
  log('ruflo status OK')

  // 2. Sla dagcontext op in AgentDB (key: orlando:daily-context:<datum>)
  const today = new Date().toISOString().slice(0, 10)
  const contextValue = JSON.stringify({
    date: today,
    phase: 'ai-prep',
    pipeline: 'youtube-content-factory',
    note: 'Dagelijkse AI-voorbereiding vóór YouTube-pipeline (06:00)',
  })
  const store = await runRuflo(['memory', 'store', '--key', `orlando:daily-context:${today}`, '--value', contextValue])
  if (store.ok) {
    log(`AgentDB: dagcontext opgeslagen voor ${today}`)
  } else {
    log('AgentDB store mislukt (niet fataal):', store.stderr.slice(0, 100))
  }

  // 3. Haal relevante patronen op uit AgentDB voor YouTube-pipeline
  const retrieve = await runRuflo(['memory', 'retrieve', '--query', 'youtube viral patterns high CTR', '--limit', '5'])
  if (retrieve.ok && retrieve.stdout) {
    log('AgentDB patronen opgehaald:', retrieve.stdout.slice(0, 200))
  }

  // 4. Heartbeat: cyclus geslaagd
  await heartbeat('ok', { cycle: today, store_ok: store.ok, retrieve_ok: retrieve.ok })
  log('Coordinator-cyclus voltooid')
}

async function runAgentDbSync() {
  const windowOpen = await engineWindowOpen(AGENTDB_ENGINE_KEY)
  if (!windowOpen) return

  log('AgentDB-sync venster open — memory consolidatie')
  const result = await runRuflo(['memory', 'consolidate', '--namespace', 'orlando'])
  if (result.ok) {
    log('AgentDB consolidatie geslaagd')
  } else {
    log('AgentDB consolidatie mislukt (niet fataal):', result.stderr.slice(0, 100))
  }
}

async function tick() {
  try {
    const coordinatorOpen = await engineWindowOpen(ENGINE_KEY)
    if (!coordinatorOpen) {
      await heartbeat('skipped')
      return
    }
    await runCoordinatorCycle()
    await runAgentDbSync()
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    log('Onverwachte fout in tick:', msg)
    await heartbeat('error', { reason: msg.slice(0, 200) })
  }
}

log(`Gestart. Poll-interval: ${POLL_INTERVAL_MS / 60_000} min. Engine-key: ${ENGINE_KEY}`)
tick()
setInterval(tick, POLL_INTERVAL_MS)
