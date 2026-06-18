#!/usr/bin/env node
/**
 * Orlando Hooks Handler — ruflo lifecycle-integratie voor Claude Code.
 *
 * Events:
 *   pre-task      (UserPromptSubmit) → haalt relevante AgentDB-patronen op als context
 *   post-task     (Stop)             → slaat sessie-samenvatting op in AgentDB
 *   session-start (SessionStart)     → PM2 health-check + auto-heal + status-banner
 *   session-end   (SessionEnd)       → consolideert sessie-learnings
 *
 * Alle calls zijn fail-safe: ruflo/pm2 niet beschikbaar → exit 0 (geen blokkering).
 */

import { execFile } from 'child_process'
import { promisify } from 'util'

const exec    = promisify(execFile)
const EVENT   = process.argv[2] ?? ''
const TODAY   = new Date().toISOString().slice(0, 10)
const TIMEOUT = 12_000

const RUFLO_BIN  = process.env.RUFLO_BIN || 'npx'
const RUFLO_ARGS = process.env.RUFLO_BIN ? [] : ['ruflo@latest']

async function ruflo(...args) {
  try {
    const { stdout } = await exec(RUFLO_BIN, [...RUFLO_ARGS, ...args], {
      timeout: TIMEOUT,
      env: { ...process.env, NODE_NO_WARNINGS: '1' },
    })
    return stdout.trim()
  } catch {
    return ''
  }
}

// ── pm2 helper — fail-safe jlist parse ───────────────────────────────────────
async function pm2List() {
  try {
    const { stdout } = await exec('pm2', ['jlist'], {
      timeout: 6000,
      env: { ...process.env, HOME: process.env.HOME ?? '/root' },
    })
    return JSON.parse(stdout)
  } catch {
    return null  // pm2 niet bereikbaar
  }
}

// ── pre-task: geef relevante AgentDB-patronen als context aan Claude ──────────
async function preTask() {
  const patterns = await ruflo('memory', 'retrieve',
    '--query', 'orlando verdict pattern success',
    '--limit', '3',
    '--namespace', 'orlando',
  )
  if (!patterns) return

  console.log('[ReasoningBank] Relevante historische patronen voor deze taak:')
  console.log(patterns.slice(0, 800))
}

// ── post-task: sla sessie-context op in AgentDB ───────────────────────────────
async function postTask() {
  const key   = `orlando:session:post:${TODAY}:${Date.now()}`
  const value = JSON.stringify({
    event: 'post-task',
    date: TODAY,
    project: 'orlando-core-os',
    recorded_at: new Date().toISOString(),
  })
  await ruflo('memory', 'store', '--key', key, '--value', value)
}

// ── session-start: PM2 health-check + auto-heal + status-banner ──────────────
async function sessionStart() {
  const HOST        = process.env.ORLANDO_HOST ?? process.env.MACHINE_ID ?? 'cli-l'
  const PROJECT_DIR = process.env.CLAUDE_PROJECT_DIR ?? process.cwd()

  // 1. PM2 fleet check ─────────────────────────────────────────────────────
  let pm2Line   = '?'
  let pm2Online = 0
  let pm2Total  = 0

  const procs = await pm2List()

  if (procs === null) {
    pm2Line = 'pm2 niet bereikbaar'
  } else {
    pm2Total  = procs.length
    pm2Online = procs.filter(p => p.pm2_env?.status === 'online').length
    pm2Line   = `${pm2Online}/${pm2Total} online`

    if (pm2Total === 0) {
      // Geen dump → start vanuit ecosystem
      const eco = HOST === 'cli-r' ? 'ecosystem.cli-r.config.js' : 'ecosystem.config.js'
      try {
        await exec('pm2', ['start', eco], { timeout: 35_000, cwd: PROJECT_DIR, env: process.env })
        await exec('pm2', ['save', '--force'], { timeout: 8_000, env: process.env })
        const after = await pm2List()
        const n = after?.filter(p => p.pm2_env?.status === 'online').length ?? 0
        pm2Line = `${n} gestart vanuit ${eco}`
      } catch (e) {
        pm2Line = `start mislukt: ${e.message?.slice(0, 60)}`
      }
    } else if (pm2Online < Math.max(3, Math.floor(pm2Total * 0.5))) {
      // Meer dan helft down → resurrect
      try {
        await exec('pm2', ['resurrect'], { timeout: 15_000, env: process.env })
        const after = await pm2List()
        const n = after?.filter(p => p.pm2_env?.status === 'online').length ?? 0
        pm2Line = `${n}/${after?.length ?? pm2Total} na resurrect`
      } catch { /* silent */ }
    }
  }

  // 2. Ruflo check ─────────────────────────────────────────────────────────
  const rufloOut = await ruflo('memory', 'retrieve',
    '--query', 'ping',
    '--limit', '1',
    '--namespace', 'orlando',
  )
  const rufloOk = rufloOut.length > 0

  // 3. Status-banner → verschijnt als context bij elke sessie-start ─────────
  console.log(`\n╔═ Orlando · ${HOST.toUpperCase()} · ${TODAY} ════════════════════════════`)
  console.log(`║  PM2    : ${pm2Line}`)
  console.log(`║  Ruflo  : ${rufloOk ? '✓ AgentDB bereikbaar' : '✗ niet bereikbaar'}`)
  console.log(`║  MCP    : claude-flow (ruflo@latest mcp start) — via settings.json`)
  console.log(`║  Skills : render-ops · G0DM0D3(/dashboard/godmod3) · deep-research`)
  console.log(`╚═══════════════════════════════════════════════════════════════════\n`)

  // 4. Metadata opslaan in AgentDB ─────────────────────────────────────────
  const key   = `orlando:session:start:${TODAY}:${Date.now()}`
  const value = JSON.stringify({
    event: 'session-start',
    date: TODAY,
    host: HOST,
    project: 'orlando-core-os',
    branch: process.env.CLAUDE_BRANCH ?? 'unknown',
    pm2: { total: pm2Total, online: pm2Online },
    ruflo_ok: rufloOk,
    recorded_at: new Date().toISOString(),
  })
  await ruflo('memory', 'store', '--key', key, '--value', value)
}

// ── session-end: consolideer learnings van deze sessie ────────────────────────
async function sessionEnd() {
  await ruflo('memory', 'consolidate', '--namespace', 'orlando', '--date', TODAY)
}

// ── Router ────────────────────────────────────────────────────────────────────
switch (EVENT) {
  case 'pre-task':      await preTask();      break
  case 'post-task':     await postTask();     break
  case 'session-start': await sessionStart(); break
  case 'session-end':   await sessionEnd();   break
  default: break
}

process.exit(0)
