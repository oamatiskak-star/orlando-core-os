import 'dotenv/config'
import express from 'express'
import { RenderClient } from './render-client'
import { checkFleet } from './recovery'
import { sendTelegram } from './telegram'

const PORT = parseInt(process.env.PORT ?? '3006', 10)
const CHECK_INTERVAL_MS = parseInt(process.env.CHECK_INTERVAL_MS ?? '60000', 10)
const MAX_ATTEMPTS = parseInt(process.env.MAX_RECOVERY_ATTEMPTS ?? '2', 10)
const SELF_SERVICE_ID = process.env.RENDER_SERVICE_ID || process.env.SELF_SERVICE_ID
const DENY_LIST = new Set(
  (process.env.WATCHDOG_DENYLIST ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
)
const RENDER_API_KEY = process.env.RENDER_API_KEY
const OWNER_ID_ENV = process.env.RENDER_OWNER_ID

if (!RENDER_API_KEY) {
  console.error('[watchdog] RENDER_API_KEY is required — exiting')
  process.exit(1)
}

const client = new RenderClient(RENDER_API_KEY)
let ownerId = OWNER_ID_ENV
let lastTickAt: string | null = null
let lastTickError: string | null = null

const app = express()
app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    lastTickAt,
    lastTickError,
    checkIntervalMs: CHECK_INTERVAL_MS,
    maxAttempts: MAX_ATTEMPTS,
    self: SELF_SERVICE_ID ?? null
  })
})
app.post('/check-now', async (_req, res) => {
  await tick()
  res.json({ ok: true, lastTickAt, lastTickError })
})

async function bootstrapOwner(): Promise<string> {
  if (ownerId) return ownerId
  const owners = await client.listOwners()
  if (!owners[0]) throw new Error('No Render owner found for this API key')
  ownerId = owners[0].id
  console.log(`[watchdog] resolved ownerId=${ownerId} (${owners[0].name})`)
  return ownerId
}

async function tick(): Promise<void> {
  try {
    const oid = await bootstrapOwner()
    await checkFleet(client, {
      selfServiceId: SELF_SERVICE_ID,
      denyList: DENY_LIST,
      ownerId: oid,
      maxAttempts: MAX_ATTEMPTS
    })
    lastTickAt = new Date().toISOString()
    lastTickError = null
  } catch (err) {
    lastTickError = err instanceof Error ? err.message : String(err)
    console.error('[watchdog] tick error:', lastTickError)
  }
}

async function main(): Promise<void> {
  app.listen(PORT, () => console.log(`[watchdog] health server on :${PORT}`))
  await sendTelegram(
    'info',
    '🟢 Orlando Watchdog online',
    `Monitoring Render fleet every ${Math.round(CHECK_INTERVAL_MS / 1000)}s. Max ${MAX_ATTEMPTS} auto-recovery attempts per failed deploy before escalation.`
  )
  await tick()
  setInterval(() => {
    void tick()
  }, CHECK_INTERVAL_MS)
}

void main()

process.on('unhandledRejection', (err) => {
  console.error('[watchdog] unhandledRejection:', err)
})
process.on('uncaughtException', (err) => {
  console.error('[watchdog] uncaughtException:', err)
})
