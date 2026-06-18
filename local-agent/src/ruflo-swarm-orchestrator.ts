import './ws-shim'   // MOET eerst — zet global WebSocket vóór elke @supabase-import
import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import { spawn, ChildProcess } from 'child_process'
import { readFileSync } from 'fs'
import { join } from 'path'

/**
 * Ruflo Swarm Orchestrator — hiërarchische multi-swarm coördinator.
 *
 * Beheert de levenscyclus van drie Orlando-sub-swarms op basis van Engine Planner-vensters:
 *   orlando-youtube   → block 'youtube'   (06:00-07:00 NL): trend-research + SEO + QC
 *   orlando-acquisition → block 'acq_ai'  (17:00-18:30 NL): deal-research + affiliate
 *   orlando-memory    → block 'ai'        (04:00-06:00 NL): memory-consolidatie
 *
 * Per swarm:
 *   - Open venster  → spawn ruflo-swarm via CLI, sla context op in AgentDB
 *   - Gesloten venster → stop swarm netjes
 *   - Heartbeat naar infra_watchdog_heartbeats elke cyclus
 *
 * Raakt NOOIT productiedata, upload-queues of cf2_jobs. Geeft alleen strategische
 * intelligence terug aan AgentDB; de bestaande workers lezen die optioneel uit.
 *
 * Vereist: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

const SUPABASE_URL              = process.env.SUPABASE_URL!
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const POLL_INTERVAL_MS          = Number(process.env.SWARM_POLL_INTERVAL_MS) || 2 * 60_000   // 2 min
const RUFLO_BIN                 = process.env.RUFLO_BIN || 'npx'
const RUFLO_ARGS_PREFIX         = process.env.RUFLO_BIN ? [] : ['ruflo@latest']
const SWARM_TIMEOUT_MS          = Number(process.env.SWARM_TIMEOUT_MS) || 50 * 60_000        // 50 min per swarm-run

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('[swarm-orchestrator] SUPABASE_URL en SUPABASE_SERVICE_ROLE_KEY zijn verplicht.')
  process.exit(1)
}

const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

// ── Config laden ──────────────────────────────────────────────────────────────


interface AgentDef {
  name: string
  type: string
  role: string
  task: string
}

interface SwarmDef {
  name: string
  engine_key: string
  description: string
  strategy: string
  agents: AgentDef[]
}

interface SwarmConfig {
  version: string
  topology: string
  queen: { name: string; type: string }
  swarms: SwarmDef[]
}

const CONFIG_PATH = join(__dirname, 'orlando-swarm.json')
let swarmConfig: SwarmConfig

try {
  swarmConfig = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8')) as SwarmConfig
} catch (err) {
  console.error('[swarm-orchestrator] Kan orlando-swarm.json niet laden:', err)
  process.exit(1)
}

// ── State: welke swarms draaien op dit moment ─────────────────────────────────

interface RunningSwarm {
  proc: ChildProcess
  startedAt: Date
  swarmName: string
}

const running = new Map<string, RunningSwarm>()

// ── Helpers ───────────────────────────────────────────────────────────────────

function log(msg: string, ...args: unknown[]) {
  console.log(`[${new Date().toISOString()}] [swarm-orchestrator] ${msg}`, ...args)
}

async function engineWindowOpen(key: string): Promise<boolean> {
  const { data, error } = await db.rpc('engine_window_open', { p_engine_key: key })
  if (error) { log(`engine_window_open(${key}) fout:`, error.message); return false }
  return !!data
}

async function heartbeat(status: 'ok' | 'partial' | 'idle' | 'error', meta?: Record<string, unknown>) {
  await db
    .from('infra_watchdog_heartbeats')
    .upsert(
      { slug: 'engine.ruflo-swarm-orchestrator.tick', last_seen_at: new Date().toISOString(), status, meta: meta ?? null, updated_at: new Date().toISOString() },
      { onConflict: 'slug' }
    )
}

function ruflo(args: string[]): Promise<{ ok: boolean; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const fullArgs = [...RUFLO_ARGS_PREFIX, ...args]
    const proc = spawn(RUFLO_BIN, fullArgs, { env: { ...process.env, NODE_NO_WARNINGS: '1' } })
    let out = ''
    let err = ''
    proc.stdout.on('data', (d: Buffer) => { out += d.toString() })
    proc.stderr.on('data', (d: Buffer) => { err += d.toString() })
    proc.on('close', (code) => resolve({ ok: code === 0, stdout: out.trim(), stderr: err.trim() }))
    proc.on('error', (e) => resolve({ ok: false, stdout: '', stderr: e.message }))
    setTimeout(() => { proc.kill(); resolve({ ok: false, stdout: out, stderr: 'timeout' }) }, 60_000)
  })
}

// ── Swarm starten ─────────────────────────────────────────────────────────────

async function startSwarm(swarm: SwarmDef) {
  if (running.has(swarm.name)) return   // al actief

  log(`Start swarm '${swarm.name}' (${swarm.description})`)

  // 1. Context ophalen uit AgentDB (non-blocking; mislukken is niet fataal)
  const today = new Date().toISOString().slice(0, 10)
  const ctxResult = await ruflo(['memory', 'retrieve', '--query', `orlando patterns ${swarm.engine_key}`, '--limit', '3'])
  const context = ctxResult.ok ? ctxResult.stdout.slice(0, 500) : ''

  // 2. Agent-names en task-beschrijvingen samenstellen
  const agentNames = swarm.agents.map((a) => a.name).join(',')
  const taskDescription = swarm.agents
    .map((a) => `[${a.name}] ${a.task}`)
    .join(' | ')
    .slice(0, 800)  // ruflo CLI-limiet

  const fullArgs = [...RUFLO_ARGS_PREFIX,
    'swarm', 'start',
    '--name',     swarm.name,
    '--topology', 'hierarchical',
    '--strategy', swarm.strategy,
    '--agents',   agentNames,
    '--task',     taskDescription,
    ...(context ? ['--context', context] : []),
  ]

  const proc = spawn(RUFLO_BIN, fullArgs, {
    env: { ...process.env, NODE_NO_WARNINGS: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  const entry: RunningSwarm = { proc, startedAt: new Date(), swarmName: swarm.name }
  running.set(swarm.name, entry)

  let stdout = ''
  let stderr = ''
  proc.stdout.on('data', (d: Buffer) => { stdout += d.toString() })
  proc.stderr.on('data', (d: Buffer) => { stderr += d.toString() })

  // Auto-timeout: swarm mag maximaal SWARM_TIMEOUT_MS draaien
  const timeout = setTimeout(() => {
    log(`Swarm '${swarm.name}' timeout na ${SWARM_TIMEOUT_MS / 60_000} min — kill`)
    proc.kill('SIGTERM')
  }, SWARM_TIMEOUT_MS)

  proc.on('close', async (code) => {
    clearTimeout(timeout)
    running.delete(swarm.name)
    const ok = code === 0
    log(`Swarm '${swarm.name}' beëindigd (code ${code})`)

    // Uitkomst opslaan in AgentDB
    if (stdout.trim()) {
      await ruflo(['memory', 'store',
        '--key',   `orlando:swarm-output:${swarm.name}:${today}`,
        '--value', stdout.slice(0, 2000),
      ])
    }

    await heartbeat(ok ? 'ok' : 'partial', {
      swarm: swarm.name, exit_code: code, stdout_preview: stdout.slice(0, 200),
      stderr_preview: stderr.slice(0, 100),
    })
  })

  proc.on('error', (err) => {
    clearTimeout(timeout)
    running.delete(swarm.name)
    log(`Swarm '${swarm.name}' spawn-fout:`, err.message)
  })
}

// ── Swarm stoppen ─────────────────────────────────────────────────────────────

function stopSwarm(name: string) {
  const entry = running.get(name)
  if (!entry) return
  log(`Stop swarm '${name}' (venster gesloten)`)
  entry.proc.kill('SIGTERM')
  running.delete(name)
}

// ── Ruflo bereikbaarheid (eenmalig bij start) ─────────────────────────────────

async function verifyRuflo(): Promise<boolean> {
  const res = await ruflo(['--version'])
  if (!res.ok) {
    log('ruflo niet beschikbaar — orchestrator draait maar alle swarms worden overgeslagen.')
    log('Installeer ruflo: cd ruflo && npm install --legacy-peer-deps')
    return false
  }
  log('ruflo bereikbaar:', res.stdout.trim())
  return true
}

// ── Hoofd-pollingloop ─────────────────────────────────────────────────────────

let rufloAvailable = false

async function tick() {
  if (!rufloAvailable) {
    await heartbeat('idle', { reason: 'ruflo_unavailable' })
    return
  }

  const activeSwarms: string[] = []
  const errors: string[] = []

  for (const swarm of swarmConfig.swarms) {
    try {
      const open = await engineWindowOpen(swarm.engine_key)

      if (open && !running.has(swarm.name)) {
        await startSwarm(swarm)
        activeSwarms.push(swarm.name)
      } else if (!open && running.has(swarm.name)) {
        stopSwarm(swarm.name)
      } else if (open && running.has(swarm.name)) {
        activeSwarms.push(swarm.name)   // al actief, venster nog open
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      log(`Fout bij swarm '${swarm.name}':`, msg)
      errors.push(`${swarm.name}: ${msg.slice(0, 80)}`)
    }
  }

  const status = errors.length > 0 ? 'partial' : activeSwarms.length > 0 ? 'ok' : 'idle'
  await heartbeat(status, {
    active: activeSwarms,
    errors: errors.length > 0 ? errors : undefined,
    running_count: running.size,
  })
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────

log(`Gestart. Topology: ${swarmConfig.topology}, swarms: ${swarmConfig.swarms.map((s) => s.name).join(', ')}`)
log(`Poll-interval: ${POLL_INTERVAL_MS / 60_000} min, timeout per swarm: ${SWARM_TIMEOUT_MS / 60_000} min`)

verifyRuflo().then((ok) => {
  rufloAvailable = ok
  tick()
  setInterval(tick, POLL_INTERVAL_MS)
})

// Graceful shutdown: alle actieve swarms stoppen
process.on('SIGTERM', () => {
  log('SIGTERM ontvangen — stop alle actieve swarms')
  for (const [name] of running) stopSwarm(name)
  process.exit(0)
})
process.on('SIGINT', () => {
  log('SIGINT ontvangen — stop alle actieve swarms')
  for (const [name] of running) stopSwarm(name)
  process.exit(0)
})
