/**
 * CLI-L Claude Bridge
 * Polls orchestrator_tasks for tasks with worker_id='cli-l',
 * executes them via the claude CLI, and streams logs back to Supabase.
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { spawn } from 'child_process';
import os from 'os';

const WORKER_ID = 'cli-l';
const POLL_MS = 5_000;
const HEARTBEAT_MS = 15_000;
const CLAUDE_BIN = process.env.CLAUDE_BIN ?? '/Users/bouwproffsnederlandbv/.local/bin/claude';

const db = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

let currentTaskId: string | null = null;

// ── Heartbeat ─────────────────────────────────────────────────────────────────

async function heartbeat() {
  const cpuAvg = os.loadavg()[0];
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const ramMb = Math.round((totalMem - freeMem) / 1024 / 1024);

  await db.from('orchestrator_workers').upsert({
    worker_id: WORKER_ID,
    hostname: os.hostname(),
    status: currentTaskId ? 'busy' : 'idle',
    current_task_id: currentTaskId,
    cpu_pct: Math.round(cpuAvg * 10) / 10,
    ram_mb: ramMb,
    last_seen: new Date().toISOString(),
    meta: { uptime: Math.floor(process.uptime()), pid: process.pid, node: process.version },
  }, { onConflict: 'worker_id' });
}

// ── Log writer ────────────────────────────────────────────────────────────────

async function writeLog(taskId: string, level: 'info' | 'warn' | 'error' | 'debug', message: string) {
  await db.from('orchestrator_task_logs').insert({
    task_id: taskId,
    level,
    message: message.slice(0, 4000),
    payload: null,
  });
}

// ── Task executor ─────────────────────────────────────────────────────────────

async function executeTask(task: {
  id: string;
  title: string;
  objective: { text?: string } | null;
  task_type: string;
  payload: Record<string, unknown> | null;
}): Promise<void> {
  const prompt = [
    task.title,
    task.objective?.text ? `\n\nDetails: ${task.objective.text}` : '',
    task.payload ? `\n\nPayload: ${JSON.stringify(task.payload, null, 2)}` : '',
  ].join('').trim();

  await writeLog(task.id, 'info', `Bridge: task gestart (type=${task.task_type})`);

  return new Promise((resolve) => {
    const proc = spawn(CLAUDE_BIN, ['--print', prompt], {
      cwd: process.env.ORLANDO_BASE ?? '/Users/bouwproffsnederlandbv/Github/orlando-core-os',
      env: { ...process.env, TERM: 'dumb' },
      timeout: 10 * 60 * 1000,
    });

    const outputChunks: string[] = [];

    proc.stdout.on('data', async (chunk: Buffer) => {
      const text = chunk.toString();
      outputChunks.push(text);
      // Write each line as a log entry
      const lines = text.split('\n').filter((l) => l.trim());
      for (const line of lines) {
        await writeLog(task.id, 'info', line);
      }
    });

    proc.stderr.on('data', async (chunk: Buffer) => {
      const text = chunk.toString().trim();
      if (text) await writeLog(task.id, 'warn', text);
    });

    proc.on('close', async (code) => {
      const summary = outputChunks.join('').trim().slice(0, 8000);
      if (code === 0) {
        await db.from('orchestrator_tasks').update({
          status: 'completed',
          result_summary: summary || 'Klaar',
          finished_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }).eq('id', task.id);
        await writeLog(task.id, 'info', `Bridge: voltooid (exit=${code})`);
      } else {
        await db.from('orchestrator_tasks').update({
          status: 'failed',
          error: `Exit code ${code}`,
          result_summary: summary || null,
          finished_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }).eq('id', task.id);
        await writeLog(task.id, 'error', `Bridge: mislukt (exit=${code})`);
      }
      currentTaskId = null;
      resolve();
    });

    proc.on('error', async (err) => {
      await db.from('orchestrator_tasks').update({
        status: 'failed',
        error: err.message,
        finished_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('id', task.id);
      await writeLog(task.id, 'error', `Bridge spawn error: ${err.message}`);
      currentTaskId = null;
      resolve();
    });
  });
}

// ── Claim & run ───────────────────────────────────────────────────────────────

async function claimAndRun() {
  if (currentTaskId) return; // already busy

  const { data: tasks, error } = await db
    .from('orchestrator_tasks')
    .select('id,title,task_type,objective,payload')
    .eq('worker_id', WORKER_ID)
    .eq('status', 'open')
    .order('priority', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(1);

  if (error || !tasks || tasks.length === 0) return;

  const task = tasks[0] as {
    id: string;
    title: string;
    task_type: string;
    objective: { text?: string } | null;
    payload: Record<string, unknown> | null;
  };

  // Claim it atomically
  const { error: claimErr } = await db
    .from('orchestrator_tasks')
    .update({
      status: 'running',
      started_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', task.id)
    .eq('status', 'open'); // guard against race

  if (claimErr) return;

  currentTaskId = task.id;
  console.log(`[CLI-L] Claimed task ${task.id}: ${task.title}`);

  await executeTask(task);
}

// ── Main loop ─────────────────────────────────────────────────────────────────

async function main() {
  console.log(`[CLI-L Bridge] Starting — worker_id=${WORKER_ID}`);
  await heartbeat();

  setInterval(heartbeat, HEARTBEAT_MS);
  setInterval(claimAndRun, POLL_MS);

  // First poll immediately
  setTimeout(claimAndRun, 1000);
}

main().catch((err) => {
  console.error('[CLI-L Bridge] Fatal:', err);
  process.exit(1);
});
