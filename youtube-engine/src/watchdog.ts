import 'dotenv/config'
import cron from 'node-cron'
import { exec } from 'child_process'
import { promisify } from 'util'
import { getSupabase, updateQueueStatus } from './lib/supabase'
import { sendTelegram } from './lib/notifications'
import { getRedis, enqueueUpload, QUEUE_NAMES } from './lib/redis-queue'
import { Queue } from 'bullmq'
import { logger } from './lib/logger'

const execAsync = promisify(exec)
const log = (logger as any).child?.({ module: 'watchdog' }) ?? logger

// Critical PM2 processes that must always be online
const CRITICAL_PROCESSES = ['youtube-engine', 'video-worker-1', 'video-worker-2', 'content-factory', 'local-agent']

// Alert dedup: maps queueId → timestamp when alert was last sent
const alertedStuck = new Map<string, number>()
const alertedProcesses = new Map<string, number>()
const ALERT_COOLDOWN_MS = 60 * 60 * 1000 // 1 hour

// ─── Process health ───────────────────────────────────────────────────────────

interface PM2Process {
  name: string
  status: string
  restarts: number
  pm_uptime: number
  pid: number
}

async function getPm2Processes(): Promise<PM2Process[]> {
  try {
    const { stdout } = await execAsync('pm2 jlist --silent 2>/dev/null || pm2 jlist')
    const list = JSON.parse(stdout) as Array<Record<string, unknown>>
    return list.map(p => ({
      name: String(p.name ?? ''),
      status: String((p.pm2_env as any)?.status ?? p.status ?? 'unknown'),
      restarts: Number((p.pm2_env as any)?.restart_time ?? 0),
      pm_uptime: Number((p.pm2_env as any)?.pm_uptime ?? 0),
      pid: Number(p.pid ?? 0),
    }))
  } catch {
    return []
  }
}

async function checkProcessHealth(): Promise<void> {
  const processes = await getPm2Processes()
  if (processes.length === 0) {
    log.warn('Watchdog: unable to read PM2 process list')
    return
  }

  const processMap = new Map(processes.map(p => [p.name, p]))

  for (const name of CRITICAL_PROCESSES) {
    const proc = processMap.get(name)
    const now = Date.now()
    const lastAlert = alertedProcesses.get(name) ?? 0

    if (!proc) {
      if (now - lastAlert > ALERT_COOLDOWN_MS) {
        alertedProcesses.set(name, now)
        await sendTelegram(
          `🚨 <b>WATCHDOG — Proces ontbreekt</b>\n\n` +
          `⚙️ <b>${name}</b> staat niet in PM2\n` +
          `🔧 Start handmatig: <code>pm2 start ecosystem.config.js</code>`
        )
        log.error(`Watchdog: process "${name}" not found in PM2`)
      }
      continue
    }

    if (proc.status !== 'online' && proc.status !== 'launching') {
      if (now - lastAlert > ALERT_COOLDOWN_MS) {
        alertedProcesses.set(name, now)
        log.error(`Watchdog: process "${name}" is ${proc.status} — restarting`)

        let restarted = false
        try {
          await execAsync(`pm2 restart "${name}"`)
          restarted = true
        } catch (e) {
          log.error(`Watchdog: failed to restart "${name}"`, { error: (e as Error).message })
        }

        await sendTelegram(
          `🚨 <b>WATCHDOG — Proces Down</b>\n\n` +
          `⚙️ <b>${name}</b>\n` +
          `📊 Status: ${proc.status}\n` +
          `🔄 Herstarts: ${proc.restarts}\n` +
          `🔧 Auto-restart: ${restarted ? '✅ Uitgevoerd' : '❌ Mislukt — handmatig vereist'}`
        )
      }
    }
  }

  // Warn if youtube-engine has >3 restarts in current session
  const yt = processMap.get('youtube-engine')
  if (yt && yt.restarts > 3) {
    const lastAlert = alertedProcesses.get('youtube-engine-restarts') ?? 0
    const now = Date.now()
    if (now - lastAlert > ALERT_COOLDOWN_MS * 2) {
      alertedProcesses.set('youtube-engine-restarts', now)
      await sendTelegram(
        `⚠️ <b>WATCHDOG — Instabiele Engine</b>\n\n` +
        `⚙️ youtube-engine heeft ${yt.restarts} herstarts\n` +
        `📋 Check error logs: <code>tail /tmp/pm2-youtube-engine-err.log</code>`
      )
    }
  }
}

// ─── Stuck upload detection & auto-fix ───────────────────────────────────────

async function checkStuckUploads(): Promise<void> {
  const db = getSupabase()
  const now = Date.now()

  // Stuck in active states >30 min
  const threshold30m = new Date(now - 30 * 60 * 1000).toISOString()
  const threshold2h  = new Date(now - 2 * 60 * 60 * 1000).toISOString()

  const { data: stuck } = await db
    .from('youtube_upload_queue')
    .select('id, video_id, channel_id, status, retry_count, max_retries, last_error, updated_at, youtube_videos(title), youtube_channels(naam)')
    .in('status', ['uploading', 'preparing', 'normalizing', 'uploaded_pending_processing', 'processing'])
    .lt('updated_at', threshold30m)
    .order('updated_at', { ascending: true })
    .limit(20)

  if (!stuck || stuck.length === 0) return

  for (const item of stuck) {
    const videoTitle  = (item.youtube_videos as any)?.title  ?? item.video_id
    const channelName = (item.youtube_channels as any)?.naam ?? item.channel_id
    const lastAlert   = alertedStuck.get(item.id) ?? 0
    const stuckSince  = new Date(item.updated_at).getTime()
    const stuckMs     = now - stuckSince
    const stuckMin    = Math.round(stuckMs / 60000)

    const isExhausted = (item.retry_count ?? 0) >= (item.max_retries ?? 5)
    const isCritical  = stuckMs > 2 * 60 * 60 * 1000

    // Skip if already alerted recently
    if (now - lastAlert < ALERT_COOLDOWN_MS) continue

    alertedStuck.set(item.id, now)

    if (isCritical || isExhausted) {
      // Escalate to manual review
      await updateQueueStatus(item.id, 'manual_review_required', {
        last_error: `Watchdog: stuck ${stuckMin}min in status "${item.status}"`,
      })
      await sendTelegram(
        `🆘 <b>WATCHDOG — Upload Kritiek Vastgelopen</b>\n\n` +
        `📹 ${videoTitle}\n` +
        `📺 ${channelName}\n` +
        `⏱️ Vastgelopen: ${stuckMin} min (status: ${item.status})\n` +
        `🔄 Retries: ${item.retry_count}/${item.max_retries}\n` +
        `⚠️ Handmatige review vereist`
      )
      log.error('Watchdog: upload escalated to manual review', { queueId: item.id, stuckMin })
    } else {
      // Auto-retry
      const newRetryCount = (item.retry_count ?? 0) + 1
      await updateQueueStatus(item.id, 'retrying', {
        retry_count: newRetryCount,
        last_error: `Watchdog: stuck ${stuckMin}min — auto-retry ${newRetryCount}`,
      })
      await enqueueUpload({
        queueId:   item.id,
        videoId:   item.video_id,
        channelId: item.channel_id,
        priority:  10,
      })
      await sendTelegram(
        `⚠️ <b>WATCHDOG — Stuck Upload Auto-Hersteld</b>\n\n` +
        `📹 ${videoTitle}\n` +
        `📺 ${channelName}\n` +
        `⏱️ Vastgelopen: ${stuckMin} min (status: ${item.status})\n` +
        `🔧 Auto-retry ${newRetryCount}/${item.max_retries} verzonden`
      )
      log.warn('Watchdog: stuck upload auto-retried', { queueId: item.id, stuckMin, newRetryCount })
    }
  }
}

// ─── Manual review queue monitor ─────────────────────────────────────────────

let lastManualReviewAlert = 0

async function checkManualReviewQueue(): Promise<void> {
  const db = getSupabase()
  const now = Date.now()

  if (now - lastManualReviewAlert < 4 * 60 * 60 * 1000) return // max 1x per 4 uur

  const { count } = await db
    .from('youtube_upload_queue')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'manual_review_required')

  if (!count || count === 0) return

  lastManualReviewAlert = now
  await sendTelegram(
    `📋 <b>WATCHDOG — ${count} item(s) wachten op review</b>\n\n` +
    `Status: manual_review_required\n` +
    `🔗 Controleer het dashboard`
  )
}

// ─── Queue depth monitor ──────────────────────────────────────────────────────

let lastQueueAlert = 0

async function checkQueueDepths(): Promise<void> {
  const now = Date.now()
  if (now - lastQueueAlert < 30 * 60 * 1000) return // max 1x per 30 min

  try {
    const redis = getRedis()
    const uploadQueue = new Queue(QUEUE_NAMES.UPLOAD,    { connection: redis })
    const normalizeQ  = new Queue(QUEUE_NAMES.NORMALIZE, { connection: redis })
    const recoverQ    = new Queue(QUEUE_NAMES.RECOVER,   { connection: redis })

    const [uploadWaiting, normalizeWaiting, recoverWaiting, uploadFailed, normalizeFailed] = await Promise.all([
      uploadQueue.getWaitingCount(),
      normalizeQ.getWaitingCount(),
      recoverQ.getWaitingCount(),
      uploadQueue.getFailedCount(),
      normalizeQ.getFailedCount(),
    ])

    await uploadQueue.close()
    await normalizeQ.close()
    await recoverQ.close()

    const issues: string[] = []
    if (uploadWaiting    > 15) issues.push(`📤 Upload queue: ${uploadWaiting} wachtend`)
    if (normalizeWaiting > 10) issues.push(`🎬 Normalize queue: ${normalizeWaiting} wachtend`)
    if (recoverWaiting   > 5)  issues.push(`🔁 Recovery queue: ${recoverWaiting} wachtend`)
    if (uploadFailed     > 5)  issues.push(`❌ Upload mislukt: ${uploadFailed}`)
    if (normalizeFailed  > 5)  issues.push(`❌ Normalize mislukt: ${normalizeFailed}`)

    if (issues.length > 0) {
      lastQueueAlert = now
      await sendTelegram(
        `⚠️ <b>WATCHDOG — Queue Backlog Gedetecteerd</b>\n\n` +
        issues.join('\n')
      )
      log.warn('Watchdog: queue backlog', { uploadWaiting, normalizeWaiting, recoverWaiting })
    }
  } catch (err) {
    log.warn('Watchdog: queue depth check failed', { error: (err as Error).message })
  }
}

// ─── OAuth token monitor ─────────────────────────────────────────────────────

let lastOAuthAlert = 0

async function checkOAuthTokens(): Promise<void> {
  const now = Date.now()
  if (now - lastOAuthAlert < 6 * 60 * 60 * 1000) return // max 1x per 6 uur

  const db = getSupabase()
  const { data: channels } = await db
    .from('youtube_channels')
    .select('id, naam, oauth_status, status, refresh_token, token_expires')
    .order('naam')

  if (!channels?.length) return

  const missing: string[] = []
  const expired: string[] = []

  for (const ch of channels) {
    if (!ch.refresh_token) {
      missing.push(ch.naam)
    } else if (ch.oauth_status === 'expired' && ch.status === 'disconnected') {
      // Only flag if token_expires is more than 2 hours old (access token not refreshed)
      const expiry = ch.token_expires ? new Date(ch.token_expires).getTime() : 0
      if (now - expiry > 2 * 60 * 60 * 1000) {
        expired.push(ch.naam)
      }
    }
  }

  if (missing.length > 0) {
    lastOAuthAlert = now
    await sendTelegram(
      `🔐 <b>WATCHDOG — OAuth Refresh Token Ontbreekt</b>\n\n` +
      `❌ Kanalen zonder refresh token:\n` +
      missing.map(n => `  • ${n}`).join('\n') + '\n\n' +
      `⚠️ Uploads voor deze kanalen zullen falen — opnieuw authenticeren vereist`
    )
    log.error('Watchdog: channels missing refresh token', { channels: missing })
  }

  if (expired.length > 0) {
    lastOAuthAlert = now
    await sendTelegram(
      `⚠️ <b>WATCHDOG — OAuth Token Verlopen (>2u)</b>\n\n` +
      `Kanalen: ${expired.join(', ')}\n` +
      `📋 Access token is niet ververst — check of uploads nog lukken\n` +
      `🔧 Als uploads falen: herverbind via het dashboard`
    )
    log.warn('Watchdog: channels with stale expired tokens', { channels: expired })
  }
}

// ─── Daily summary ────────────────────────────────────────────────────────────

async function sendDailySummary(): Promise<void> {
  const db = getSupabase()
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const [
    { count: uploaded },
    { count: failed },
    { count: manual },
    { count: live },
  ] = await Promise.all([
    db.from('youtube_upload_queue').select('id', { count: 'exact', head: true })
      .eq('status', 'verified_live').gte('updated_at', since),
    db.from('youtube_upload_queue').select('id', { count: 'exact', head: true })
      .eq('status', 'failed').gte('updated_at', since),
    db.from('youtube_upload_queue').select('id', { count: 'exact', head: true })
      .eq('status', 'manual_review_required'),
    db.from('youtube_upload_queue').select('id', { count: 'exact', head: true })
      .eq('status', 'queued'),
  ])

  await sendTelegram(
    `📊 <b>YouTube Engine — Dagrapport</b>\n\n` +
    `✅ Succesvol live: ${uploaded ?? 0}\n` +
    `❌ Mislukt: ${failed ?? 0}\n` +
    `📋 Wacht op review: ${manual ?? 0}\n` +
    `📅 In wachtrij: ${live ?? 0}\n\n` +
    `🕐 Gegenereerd: ${new Date().toLocaleString('nl-NL')}`
  )
}

// ─── Watchdog main ────────────────────────────────────────────────────────────

async function runChecks(): Promise<void> {
  await Promise.allSettled([
    checkProcessHealth(),
    checkStuckUploads(),
    checkManualReviewQueue(),
    checkQueueDepths(),
    checkOAuthTokens(),
  ])
}

async function main(): Promise<void> {
  log.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  log.info('  Orlando YouTube Watchdog v1.0 — start')
  log.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  const redis = getRedis()
  await redis.connect()
  log.info('Watchdog: Redis connected')

  // Initial check on boot
  await runChecks()

  // Every 5 minutes: full check cycle
  cron.schedule('*/5 * * * *', async () => {
    try { await runChecks() } catch (e) {
      log.error('Watchdog: check cycle error', { error: (e as Error).message })
    }
  })

  // Daily 08:00 summary
  cron.schedule('0 8 * * *', async () => {
    try { await sendDailySummary() } catch (e) {
      log.error('Watchdog: daily summary error', { error: (e as Error).message })
    }
  })

  log.info('Watchdog: crons registered — monitoring every 5 min')

  await sendTelegram(
    `🛡️ <b>YouTube Watchdog Online</b>\n\n` +
    `✅ 24/7 monitoring actief\n` +
    `⏱️ Check interval: elke 5 minuten\n` +
    `📋 Bewaakt: uploads, processen, queues\n` +
    `🔧 Auto-fix: vastgelopen uploads en crashes`
  )

  process.on('SIGTERM', async () => {
    log.info('Watchdog SIGTERM — shutdown')
    await redis.quit()
    process.exit(0)
  })
  process.on('SIGINT', async () => {
    log.info('Watchdog SIGINT — shutdown')
    await redis.quit()
    process.exit(0)
  })

  process.on('uncaughtException', (err) => {
    log.error('Watchdog uncaught exception', { error: err.message, stack: err.stack })
  })
  process.on('unhandledRejection', (reason) => {
    log.error('Watchdog unhandled rejection', { reason: String(reason) })
  })
}

main().catch(err => {
  console.error('Watchdog fatal startup error:', err)
  process.exit(1)
})
