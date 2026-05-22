import { PM2App, listPM2Apps, restartApp, stopApp, startApp, tailErrorLog, rebuildApp } from './pm2'
import { sendTelegram } from './telegram'
import { recordEvent, openIncident, resolveIncident, EventKind } from './supabase-state'

const RESTART_COOLDOWN_MS = parseInt(process.env.RESTART_COOLDOWN_MS ?? '90000', 10)
const REBUILD_COOLDOWN_MS = parseInt(process.env.REBUILD_COOLDOWN_MS ?? '600000', 10)
const CRASH_LOOP_WINDOW_MS = parseInt(process.env.CRASH_LOOP_WINDOW_MS ?? '300000', 10)
const CRASH_LOOP_THRESHOLD = parseInt(process.env.CRASH_LOOP_THRESHOLD ?? '3', 10)
const MAX_REBUILDS = parseInt(process.env.MAX_REBUILDS ?? '2', 10)

interface AppState {
  lastSeenRestartCount: number
  restartTimestamps: number[]
  lastWatchdogRestartAt: number
  lastRebuildAt: number
  rebuildAttempts: number
  escalated: boolean
  lastStatus: string | null
  incidentKey: string | null
}

const stateByApp = new Map<string, AppState>()

function getState(name: string): AppState {
  let s = stateByApp.get(name)
  if (!s) {
    s = {
      lastSeenRestartCount: 0,
      restartTimestamps: [],
      lastWatchdogRestartAt: 0,
      lastRebuildAt: 0,
      rebuildAttempts: 0,
      escalated: false,
      lastStatus: null,
      incidentKey: null
    }
    stateByApp.set(name, s)
  }
  return s
}

export interface CheckOptions {
  hostId: string
  selfAppName: string
  denyList: Set<string>
}

export async function checkLocalFleet(opts: CheckOptions): Promise<{ count: number; failing: string[] }> {
  let apps: PM2App[]
  try {
    apps = await listPM2Apps()
  } catch (err) {
    console.error('[local-watchdog] pm2 jlist failed:', err instanceof Error ? err.message : err)
    return { count: 0, failing: [] }
  }
  const failing: string[] = []
  let checked = 0
  for (const app of apps) {
    if (app.name === opts.selfAppName) continue
    if (opts.denyList.has(app.name)) continue
    checked++
    try {
      const failed = await checkApp(app, opts)
      if (failed) failing.push(app.name)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[local-watchdog] checkApp(${app.name}) error:`, msg)
      await recordEvent({
        host_id: opts.hostId,
        service_id: `pm2:${app.name}`,
        service_name: app.name,
        service_type: 'pm2',
        kind: 'check_error',
        message: msg
      })
    }
  }
  return { count: checked, failing }
}

async function checkApp(app: PM2App, opts: CheckOptions): Promise<boolean> {
  const state = getState(app.name)
  const status = app.pm2_env.status
  const restartCount = app.pm2_env.restart_time ?? 0

  // Track restart deltas
  if (state.lastSeenRestartCount !== restartCount) {
    if (restartCount > state.lastSeenRestartCount) {
      const delta = restartCount - state.lastSeenRestartCount
      const now = Date.now()
      for (let i = 0; i < delta; i++) state.restartTimestamps.push(now)
    }
    state.lastSeenRestartCount = restartCount
  }
  // Prune restart timestamps outside crash-loop window
  const cutoff = Date.now() - CRASH_LOOP_WINDOW_MS
  state.restartTimestamps = state.restartTimestamps.filter((t) => t > cutoff)

  const recoveryActive = state.escalated || state.rebuildAttempts > 0 || state.restartTimestamps.length >= CRASH_LOOP_THRESHOLD

  if (status === 'online') {
    if (state.lastStatus && state.lastStatus !== 'online' && recoveryActive) {
      await sendTelegram('info', `✅ ${app.name} recovered`, `Back online on ${opts.hostId} after ${state.rebuildAttempts} rebuild(s).`)
      await recordEvent({
        host_id: opts.hostId,
        service_id: `pm2:${app.name}`,
        service_name: app.name,
        service_type: 'pm2',
        kind: 'recovered',
        attempt: state.rebuildAttempts
      })
      if (state.incidentKey) await resolveIncident(opts.hostId, state.incidentKey)
      state.escalated = false
      state.rebuildAttempts = 0
      state.incidentKey = null
    }
    state.lastStatus = status

    // Detect crash-loop even if online (rapid restarts)
    if (state.restartTimestamps.length >= CRASH_LOOP_THRESHOLD && !state.escalated && state.rebuildAttempts < MAX_REBUILDS) {
      await handleCrashLoop(app, state, opts)
    }
    return state.escalated
  }

  // Not online
  state.lastStatus = status
  const isFailedStatus = status === 'stopped' || status === 'errored' || status === 'one-launch-status'
  if (!isFailedStatus) return false

  // Crash loop path
  if (state.restartTimestamps.length >= CRASH_LOOP_THRESHOLD) {
    if (!state.escalated && state.rebuildAttempts < MAX_REBUILDS) {
      await handleCrashLoop(app, state, opts)
      return true
    }
    if (!state.escalated) await escalate(app, state, opts, 'crash-loop persists after rebuilds')
    return true
  }

  // Simple restart path with cooldown
  if (Date.now() - state.lastWatchdogRestartAt < RESTART_COOLDOWN_MS) return true
  state.lastWatchdogRestartAt = Date.now()
  await fireEvent(app, opts, 'fail_detected', `status=${status} restart_count=${restartCount}`)
  await sendTelegram(
    'error',
    `🔴 ${app.name} on ${opts.hostId} is ${status}`,
    `Restart count=${restartCount}. Triggering pm2 restart.`
  )
  try {
    await restartApp(app.name)
    await fireEvent(app, opts, 'restart_triggered', null)
  } catch (err) {
    await fireEvent(app, opts, 'check_error', `restart failed: ${err instanceof Error ? err.message : err}`)
  }
  return true
}

async function handleCrashLoop(app: PM2App, state: AppState, opts: CheckOptions): Promise<void> {
  if (Date.now() - state.lastRebuildAt < REBUILD_COOLDOWN_MS) return
  state.lastRebuildAt = Date.now()
  state.rebuildAttempts += 1
  const attempt = state.rebuildAttempts

  await sendTelegram(
    'warning',
    `🔁 ${app.name} crash-loop on ${opts.hostId}`,
    `${state.restartTimestamps.length} restarts in ${Math.round(CRASH_LOOP_WINDOW_MS / 60000)} min. Rebuild attempt ${attempt}/${MAX_REBUILDS}.`
  )

  let logTail = ''
  try {
    logTail = await tailErrorLog(app, 80)
  } catch {
    /* ignore */
  }

  await fireEvent(app, opts, 'rebuild_triggered', `attempt ${attempt}`, logTail)

  try {
    await stopApp(app.name)
  } catch (err) {
    console.error('[local-watchdog] stop failed:', err)
  }
  const rb = await rebuildApp(app)
  if (rb.error) {
    await sendTelegram('error', `🔴 ${app.name} rebuild failed`, rb.log.slice(-1500))
  }
  try {
    await startApp(app.name)
  } catch (err) {
    await sendTelegram('error', `🔴 ${app.name} start failed after rebuild`, err instanceof Error ? err.message : String(err))
  }

  // Reset restart timestamps so we measure post-rebuild stability fresh
  state.restartTimestamps = []
  state.lastSeenRestartCount = 0

  if (attempt >= MAX_REBUILDS) {
    // Wait for next tick to confirm; if still fails -> escalate
    await escalate(app, state, opts, `Reached ${MAX_REBUILDS} rebuilds. ${rb.error ?? 'rebuild ran'}`, logTail)
  }
}

async function escalate(app: PM2App, state: AppState, opts: CheckOptions, reason: string, logTail = ''): Promise<void> {
  state.escalated = true
  const incidentKey = `${opts.hostId}:pm2:${app.name}:${Date.now()}`
  state.incidentKey = incidentKey
  const tail = logTail || (await tailErrorLog(app, 80).catch(() => ''))
  const proposed = [
    `SSH into ${opts.hostId} and run: pm2 logs ${app.name} --lines 200`,
    `If TS/build error: cd ${app.pm2_env.pm_cwd ?? '<cwd>'} && npm install && npm run build`,
    `Restart manually: pm2 restart ${app.name} --update-env`,
    `Clear watchdog escalation: delete row from infra_watchdog_incidents where host_id='${opts.hostId}' and deploy_id='${incidentKey}'`
  ]
  await openIncident({
    host_id: opts.hostId,
    service_id: `pm2:${app.name}`,
    service_name: app.name,
    service_type: 'pm2',
    incident_key: incidentKey,
    failure_kind: 'crash_loop',
    failure_summary: reason,
    logs_tail: tail.slice(-6000),
    attempts_made: state.rebuildAttempts,
    proposed_actions: proposed
  })
  await fireEvent(app, opts, 'escalated', reason)
  await sendTelegram(
    'critical',
    `🚨 ${app.name} needs human/Claude Code fix on ${opts.hostId}`,
    [
      `App: ${app.name} (${app.pm2_env.status})`,
      `Reason: ${reason}`,
      `Restart count: ${app.pm2_env.restart_time}`,
      `cwd: ${app.pm2_env.pm_cwd ?? '-'}`,
      '',
      'Tail:',
      tail.split('\n').slice(-12).join('\n')
    ].join('\n')
  )
}

async function fireEvent(
  app: PM2App,
  opts: CheckOptions,
  kind: EventKind,
  message: string | null,
  logsTail?: string
): Promise<void> {
  await recordEvent({
    host_id: opts.hostId,
    service_id: `pm2:${app.name}`,
    service_name: app.name,
    service_type: 'pm2',
    kind,
    message,
    logs_tail: logsTail ?? null,
    metadata: {
      status: app.pm2_env.status,
      restart_time: app.pm2_env.restart_time,
      unstable_restarts: app.pm2_env.unstable_restarts,
      pm_cwd: app.pm2_env.pm_cwd
    }
  })
}
