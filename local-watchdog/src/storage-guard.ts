import { exec } from 'child_process'
import { promisify } from 'util'
import { hostname } from 'os'
import { sendTelegram } from './telegram'

const execAsync = promisify(exec)

// ── Config (env-overridable) ─────────────────────────────────────────────
const ENABLED = (process.env.STORAGE_GUARD_ENABLED ?? '1') !== '0'
const HOST_ID = process.env.WATCHDOG_HOST_ID || hostname()
const DATA_VOLUME = process.env.STORAGE_DATA_VOLUME || '/System/Volumes/Data'
const DOCKER_RAW =
  process.env.STORAGE_DOCKER_RAW ||
  `${process.env.HOME}/Library/Containers/com.docker.docker/Data/vms/0/data/Docker.raw`

const WARN_PCT = parseInt(process.env.STORAGE_WARN_PCT ?? '70', 10)
const AGGRESSIVE_PCT = parseInt(process.env.STORAGE_AGGRESSIVE_PCT ?? '80', 10)
const EMERGENCY_PCT = parseInt(process.env.STORAGE_EMERGENCY_PCT ?? '90', 10)

// Bij aggressive cleanup: container-logs groter dan dit truncaten.
const AGGRESSIVE_LOG_MB = parseInt(process.env.STORAGE_AGGRESSIVE_LOG_MB ?? '500', 10)
// Bij emergency: alles groter dan dit truncaten (strenger).
const EMERGENCY_LOG_MB = parseInt(process.env.STORAGE_EMERGENCY_LOG_MB ?? '100', 10)
// Onafhankelijk van diskdruk: een log die hierboven uitkomt is altijd een runaway → truncaten.
const HARD_LOG_MB = parseInt(process.env.STORAGE_HARD_LOG_MB ?? '2000', 10)

const ALERT_COOLDOWN_MS = parseInt(process.env.STORAGE_ALERT_COOLDOWN_MS ?? '1800000', 10) // 30 min

// nsenter-wrapper: voert een commando uit BINNEN de Docker-VM (waar /var/lib/docker leeft).
const VM_EXEC = 'docker run --rm --privileged --pid=host alpine nsenter -t 1 -m -u -i -n'

// ── State (voor /health) ─────────────────────────────────────────────────
export interface StorageState {
  lastCheckAt: string | null
  lastError: string | null
  diskPct: number | null
  freeGb: number | null
  usedGb: number | null
  dockerRawGb: number | null
  lastTier: 'ok' | 'warning' | 'aggressive' | 'emergency' | null
  lastAction: string[]
  lastTruncated: string[]
  reclaimedGbTotal: number
}

const state: StorageState = {
  lastCheckAt: null,
  lastError: null,
  diskPct: null,
  freeGb: null,
  usedGb: null,
  dockerRawGb: null,
  lastTier: null,
  lastAction: [],
  lastTruncated: [],
  reclaimedGbTotal: 0
}

export function getStorageState(): StorageState {
  return state
}

const lastAlertAt: Record<string, number> = {}
function alertAllowed(key: string): boolean {
  const now = Date.now()
  if (lastAlertAt[key] && now - lastAlertAt[key] < ALERT_COOLDOWN_MS) return false
  lastAlertAt[key] = now
  return true
}

// ── Metingen ──────────────────────────────────────────────────────────────
async function getDiskUsage(): Promise<{ pct: number; freeGb: number; usedGb: number; sizeGb: number }> {
  // df -k geeft 1K-blocks; kolommen: Filesystem Size Used Avail Capacity ...
  const { stdout } = await execAsync(`df -k "${DATA_VOLUME}" | tail -1`)
  const parts = stdout.trim().split(/\s+/)
  // parts: [fs, size, used, avail, capacity%, ...]
  const sizeKb = parseInt(parts[1], 10)
  const usedKb = parseInt(parts[2], 10)
  const availKb = parseInt(parts[3], 10)
  const pct = Math.round((usedKb / (usedKb + availKb)) * 100)
  return {
    pct,
    freeGb: +(availKb / 1024 / 1024).toFixed(1),
    usedGb: +(usedKb / 1024 / 1024).toFixed(1),
    sizeGb: +(sizeKb / 1024 / 1024).toFixed(1)
  }
}

async function getDockerRawGb(): Promise<number | null> {
  try {
    const { stdout } = await execAsync(`du -k "${DOCKER_RAW}" 2>/dev/null | tail -1`)
    const kb = parseInt(stdout.trim().split(/\s+/)[0], 10)
    return Number.isFinite(kb) ? +(kb / 1024 / 1024).toFixed(1) : null
  } catch {
    return null
  }
}

// Map container-id (uit het log-pad) → container-naam, voor leesbare alerts.
async function containerIdToName(): Promise<Record<string, string>> {
  const map: Record<string, string> = {}
  try {
    const { stdout } = await execAsync(`docker ps -a --no-trunc --format '{{.ID}} {{.Names}}'`)
    for (const line of stdout.trim().split('\n')) {
      const [id, ...rest] = line.trim().split(' ')
      if (id) map[id] = rest.join(' ')
    }
  } catch {
    /* docker mogelijk niet bereikbaar */
  }
  return map
}

interface OversizedLog {
  path: string
  bytes: number
  containerId: string
  name: string
}

// Zoekt container json-logs groter dan minMb (binnen de Docker-VM).
async function findOversizedLogs(minMb: number): Promise<OversizedLog[]> {
  const cmd =
    `${VM_EXEC} sh -c "find /var/lib/docker/containers -name '*-json.log' -size +${minMb}m -exec du -k {} + 2>/dev/null"`
  const { stdout } = await execAsync(cmd, { timeout: 120_000 })
  const idMap = await containerIdToName()
  const out: OversizedLog[] = []
  for (const line of stdout.trim().split('\n')) {
    if (!line.trim()) continue
    const m = line.trim().match(/^(\d+)\s+(.+)$/)
    if (!m) continue
    const bytes = parseInt(m[1], 10) * 1024
    const path = m[2]
    const idMatch = path.match(/containers\/([0-9a-f]+)\//)
    const containerId = idMatch ? idMatch[1] : ''
    out.push({ path, bytes, containerId, name: idMap[containerId] || containerId.slice(0, 12) })
  }
  return out
}

async function truncateLogs(logs: OversizedLog[]): Promise<void> {
  for (const log of logs) {
    await execAsync(`${VM_EXEC} sh -c "truncate -s 0 '${log.path}'"`, { timeout: 60_000 })
  }
}

async function safePrune(): Promise<string> {
  // ALLEEN build-cache + dangling images. NOOIT volumes of actieve images.
  const results: string[] = []
  try {
    await execAsync('docker builder prune -f', { timeout: 120_000 })
    results.push('builder-prune')
  } catch { /* skip */ }
  try {
    await execAsync('docker image prune -f', { timeout: 120_000 })
    results.push('image-prune(dangling)')
  } catch { /* skip */ }
  return results.join(', ')
}

// Geeft binnen de VM vrijgegeven blokken terug aan de host (krimpt Docker.raw).
async function reclaimVmSpace(): Promise<void> {
  await execAsync(`${VM_EXEC} fstrim /var/lib/docker`, { timeout: 180_000 }).catch(() => {})
}

// ── Hoofdcheck ──────────────────────────────────────────────────────────────
export async function runStorageCheck(): Promise<void> {
  if (!ENABLED) return
  try {
    const disk = await getDiskUsage()
    state.diskPct = disk.pct
    state.freeGb = disk.freeGb
    state.usedGb = disk.usedGb
    state.dockerRawGb = await getDockerRawGb()
    state.lastCheckAt = new Date().toISOString()
    state.lastError = null
    state.lastAction = []
    state.lastTruncated = []

    // (1) Hard runaway-log guard: ALTIJD, ongeacht diskdruk. Dit is exact de
    //     failure-mode die CLI-R's SSD volzette (crash-loop log = 129GB).
    let runaway: OversizedLog[] = []
    try {
      runaway = await findOversizedLogs(HARD_LOG_MB)
    } catch { /* docker mogelijk down */ }
    if (runaway.length) {
      const before = state.dockerRawGb ?? 0
      await truncateLogs(runaway)
      await reclaimVmSpace()
      state.dockerRawGb = await getDockerRawGb()
      const names = runaway.map((l) => `${l.name} (${(l.bytes / 1024 ** 3).toFixed(1)}GB)`)
      state.lastTruncated = names
      state.lastAction.push('runaway-log-truncate')
      if (alertAllowed('runaway')) {
        await sendTelegram(
          'critical',
          `🚨 Runaway container-log getrunceerd op ${HOST_ID}`,
          `Logs >${HARD_LOG_MB}MB geleegd:\n${names.join('\n')}\nDocker.raw: ${before}GB → ${state.dockerRawGb}GB\nVrije schijf: ${state.freeGb}GB (${disk.pct}%)`
        )
      }
    }

    // (2) Drempelgebaseerde tiers.
    if (disk.pct >= EMERGENCY_PCT) {
      state.lastTier = 'emergency'
      const logs = await findOversizedLogs(EMERGENCY_LOG_MB).catch(() => [])
      if (logs.length) {
        await truncateLogs(logs)
        state.lastTruncated.push(...logs.map((l) => `${l.name} (${(l.bytes / 1024 ** 3).toFixed(2)}GB)`))
      }
      const pruned = await safePrune()
      await reclaimVmSpace()
      state.dockerRawGb = await getDockerRawGb()
      const after = await getDiskUsage()
      state.lastAction.push(`emergency-cleanup [${pruned}]`)
      if (alertAllowed('emergency')) {
        await sendTelegram(
          'critical',
          `🚨 EMERGENCY storage cleanup op ${HOST_ID}`,
          `Schijf was ${disk.pct}% (${disk.freeGb}GB vrij).\nGetrunceerd: ${state.lastTruncated.length} logs\nPruned: ${pruned}\nNa cleanup: ${after.pct}% (${after.freeGb}GB vrij)`
        )
      }
    } else if (disk.pct >= AGGRESSIVE_PCT) {
      state.lastTier = 'aggressive'
      const logs = await findOversizedLogs(AGGRESSIVE_LOG_MB).catch(() => [])
      if (logs.length) {
        await truncateLogs(logs)
        state.lastTruncated.push(...logs.map((l) => `${l.name} (${(l.bytes / 1024 ** 3).toFixed(2)}GB)`))
      }
      const pruned = await safePrune()
      await reclaimVmSpace()
      state.dockerRawGb = await getDockerRawGb()
      const after = await getDiskUsage()
      state.lastAction.push(`aggressive-cleanup [${pruned}]`)
      if (alertAllowed('aggressive')) {
        await sendTelegram(
          'warning',
          `⚠️ Aggressive storage cleanup op ${HOST_ID}`,
          `Schijf ${disk.pct}% (${disk.freeGb}GB vrij).\nGetrunceerd: ${state.lastTruncated.length} logs\nPruned: ${pruned}\nNa: ${after.pct}% (${after.freeGb}GB vrij)`
        )
      }
    } else if (disk.pct >= WARN_PCT) {
      state.lastTier = 'warning'
      if (alertAllowed('warning')) {
        await sendTelegram(
          'warning',
          `⚠️ Schijf ${disk.pct}% vol op ${HOST_ID}`,
          `Nog ${disk.freeGb}GB vrij van ${disk.sizeGb}GB. Docker.raw: ${state.dockerRawGb}GB. Nog geen cleanup (drempel ${AGGRESSIVE_PCT}%).`
        )
      }
    } else {
      state.lastTier = 'ok'
    }

    console.log(
      `[storage-guard] ${HOST_ID} disk=${disk.pct}% free=${disk.freeGb}GB docker.raw=${state.dockerRawGb}GB tier=${state.lastTier}` +
        (state.lastAction.length ? ` actions=[${state.lastAction.join(', ')}]` : '')
    )
  } catch (err) {
    state.lastError = err instanceof Error ? err.message : String(err)
    console.error('[storage-guard] error:', state.lastError)
  }
}
