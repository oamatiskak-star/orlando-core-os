/**
 * CLI-R Orchestrator Bridge
 * Heartbeat naar orchestrator_workers + poll orchestrator_tasks voor executor/cli-r taken.
 */
import { createClient } from '@supabase/supabase-js'
import os from 'os'

const WORKER_ID    = 'cli-r'
const POLL_MS      = 5_000
const HEARTBEAT_MS = 15_000

const db = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

let currentTaskId: string | null = null

// ── Heartbeat ─────────────────────────────────────────────────────────────────

async function heartbeat() {
  const cpuAvg  = os.loadavg()[0]
  const ramMb   = Math.round((os.totalmem() - os.freemem()) / 1024 / 1024)

  await db.from('orchestrator_workers').upsert({
    worker_id:       WORKER_ID,
    hostname:        os.hostname(),
    status:          currentTaskId ? 'busy' : 'idle',
    current_task_id: currentTaskId,
    cpu_pct:         Math.round(cpuAvg * 10) / 10,
    ram_mb:          ramMb,
    last_seen:       new Date().toISOString(),
    meta: {
      platform:   'render',
      uptime:     Math.floor(process.uptime()),
      pid:        process.pid,
      node:       process.version,
      machine_id: process.env.MACHINE_ID ?? 'render-cli-r',
    },
  }, { onConflict: 'worker_id' })
}

// ── Log helper ────────────────────────────────────────────────────────────────

async function writeLog(taskId: string, level: 'info' | 'warn' | 'error', message: string) {
  await db.from('orchestrator_task_logs').insert({
    task_id: taskId,
    level,
    message: message.slice(0, 4000),
    payload: null,
  })
}

// ── Task executor (eenvoudig — Anthropic API) ─────────────────────────────────

async function executeTask(task: {
  id: string
  title: string
  task_type: string
  objective: { text?: string } | null
  payload: Record<string, unknown> | null
}): Promise<void> {
  await writeLog(task.id, 'info', `CLI-R: taak gestart (type=${task.task_type})`)

  try {
    const prompt = [
      task.title,
      task.objective?.text ? `\n\nDetails: ${task.objective.text}` : '',
      task.payload         ? `\n\nPayload: ${JSON.stringify(task.payload, null, 2)}` : '',
    ].join('').trim()

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY niet geconfigureerd op CLI-R')

    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
        'content-type':      'application/json',
      },
      body: JSON.stringify({
        model:      'claude-opus-4-7',
        max_tokens: 8192,
        messages:   [{ role: 'user', content: prompt }],
      }),
    })

    if (!resp.ok) throw new Error(`Anthropic API error: ${resp.status}`)
    const data = await resp.json() as { content: Array<{ text: string }> }
    const summary = data.content[0]?.text?.trim() ?? 'Klaar (geen output)'

    await db.from('orchestrator_tasks').update({
      status:         'completed',
      result_summary: summary.slice(0, 8000),
      finished_at:    new Date().toISOString(),
      updated_at:     new Date().toISOString(),
    }).eq('id', task.id)

    await writeLog(task.id, 'info', `CLI-R: voltooid`)
  } catch (err) {
    const msg = (err as Error).message
    await db.from('orchestrator_tasks').update({
      status:      'failed',
      error:       msg,
      finished_at: new Date().toISOString(),
      updated_at:  new Date().toISOString(),
    }).eq('id', task.id)
    await writeLog(task.id, 'error', `CLI-R: mislukt — ${msg}`)
  } finally {
    currentTaskId = null
  }
}

// ── Claim & run ───────────────────────────────────────────────────────────────

async function claimAndRun() {
  if (currentTaskId) return

  const { data: tasks } = await db
    .from('orchestrator_tasks')
    .select('id,title,task_type,objective,payload')
    .in('worker_id', [WORKER_ID, 'executor'])
    .eq('status', 'open')
    .order('priority', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(1)

  if (!tasks || tasks.length === 0) return

  const task = tasks[0] as {
    id: string; title: string; task_type: string
    objective: { text?: string } | null
    payload: Record<string, unknown> | null
  }

  const { error: claimErr } = await db
    .from('orchestrator_tasks')
    .update({ status: 'running', started_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', task.id)
    .eq('status', 'open')

  if (claimErr) return

  currentTaskId = task.id
  console.log(`[CLI-R] Claimed task ${task.id}: ${task.title}`)
  await executeTask(task)
}

// ── Start (aanroepen vanuit index.ts) ─────────────────────────────────────────

export function startOrchestratorBridge() {
  console.log(`[CLI-R Bridge] Starting — worker_id=${WORKER_ID}`)
  heartbeat().catch(console.error)
  setInterval(() => heartbeat().catch(console.error), HEARTBEAT_MS)
  setInterval(() => claimAndRun().catch(console.error), POLL_MS)
  setTimeout(() => claimAndRun().catch(console.error), 2000)
}
