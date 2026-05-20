import 'dotenv/config'
import { getSupabase } from '../lib/supabase'
import { logger, workerLogger } from '../lib/logger'
import { getWorkerConfig, setWorkerStatus, workerExists } from '../lib/worker-heartbeat'
import { scanCompetitor, CompetitorRow, ScanResult } from './scanner'

const log = workerLogger('competitor-scanner')

// ─────────────────────────────────────────────────────────────────────────────
// Entry point voor de competitor-surveillance scanner.
// Draait als losstaand Node-proces (Docker service of node dist/competitor-scanner.js).
// Cron interval komt uit media_holding_workers.config.sweep_interval_min
// (default 60). Per sweep doorloopt het alle actieve competitor_channels
// waarvan platform == 'youtube'.
// TikTok scanner staat in dezelfde infra geregistreerd maar is nog niet
// geïmplementeerd — sweep loopt door op platform != youtube met een 'unsupported_platform' return.
// ─────────────────────────────────────────────────────────────────────────────

const WORKER_NAME       = process.env.COMPETITOR_WORKER_NAME ?? 'competitor-surveillance-yt'
const PLATFORM_FILTER   = process.env.COMPETITOR_PLATFORM    ?? 'youtube'
const DEFAULT_INTERVAL  = 60 // minutes
const SCAN_CONCURRENCY  = 3  // parallel competitors per sweep

interface SweepStats {
  competitors:   number
  videos_seen:   number
  videos_new:    number
  signals:       number
  errors:        number
  duration_ms:   number
}

async function sweep(): Promise<SweepStats> {
  const start = Date.now()
  const db = getSupabase()

  const { data: competitors, error } = await db
    .from('competitor_channels')
    .select('id, platform, external_id, name, niche, language, subscriber_count, video_count, total_view_count, last_scanned_at')
    .eq('platform', PLATFORM_FILTER)
    .eq('active', true)
    .order('last_scanned_at', { ascending: true, nullsFirst: true })

  if (error) throw new Error(`competitor_channels query failed: ${error.message}`)

  const list = (competitors ?? []) as CompetitorRow[]
  if (list.length === 0) {
    return { competitors: 0, videos_seen: 0, videos_new: 0, signals: 0, errors: 0, duration_ms: Date.now() - start }
  }

  log.info(`Sweep start — ${list.length} competitors`, { platform: PLATFORM_FILTER })

  const stats: SweepStats = { competitors: list.length, videos_seen: 0, videos_new: 0, signals: 0, errors: 0, duration_ms: 0 }

  // Concurrency limiter — simple pool
  const pool: Promise<ScanResult>[] = []
  for (const c of list) {
    const p = scanCompetitor(c).catch((err): ScanResult => {
      log.error('Scan crashte', { name: c.name, error: (err as Error).message })
      return { competitor_id: c.id, videos_seen: 0, videos_new: 0, signals_emitted: 0, error: (err as Error).message }
    })
    pool.push(p)
    if (pool.length >= SCAN_CONCURRENCY) {
      const done = await Promise.race(pool.map((pp, i) => pp.then((r) => ({ r, i }))))
      pool.splice(done.i, 1)
      stats.videos_seen   += done.r.videos_seen
      stats.videos_new    += done.r.videos_new
      stats.signals       += done.r.signals_emitted
      if (done.r.error) stats.errors++
    }
  }
  // Drain
  const remaining = await Promise.all(pool)
  for (const r of remaining) {
    stats.videos_seen += r.videos_seen
    stats.videos_new  += r.videos_new
    stats.signals     += r.signals_emitted
    if (r.error) stats.errors++
  }

  stats.duration_ms = Date.now() - start
  return stats
}

async function loop() {
  const exists = await workerExists(WORKER_NAME)
  if (!exists) {
    log.warn(`Worker registry entry "${WORKER_NAME}" niet gevonden in media_holding_workers — proces draait wel door`)
  }

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const cfg = await getWorkerConfig(WORKER_NAME)
    const interval = Number(cfg.sweep_interval_min ?? DEFAULT_INTERVAL)

    await setWorkerStatus(WORKER_NAME, 'running')
    try {
      const stats = await sweep()
      log.info('Sweep klaar', stats)
      await setWorkerStatus(WORKER_NAME, 'idle', { queue_depth: stats.competitors, last_error: null })
    } catch (err) {
      const msg = (err as Error).message
      log.error('Sweep faalde', { error: msg })
      await setWorkerStatus(WORKER_NAME, 'error', { last_error: msg })
    }

    const sleepMs = Math.max(1, interval) * 60_000
    log.info(`Volgende sweep over ${interval}m`)
    await sleep(sleepMs)
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms))
}

async function gracefulShutdown(signal: string) {
  log.info(`Received ${signal} — shutting down`)
  await setWorkerStatus(WORKER_NAME, 'offline').catch(() => {})
  process.exit(0)
}

async function main() {
  logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  logger.info('  Orlando Core OS — Competitor Surveillance Scanner')
  logger.info(`  Worker: ${WORKER_NAME}  ·  Platform: ${PLATFORM_FILTER}`)
  logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
  process.on('SIGINT',  () => gracefulShutdown('SIGINT'))
  process.on('uncaughtException', (err) => {
    logger.error('Uncaught exception', { error: err.message, stack: err.stack })
  })
  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled rejection', { reason: String(reason) })
  })

  await loop()
}

main().catch(async (err) => {
  logger.error('Fatal startup error', { error: (err as Error).message })
  await setWorkerStatus(WORKER_NAME, 'error', { last_error: (err as Error).message }).catch(() => {})
  process.exit(1)
})
