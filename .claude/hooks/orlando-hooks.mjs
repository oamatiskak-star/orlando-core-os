#!/usr/bin/env node
/**
 * Orlando Hooks Handler — ruflo lifecycle-integratie voor Claude Code.
 *
 * Events:
 *   pre-task      (UserPromptSubmit) → haalt relevante AgentDB-patronen op als context
 *   post-task     (Stop)             → slaat sessie-samenvatting op in AgentDB
 *   session-start (SessionStart)     → initialiseert dagcontext + engine-venster-status
 *   session-end   (SessionEnd)       → consolideert sessie-learnings
 *
 * Alle calls zijn fail-safe: ruflo niet beschikbaar → exit 0 (geen blokkering).
 * Output naar stdout wordt door Claude Code als context-prefix gebruikt (UserPromptSubmit).
 */

import { execFile } from 'child_process'
import { promisify } from 'util'

const exec = promisify(execFile)
const EVENT = process.argv[2] ?? ''
const TODAY = new Date().toISOString().slice(0, 10)
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

// ── pre-task: geef relevante AgentDB-patronen als context aan Claude ──────────
async function preTask() {
  const patterns = await ruflo('memory', 'retrieve',
    '--query', 'orlando verdict pattern success',
    '--limit', '3',
    '--namespace', 'orlando',
  )
  if (!patterns) return  // ruflo niet bereikbaar of geen patronen → geen output

  // Output wordt door Claude Code vóór het gebruikersbericht geplaatst
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

// ── session-start: sla dagcontext op + dump engine-venster hint ──────────────
async function sessionStart() {
  const key   = `orlando:session:start:${TODAY}:${Date.now()}`
  const value = JSON.stringify({
    event: 'session-start',
    date: TODAY,
    project: 'orlando-core-os',
    branch: process.env.CLAUDE_BRANCH ?? 'unknown',
    recorded_at: new Date().toISOString(),
  })
  await ruflo('memory', 'store', '--key', key, '--value', value)
}

// ── session-end: consolideer learnings van deze sessie ────────────────────────
async function sessionEnd() {
  // Ruflo consolideert alle orlando:* sleutels van vandaag naar een dagpatroon
  await ruflo('memory', 'consolidate', '--namespace', 'orlando', '--date', TODAY)
}

// ── Router ────────────────────────────────────────────────────────────────────
switch (EVENT) {
  case 'pre-task':      await preTask();     break
  case 'post-task':     await postTask();    break
  case 'session-start': await sessionStart(); break
  case 'session-end':   await sessionEnd();  break
  default:
    // Onbekend event → stil negeren (forward-compatible)
    break
}

process.exit(0)
