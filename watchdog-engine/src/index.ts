import 'dotenv/config'
import express from 'express'
import { RenderClient } from './render-client'
import { checkFleet } from './recovery'
import { cleanupSuspendedServices, deleteServicesByNames, liveServicesSummary } from './cleanup'
import { sendTelegram } from './telegram'
import { runOrganizationChecks } from './checks/runner'

const PORT = parseInt(process.env.PORT ?? '3006', 10)
const CHECK_INTERVAL_MS = parseInt(process.env.CHECK_INTERVAL_MS ?? '60000', 10)
const MAX_ATTEMPTS = parseInt(process.env.MAX_RECOVERY_ATTEMPTS ?? '2', 10)
const CLEANUP_INTERVAL_MS = parseInt(process.env.WATCHDOG_CLEANUP_INTERVAL_MS ?? `${6 * 60 * 60 * 1000}`, 10)
const SUSPENDED_DAYS = parseInt(process.env.WATCHDOG_SUSPENDED_DAYS ?? '14', 10)
const CLEANUP_ENABLED = (process.env.WATCHDOG_CLEANUP_ENABLED ?? 'false').toLowerCase() === 'true'
const SELF_SERVICE_ID = process.env.RENDER_SERVICE_ID || process.env.SELF_SERVICE_ID
const DENY_LIST = new Set(
  (process.env.WATCHDOG_DENYLIST ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
)
const RENDER_API_KEY = process.env.RENDER_API_KEY
const OWNER_ID_ENV = process.env.RENDER_OWNER_ID
const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const ENABLE_ORG_CHECKS = (process.env.WATCHDOG_ORG_CHECKS_ENABLED ?? 'true').toLowerCase() !== 'false'

if (!RENDER_API_KEY) {
  console.error('[watchdog] RENDER_API_KEY is required — exiting')
  process.exit(1)
}
if (ENABLE_ORG_CHECKS && (!SUPABASE_URL || !SUPABASE_KEY)) {
  console.warn('[watchdog] organization checks disabled — SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing')
}

const client = new RenderClient(RENDER_API_KEY)
let ownerId = OWNER_ID_ENV
let lastTickAt: string | null = null
let lastTickError: string | null = null
let lastCleanupAt: string | null = null
let lastCleanupError: string | null = null
let lastOrgTickAt: string | null = null
let lastOrgTickError: string | null = null

const app = express()
app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    lastTickAt,
    lastTickError,
    lastCleanupAt,
    lastCleanupError,
    lastOrgTickAt,
    lastOrgTickError,
    checkIntervalMs: CHECK_INTERVAL_MS,
    cleanupIntervalMs: CLEANUP_INTERVAL_MS,
    suspendedDays: SUSPENDED_DAYS,
    cleanupEnabled: CLEANUP_ENABLED,
    maxAttempts: MAX_ATTEMPTS,
    self: SELF_SERVICE_ID ?? null,
    denyList: [...DENY_LIST],
    orgChecksEnabled: ENABLE_ORG_CHECKS && Boolean(SUPABASE_URL && SUPABASE_KEY)
  })
})
app.post('/check-now', async (_req, res) => {
  await tick()
  res.json({ ok: true, lastTickAt, lastTickError, lastOrgTickAt, lastOrgTickError })
})
app.post('/cleanup-now', async (_req, res) => {
  await cleanupTick()
  res.json({ ok: true, lastCleanupAt, lastCleanupError, enabled: CLEANUP_ENABLED })
})
app.get('/live-services', async (_req, res) => {
  try {
    const services = await client.listServices()
    res.json(liveServicesSummary(services))
  } catch (err) {
    res.status(500).json({ ok: false, error: err instanceof Error ? err.message : String(err) })
  }
})
app.use(express.json({ limit: '1mb' }))
app.post('/delete-services', async (req, res) => {
  const body = (req.body ?? {}) as { names?: unknown }
  const namesInput = body.names
  let names: string[] = []
  if (Array.isArray(namesInput)) names = namesInput.filter((n): n is string => typeof n === 'string')
  else if (typeof namesInput === 'string') names = namesInput.split(',').map((s) => s.trim()).filter(Boolean)
  if (names.length === 0) {
    res.status(400).json({ ok: false, error: 'body.names must be a non-empty string[] or comma-separated string' })
    return
  }
  const confirm = String(req.query.confirm ?? '').toLowerCase() === 'true'
  try {
    const result = await deleteServicesByNames(client, names, {
      selfServiceId: SELF_SERVICE_ID,
      denyList: DENY_LIST,
      confirm
    })
    res.json({ ok: true, ...result })
  } catch (err) {
    res.status(500).json({ ok: false, error: err instanceof Error ? err.message : String(err) })
  }
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

  if (ENABLE_ORG_CHECKS && SUPABASE_URL && SUPABASE_KEY) {
    try {
      await runOrganizationChecks(SUPABASE_URL, SUPABASE_KEY)
      lastOrgTickAt = new Date().toISOString()
      lastOrgTickError = null
    } catch (err) {
      lastOrgTickError = err instanceof Error ? err.message : String(err)
      console.error('[watchdog] org-checks tick error:', lastOrgTickError)
    }
  }
}

async function cleanupTick(): Promise<void> {
  try {
    await cleanupSuspendedServices(client, {
      selfServiceId: SELF_SERVICE_ID,
      denyList: DENY_LIST,
      suspendedDays: SUSPENDED_DAYS,
      enabled: CLEANUP_ENABLED
    })
    lastCleanupAt = new Date().toISOString()
    lastCleanupError = null
  } catch (err) {
    lastCleanupError = err instanceof Error ? err.message : String(err)
    console.error('[watchdog] cleanup error:', lastCleanupError)
  }
}

async function main(): Promise<void> {
  app.listen(PORT, () => console.log(`[watchdog] health server on :${PORT}`))
  const cleanupMode = CLEANUP_ENABLED ? 'AUTO-DELETE' : 'dry-run'
  const orgChecksActive = ENABLE_ORG_CHECKS && Boolean(SUPABASE_URL && SUPABASE_KEY)
  await sendTelegram(
    'info',
    '🟢 Orlando Watchdog online',
    [
      `Monitoring Render fleet every ${Math.round(CHECK_INTERVAL_MS / 1000)}s.`,
      `Max ${MAX_ATTEMPTS} auto-recovery attempts per failed deploy before escalation.`,
      `Cleanup pass every ${Math.round(CLEANUP_INTERVAL_MS / 3600000)}h — ${cleanupMode} for services suspended >${SUSPENDED_DAYS}d.`,
      `Denylist: ${DENY_LIST.size} entries.`,
      orgChecksActive
        ? 'Organization checks: ENABLED (http/heartbeat/queue/freshness/cron).'
        : 'Organization checks: disabled.'
    ].join('\n')
  )
  await tick()
  await cleanupTick()
  setInterval(() => {
    void tick()
  }, CHECK_INTERVAL_MS)
  setInterval(() => {
    void cleanupTick()
  }, CLEANUP_INTERVAL_MS)
}

void main()

process.on('unhandledRejection', (err) => {
  console.error('[watchdog] unhandledRejection:', err)
})
process.on('uncaughtException', (err) => {
  console.error('[watchdog] uncaughtException:', err)
})
