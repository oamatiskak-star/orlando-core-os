/**
 * Routines Runner — Mac mini PM2 service.
 *
 * Polled `routine_runs` voor `status='queued'` in een loop, claimed één per tick,
 * executes elke step volgens type, en update `routine_run_steps` + heartbeat.
 *
 * Step types ondersteund in v1:
 *   - action.http      → fetch met method/url/headers/body uit config; output = { status, body }
 *   - action.supabase  → execute RPC of insert/update via supabase-js
 *   - delay            → setTimeout(seconds)
 *   - condition.jsonpath → check vorige step.output tegen jsonpath; bij failure → on_failure_step_id
 *   - approval         → set run.status='awaiting_approval' en exit (user moet beslissen)
 *
 * Heartbeat: routine_runs.heartbeat_at update elke 30s tijdens execution.
 * Service-heartbeat: infra_watchdog_events insert elke 60s met service_id='local-agent-macmini'.
 */

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL              = process.env.SUPABASE_URL!
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const SERVICE_ID                = process.env.ROUTINES_SERVICE_ID  ?? 'local-agent-macmini'
const SERVICE_NAME              = process.env.ROUTINES_SERVICE_NAME ?? 'Routines Runner (Mac mini)'
const HOST_ID                   = process.env.WATCHDOG_HOST_ID      ?? 'cli-l'
const POLL_INTERVAL_MS          = parseInt(process.env.ROUTINES_POLL_INTERVAL_MS ?? '5000')
const SERVICE_HEARTBEAT_MS      = parseInt(process.env.ROUTINES_SERVICE_HEARTBEAT_MS ?? '60000')
const RUN_HEARTBEAT_MS          = parseInt(process.env.ROUTINES_RUN_HEARTBEAT_MS     ?? '30000')

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Routines runner: SUPABASE_URL en SUPABASE_SERVICE_ROLE_KEY zijn verplicht.')
  process.exit(1)
}

const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

function log(msg: string, ...args: unknown[]) {
  console.log(`[${new Date().toISOString()}] [routines] ${msg}`, ...args)
}

type RunRow = {
  id: string
  routine_id: string
  status: string
  trigger_kind: string
  trigger_payload: Record<string, unknown>
  started_at: string
}

type StepRow = {
  id: string
  order_idx: number
  type: 'action' | 'condition' | 'approval' | 'fallback' | 'delay'
  config: Record<string, unknown>
  on_failure_step_id: string | null
}

// ── Service heartbeat ────────────────────────────────────────────────────
async function serviceHeartbeat(): Promise<void> {
  await db.from('infra_watchdog_events').insert({
    service_id:    SERVICE_ID,
    service_name:  SERVICE_NAME,
    service_type:  'local-agent-routines-runner',
    host_id:       HOST_ID,
    kind:          'heartbeat',
    deploy_status: 'live',
    message:       `Routines runner alive @ ${new Date().toISOString()}`,
    metadata:      { poll_ms: POLL_INTERVAL_MS, version: '1.0.0' },
  })
}

// ── Claim 1 queued run (atomic) ──────────────────────────────────────────
async function claimNextRun(): Promise<RunRow | null> {
  const { data: candidates } = await db
    .from('routine_runs')
    .select('id')
    .eq('status', 'queued')
    .order('started_at', { ascending: true })
    .limit(5)

  if (!candidates?.length) return null

  for (const c of candidates) {
    const { data: claimed } = await db
      .from('routine_runs')
      .update({
        status:     'running',
        claimed_by: SERVICE_ID,
        claimed_at: new Date().toISOString(),
        heartbeat_at: new Date().toISOString(),
        service_id: SERVICE_ID,
      })
      .eq('id', c.id)
      .eq('status', 'queued')
      .select('id, routine_id, status, trigger_kind, trigger_payload, started_at')
      .maybeSingle()

    if (claimed) return claimed as RunRow
  }
  return null
}

// ── Step executor ────────────────────────────────────────────────────────
type StepResult = {
  ok: boolean
  output?: Record<string, unknown>
  error?: { message: string; detail?: unknown }
  awaitingApproval?: boolean
  goToStepId?: string
}

async function executeStep(step: StepRow, prevOutput: Record<string, unknown> | null): Promise<StepResult> {
  switch (step.type) {
    case 'action': {
      const cfg = step.config as { type?: string; url?: string; method?: string; headers?: Record<string, string>; body?: unknown }
      const subtype = String(cfg.type ?? 'http').toLowerCase()
      if (subtype === 'http') {
        if (!cfg.url) return { ok: false, error: { message: 'action.http vereist config.url' } }
        const res = await fetch(cfg.url, {
          method:  cfg.method ?? 'GET',
          headers: cfg.headers ?? { 'Content-Type': 'application/json' },
          body:    cfg.body !== undefined ? (typeof cfg.body === 'string' ? cfg.body : JSON.stringify(cfg.body)) : undefined,
        })
        const text = await res.text()
        let body: unknown = text
        try { body = JSON.parse(text) } catch { /* keep as string */ }
        return { ok: res.ok, output: { status: res.status, body }, error: res.ok ? undefined : { message: `HTTP ${res.status}` } }
      }
      if (subtype === 'supabase_rpc') {
        const fn   = String(cfg.method ?? '')
        const args = (cfg.body ?? {}) as Record<string, unknown>
        if (!fn) return { ok: false, error: { message: 'action.supabase_rpc vereist config.method' } }
        const { data, error } = await db.rpc(fn, args)
        if (error) return { ok: false, error: { message: error.message, detail: error.details } }
        return { ok: true, output: { data } }
      }
      return { ok: false, error: { message: `Onbekend action subtype: ${subtype}` } }
    }

    case 'delay': {
      const seconds = Number((step.config as { seconds?: number }).seconds ?? 1)
      await new Promise<void>(resolve => setTimeout(resolve, Math.max(0, seconds) * 1000))
      return { ok: true, output: { waited_seconds: seconds } }
    }

    case 'condition': {
      // Simpele jsonpath: config = { path: 'body.status', equals: 'ok' } op prevOutput
      const cfg = step.config as { path?: string; equals?: unknown; not_equals?: unknown }
      if (!cfg.path) return { ok: false, error: { message: 'condition vereist config.path' } }
      const value = (cfg.path).split('.').reduce<unknown>((acc, k) => {
        if (acc && typeof acc === 'object' && k in (acc as Record<string, unknown>)) {
          return (acc as Record<string, unknown>)[k]
        }
        return undefined
      }, prevOutput ?? {})

      const matchesEquals    = 'equals'     in cfg ? value === cfg.equals     : true
      const matchesNotEquals = 'not_equals' in cfg ? value !== cfg.not_equals : true
      const conditionMet     = matchesEquals && matchesNotEquals
      return {
        ok: conditionMet,
        output: { value, conditionMet },
        goToStepId: conditionMet ? undefined : step.on_failure_step_id ?? undefined,
      }
    }

    case 'approval': {
      // Approval-stap pauzeert de run en wacht op user-decision.
      return { ok: false, awaitingApproval: true, output: { requestedAt: new Date().toISOString() } }
    }

    case 'fallback': {
      // Fallback-stap zelf doet niets; on_failure_step_id van een voorgaande step
      // routeert hierheen. We loggen alleen dat we hier zijn.
      return { ok: true, output: { reached: true } }
    }

    default:
      return { ok: false, error: { message: `Onbekend step type: ${step.type}` } }
  }
}

// ── Run executor ─────────────────────────────────────────────────────────
async function executeRun(run: RunRow): Promise<void> {
  log(`Run ${run.id} (routine ${run.routine_id}) — trigger=${run.trigger_kind}`)

  const { data: stepsData } = await db
    .from('routine_steps')
    .select('id, order_idx, type, config, on_failure_step_id')
    .eq('routine_id', run.routine_id)
    .order('order_idx')

  const steps = (stepsData ?? []) as StepRow[]
  if (steps.length === 0) {
    await db.from('routine_runs').update({
      status:   'completed',
      ended_at: new Date().toISOString(),
      error:    null,
    }).eq('id', run.id)
    await db.from('routine_audit_log').insert({
      routine_id: run.routine_id, run_id: run.id, action: 'run.completed_empty', actor: 'system',
      detail: { reason: 'no_steps' },
    })
    return
  }

  // Heartbeat interval tijdens execution
  const hbTimer = setInterval(() => {
    db.from('routine_runs').update({ heartbeat_at: new Date().toISOString() }).eq('id', run.id)
      .then(({ error }) => { if (error) log(`Heartbeat update fout ${run.id}: ${error.message}`) })
  }, RUN_HEARTBEAT_MS)

  let prevOutput: Record<string, unknown> | null = null
  let totalCostCents = 0
  let nextStepId: string | null = steps[0].id
  let stepsExecuted = 0
  const stepsById = new Map(steps.map(s => [s.id, s]))

  try {
    while (nextStepId) {
      const step = stepsById.get(nextStepId)
      if (!step) {
        throw new Error(`Onbekende step id in flow: ${nextStepId}`)
      }

      const { data: rrs } = await db.from('routine_run_steps').insert({
        run_id:  run.id,
        step_id: step.id,
        status:  'started',
      }).select('id').single()
      const runStepId = rrs?.id

      const t0 = Date.now()
      let result: StepResult
      try {
        result = await executeStep(step, prevOutput)
      } catch (e) {
        const err = e as Error
        result = { ok: false, error: { message: err.message } }
      }
      const durationMs = Date.now() - t0

      await db.from('routine_run_steps').update({
        ended_at: new Date().toISOString(),
        status:   result.ok ? 'completed' : result.awaitingApproval ? 'started' : 'failed',
        output:   result.output ?? null,
        error:    result.error ?? null,
      }).eq('id', runStepId)

      totalCostCents += Math.max(0, Math.floor(durationMs / 100)) // ~1 cent per 100ms (placeholder)

      if (result.awaitingApproval) {
        await db.from('routine_runs').update({
          status: 'awaiting_approval',
        }).eq('id', run.id)
        await db.from('routine_approvals').insert({
          run_id:  run.id,
          step_id: step.id,
        })
        await db.from('routine_audit_log').insert({
          routine_id: run.routine_id, run_id: run.id, action: 'run.awaiting_approval', actor: 'system',
          detail: { step_id: step.id, step_type: step.type },
        })
        return
      }

      if (!result.ok) {
        if (result.goToStepId && stepsById.has(result.goToStepId)) {
          // condition false → routeer naar fallback
          nextStepId = result.goToStepId
          prevOutput = result.output ?? prevOutput
          stepsExecuted++
          continue
        }
        if (step.on_failure_step_id && stepsById.has(step.on_failure_step_id)) {
          nextStepId = step.on_failure_step_id
          prevOutput = result.output ?? prevOutput
          stepsExecuted++
          continue
        }
        // geen fallback → run faalt
        throw new Error(result.error?.message ?? 'Step faalde zonder fallback')
      }

      prevOutput = result.output ?? null
      stepsExecuted++

      // Volgende step in order_idx
      const currentIdx = step.order_idx
      const nextStep = steps.find(s => s.order_idx > currentIdx)
      nextStepId = nextStep?.id ?? null
    }

    await db.from('routine_runs').update({
      status:     'completed',
      ended_at:   new Date().toISOString(),
      cost_cents: totalCostCents,
      error:      null,
    }).eq('id', run.id)
    await db.from('routine_audit_log').insert({
      routine_id: run.routine_id, run_id: run.id, action: 'run.completed', actor: 'system',
      detail: { steps_executed: stepsExecuted, cost_cents: totalCostCents },
    })
    log(`Run ${run.id} ✓ completed (${stepsExecuted} steps, ${totalCostCents}¢)`)

  } catch (e) {
    const err = e as Error
    await db.from('routine_runs').update({
      status:     'failed',
      ended_at:   new Date().toISOString(),
      cost_cents: totalCostCents,
      error:      { message: err.message, stack: err.stack ?? null },
    }).eq('id', run.id)
    await db.from('routine_audit_log').insert({
      routine_id: run.routine_id, run_id: run.id, action: 'run.failed', actor: 'system',
      detail: { error: err.message, steps_executed: stepsExecuted },
    })
    log(`Run ${run.id} ✗ FAILED: ${err.message}`)

  } finally {
    clearInterval(hbTimer)
  }
}

// ── Main loop ────────────────────────────────────────────────────────────
async function main() {
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  log(`  Routines Runner — ${SERVICE_ID}`)
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  log(`Poll: ${POLL_INTERVAL_MS}ms · Service HB: ${SERVICE_HEARTBEAT_MS}ms · Run HB: ${RUN_HEARTBEAT_MS}ms`)

  // Eerste heartbeat
  await serviceHeartbeat().catch(e => log('Initial heartbeat fout:', (e as Error).message))

  // Heartbeat interval
  setInterval(() => {
    serviceHeartbeat().catch(e => log('Heartbeat fout:', (e as Error).message))
  }, SERVICE_HEARTBEAT_MS)

  // Poll loop
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      const run = await claimNextRun()
      if (run) {
        await executeRun(run)
      }
    } catch (err) {
      log('Poll fout:', (err as Error).message)
    }
    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS))
  }
}

main().catch(err => {
  console.error('Fatal in routines runner:', err)
  process.exit(1)
})
