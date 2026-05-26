// worker-commander.ts
// Consumeert de command-laag van worker_registry (migratie 098) en voert de
// echte PM2 actie uit op dít host. Het dashboard (Worker Control Center) zet
// desired_state / restart_requested_at; dit module brengt PM2 in lijn en
// schrijft het resultaat terug.
//
// Veilig per host: we acteren alleen op een worker als de bijbehorende PM2 app
// daadwerkelijk op deze machine in `pm2 jlist` staat. Workers van een andere
// host (of host='render') worden overgeslagen.

import { listPM2Apps, restartApp, stopApp, startApp, type PM2App } from './pm2'
import { getClient } from './supabase-state'

interface WorkerRow {
  id: string
  display_name: string | null
  host: string | null
  pm2_name: string | null
  controllable: boolean | null
  desired_state: string | null
  status: string | null
  restart_requested_at: string | null
  metadata: Record<string, unknown> | null
}

export interface CommanderResult {
  acted: string[]
  skipped: number
  errors: string[]
}

function pm2NameFor(w: WorkerRow): string | null {
  const meta = (w.metadata ?? {}) as { pm2_name?: string }
  return w.pm2_name || meta.pm2_name || w.display_name || w.id || null
}

/**
 * PM2 app-namen van workers die Orlando bewust heeft uitgezet
 * (controllable + desired_state='stopped'). De recovery self-healer moet deze
 * met rust laten — anders vecht hij de "uit"-stand uit het dashboard terug.
 */
export async function getDeliberatelyStoppedPm2Names(): Promise<Set<string>> {
  const out = new Set<string>()
  const c = getClient()
  if (!c) return out
  const { data, error } = await c
    .from('worker_registry')
    .select('id, display_name, host, pm2_name, controllable, desired_state, status, restart_requested_at, metadata')
    .eq('controllable', true)
    .eq('desired_state', 'stopped')
  if (error) {
    console.error('[worker-commander] stopped-set query error:', error.message)
    return out
  }
  for (const w of (data ?? []) as WorkerRow[]) {
    // Een lopende herstart-aanvraag heeft voorrang: dan niet overslaan.
    if (w.restart_requested_at) continue
    const name = pm2NameFor(w)
    if (name) out.add(name)
  }
  return out
}

async function writeBack(
  id: string,
  fields: { status?: string; result: string; clearRestart?: boolean }
): Promise<void> {
  const c = getClient()
  if (!c) return
  const patch: Record<string, unknown> = {
    last_command_result: fields.result,
    last_heartbeat: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
  if (fields.status) patch.status = fields.status
  if (fields.clearRestart) patch.restart_requested_at = null
  const { error } = await c.from('worker_registry').update(patch).eq('id', id)
  if (error) console.error('[worker-commander] write-back error:', error.message)
}

/** Eén reconciliatie-ronde. Brengt PM2 in lijn met worker_registry. */
export async function reconcileWorkerCommands(): Promise<CommanderResult> {
  const result: CommanderResult = { acted: [], skipped: 0, errors: [] }
  const c = getClient()
  if (!c) return result

  const { data, error } = await c
    .from('worker_registry')
    .select('id, display_name, host, pm2_name, controllable, desired_state, status, restart_requested_at, metadata')
    .eq('controllable', true)
  if (error) {
    result.errors.push(error.message)
    return result
  }

  const workers = (data ?? []) as WorkerRow[]
  if (workers.length === 0) return result

  let apps: PM2App[]
  try {
    apps = await listPM2Apps()
  } catch (err) {
    result.errors.push(`pm2 jlist: ${err instanceof Error ? err.message : String(err)}`)
    return result
  }
  const appByName = new Map(apps.map((a) => [a.name, a]))

  for (const w of workers) {
    const name = pm2NameFor(w)
    if (!name) { result.skipped++; continue }
    const app = appByName.get(name)
    if (!app) { result.skipped++; continue } // niet op dit host → andere watchdog acteert

    const online = app.pm2_env.status === 'online' || app.pm2_env.status === 'launching'

    try {
      // 1) Expliciete herstart heeft voorrang.
      if (w.restart_requested_at) {
        await restartApp(name)
        await writeBack(w.id, { status: 'online', result: `pm2 restart ${name} ✓`, clearRestart: true })
        result.acted.push(`restart:${name}`)
        continue
      }
      // 2) Gewenst gestopt, maar draait nog → stoppen.
      if (w.desired_state === 'stopped' && online) {
        await stopApp(name)
        await writeBack(w.id, { status: 'offline', result: `pm2 stop ${name} ✓` })
        result.acted.push(`stop:${name}`)
        continue
      }
      // 3) Gewenst draaiend, maar staat stil → starten.
      if (w.desired_state === 'running' && !online) {
        await startApp(name)
        await writeBack(w.id, { status: 'online', result: `pm2 start ${name} ✓` })
        result.acted.push(`start:${name}`)
        continue
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      result.errors.push(`${name}: ${msg}`)
      await writeBack(w.id, { result: `FOUT: ${msg.slice(0, 200)}`, clearRestart: !!w.restart_requested_at })
    }
  }

  return result
}
