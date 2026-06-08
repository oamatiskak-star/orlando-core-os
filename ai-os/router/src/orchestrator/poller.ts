import { config } from '../config.js'
import { logRouter } from '../db.js'
import { hermesDb, type RoutingRequestRow } from './shared.js'
import { runPlan } from './orchestrator.js'

const POLL_MS = 5_000
let running = false

/**
 * Claims one queued routing_request at a time (incidents first) via the
 * hermes.routing_claim RPC and runs the pipeline. Idempotent guard prevents
 * overlapping ticks. Started from server.ts startupTasks().
 */
async function tick(): Promise<void> {
  if (running) return
  running = true
  try {
    const { data, error } = await hermesDb().rpc('routing_claim', {
      p_host: config.nodeId,
      p_limit: 1,
    })
    if (error) {
      // Table/RPC missing (migration not applied) → stay quiet, retry next tick.
      return
    }
    const rows = (data ?? []) as RoutingRequestRow[]
    for (const row of rows) {
      try {
        await runPlan(row)
      } catch (e) {
        await logRouter('error', 'routing_tick_failed', { request_id: row.id, error: (e as Error).message })
      }
    }
  } catch {
    /* transient — next tick retries */
  } finally {
    running = false
  }
}

let timer: ReturnType<typeof setInterval> | null = null

export function startOrchestratorPoller(): void {
  if (timer) return
  timer = setInterval(() => {
    void tick()
  }, POLL_MS)
  void logRouter('info', 'hermes_orchestrator_poller_started', { host: config.nodeId, poll_ms: POLL_MS })
}
