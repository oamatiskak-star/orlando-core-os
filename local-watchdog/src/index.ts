import 'dotenv/config'
import express from 'express'
import { hostname } from 'os'
import { checkLocalFleet } from './recovery'
import { reconcileWorkerCommands } from './worker-commander'
import { sendTelegram } from './telegram'

const PORT = parseInt(process.env.PORT ?? '3007', 10)
const CHECK_INTERVAL_MS = parseInt(process.env.CHECK_INTERVAL_MS ?? '30000', 10)
const COMMAND_INTERVAL_MS = parseInt(process.env.COMMAND_INTERVAL_MS ?? '8000', 10)
const HOST_ID = process.env.WATCHDOG_HOST_ID || hostname()
const SELF_APP_NAME = process.env.SELF_APP_NAME || 'local-watchdog'
const DENY_LIST = new Set(
  (process.env.WATCHDOG_DENYLIST ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
)

let lastTickAt: string | null = null
let lastTickError: string | null = null
let lastCheckedCount = 0
let lastFailingApps: string[] = []
let lastCommandAt: string | null = null
let lastCommandActed: string[] = []
let lastCommandError: string | null = null

const app = express()
app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    hostId: HOST_ID,
    self: SELF_APP_NAME,
    lastTickAt,
    lastTickError,
    lastCheckedCount,
    lastFailingApps,
    checkIntervalMs: CHECK_INTERVAL_MS,
    lastCommandAt,
    lastCommandActed,
    lastCommandError,
    commandIntervalMs: COMMAND_INTERVAL_MS
  })
})
app.post('/check-now', async (_req, res) => {
  await tick()
  res.json({ ok: true, lastTickAt, lastTickError, lastFailingApps })
})

async function tick(): Promise<void> {
  try {
    const result = await checkLocalFleet({
      hostId: HOST_ID,
      selfAppName: SELF_APP_NAME,
      denyList: DENY_LIST
    })
    lastCheckedCount = result.count
    lastFailingApps = result.failing
    lastTickAt = new Date().toISOString()
    lastTickError = null
    console.log(`[local-watchdog] tick: ${result.count} apps checked${result.failing.length ? ` | failing=${result.failing.join(',')}` : ''}`)
  } catch (err) {
    lastTickError = err instanceof Error ? err.message : String(err)
    console.error('[local-watchdog] tick error:', lastTickError)
  }
}

async function commandTick(): Promise<void> {
  try {
    const res = await reconcileWorkerCommands()
    lastCommandAt = new Date().toISOString()
    lastCommandActed = res.acted
    lastCommandError = res.errors.length ? res.errors.join('; ') : null
    if (res.acted.length) {
      console.log(`[local-watchdog] worker commands: ${res.acted.join(', ')}`)
    }
  } catch (err) {
    lastCommandError = err instanceof Error ? err.message : String(err)
    console.error('[local-watchdog] command tick error:', lastCommandError)
  }
}

async function main(): Promise<void> {
  app.listen(PORT, '127.0.0.1', () =>
    console.log(`[local-watchdog] host=${HOST_ID} health on 127.0.0.1:${PORT}`)
  )
  await sendTelegram(
    'info',
    `🟢 Local Watchdog online on ${HOST_ID}`,
    `Monitoring PM2 fleet every ${Math.round(CHECK_INTERVAL_MS / 1000)}s. Crash-loop rebuild + restart enabled. Self-skip: ${SELF_APP_NAME}.`
  )
  await tick()
  setInterval(() => {
    void tick()
  }, CHECK_INTERVAL_MS)

  await commandTick()
  setInterval(() => {
    void commandTick()
  }, COMMAND_INTERVAL_MS)
}

void main()

process.on('unhandledRejection', (err) => {
  console.error('[local-watchdog] unhandledRejection:', err)
})
process.on('uncaughtException', (err) => {
  console.error('[local-watchdog] uncaughtException:', err)
})
