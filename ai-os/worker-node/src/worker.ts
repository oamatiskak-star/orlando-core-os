import pino from 'pino'
import { createClient } from '@supabase/supabase-js'
import { config } from './config.js'
import { getHandler, listKinds } from './handlers/index.js'

const log = pino({ level: process.env.LOG_LEVEL ?? 'info' })

const supabase = createClient(config.supabase.url, config.supabase.serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

interface ClaimedTask {
  id: string
  kind: string
  payload: Record<string, unknown>
  retry_count: number
  max_retries: number
}

async function heartbeat(): Promise<void> {
  await supabase
    .from('ai_nodes')
    .upsert(
      {
        id: config.nodeId,
        hostname: config.hostname,
        role: config.role,
        capabilities: config.kinds.length ? config.kinds : listKinds(),
        status: 'online',
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: 'id' },
    )
    .then(() => {}, () => {})
}

async function claim(): Promise<ClaimedTask | null> {
  const { data, error } = await supabase.rpc('ai_tasks_claim', {
    p_node_id: config.nodeId,
    p_kinds: config.kinds.length ? config.kinds : null,
    p_lease_seconds: config.leaseSeconds,
  })
  if (error) {
    log.error({ err: error }, 'claim_failed')
    return null
  }
  const row = Array.isArray(data) ? data[0] : data
  return row ?? null
}

async function completeOk(id: string, result: Record<string, unknown>): Promise<void> {
  await supabase
    .from('ai_tasks')
    .update({
      status: 'completed',
      result,
      completed_at: new Date().toISOString(),
      claim_expires_at: null,
    })
    .eq('id', id)
}

async function completeFail(task: ClaimedTask, err: string): Promise<void> {
  const willRetry = task.retry_count < task.max_retries
  if (willRetry) {
    await supabase
      .from('ai_tasks')
      .update({
        status: 'queued',
        retry_count: task.retry_count + 1,
        claimed_by: null,
        claim_expires_at: null,
        visible_at: new Date(Date.now() + Math.min(30 * (task.retry_count + 1), 300) * 1000).toISOString(),
        error: err,
      })
      .eq('id', task.id)
  } else {
    await supabase
      .from('ai_tasks')
      .update({
        status: 'failed',
        error: err,
        completed_at: new Date().toISOString(),
        claim_expires_at: null,
      })
      .eq('id', task.id)
  }
}

async function runOne(): Promise<boolean> {
  const task = await claim()
  if (!task) return false
  const handler = getHandler(task.kind)
  if (!handler) {
    await completeFail(task, `no handler for kind=${task.kind}`)
    return true
  }
  log.info({ id: task.id, kind: task.kind }, 'task_start')
  const t0 = Date.now()
  try {
    const result = await handler(task.payload ?? {})
    await completeOk(task.id, { ...result, _durationMs: Date.now() - t0 })
    log.info({ id: task.id, ms: Date.now() - t0 }, 'task_done')
  } catch (e: unknown) {
    await completeFail(task, (e as Error).message)
    log.error({ id: task.id, err: e }, 'task_fail')
  }
  return true
}

let stopping = false
async function workerLoop(idx: number): Promise<void> {
  log.info({ idx, kinds: config.kinds.length ? config.kinds : '*' }, 'loop_started')
  while (!stopping) {
    try {
      const did = await runOne()
      if (!did) await new Promise(r => setTimeout(r, config.pollIntervalMs))
    } catch (e) {
      log.error({ err: e }, 'loop_iteration_error')
      await new Promise(r => setTimeout(r, 1000))
    }
  }
  log.info({ idx }, 'loop_stopped')
}

async function bootstrap(): Promise<void> {
  log.info({ nodeId: config.nodeId, concurrency: config.concurrency }, 'worker bootstrap')
  await heartbeat()
  setInterval(() => {
    heartbeat().catch(() => {})
  }, config.heartbeatMs)

  const loops = Array.from({ length: config.concurrency }, (_, i) => workerLoop(i))
  await Promise.all(loops)
}

process.on('SIGINT', () => {
  log.info('SIGINT received — stopping')
  stopping = true
  setTimeout(() => process.exit(0), 5000)
})
process.on('SIGTERM', () => {
  log.info('SIGTERM received — stopping')
  stopping = true
  setTimeout(() => process.exit(0), 5000)
})

bootstrap().catch(err => {
  log.fatal({ err }, 'bootstrap_failed')
  process.exit(1)
})
