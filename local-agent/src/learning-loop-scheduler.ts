import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { runLearningLoop } from './learning-loop-worker'

// Window-gated scheduler voor de learning-loop. Spiegelt het cf2-producer-loop-patroon:
// Engine Planner = single source of truth (engine 'content:learning-loop', mig 215, blok
// 'janitor' 00:00-04:00). De loop draait de learning-loop 1×/dag wanneer het venster open is.
// De learning-loop zelf is read-mostly (schrijft checkpoints + viral_patterns) en idempotent
// per dag, dus 1 run/dag binnen het venster volstaat.

const ENGINE_KEY = 'content:learning-loop'
const CHECK_INTERVAL_MS = 15 * 60_000 // venster elke 15 min controleren

function ts(): string { return new Date().toISOString() }
function log(msg: string): void { console.log(`[learning-loop-scheduler ${ts()}] ${msg}`) }

function db(): SupabaseClient {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

async function engineWindowOpen(client: SupabaseClient): Promise<boolean> {
  try {
    const { data, error } = await client.rpc('engine_window_open', { p_engine_key: ENGINE_KEY })
    if (error) { log(`engine_window_open RPC fout (${error.message}) — fail-open`); return true }
    return data !== false
  } catch (e) {
    log(`engine_window_open exception (${String((e as Error).message ?? e)}) — fail-open`)
    return true
  }
}

let busy = false
let lastRunDay = -1

export async function runLearningLoopScheduler(): Promise<void> {
  const client = db()
  log(`loop gestart — interval=${CHECK_INTERVAL_MS / 1000}s · engine=${ENGINE_KEY}`)
  const tick = async () => {
    if (busy) return
    busy = true
    try {
      if (!(await engineWindowOpen(client))) return
      const today = Math.floor(Date.now() / 86_400_000)
      if (today === lastRunDay) return // al gedraaid vandaag
      lastRunDay = today
      log('venster open — learning-loop draaien')
      const r = await runLearningLoop(Date.now())
      log(`learning-loop klaar: ${JSON.stringify(r)}`)
    } catch (e) {
      log(`tick fout: ${String((e as Error).message ?? e)}`)
    } finally {
      busy = false
    }
  }
  await tick()
  setInterval(tick, CHECK_INTERVAL_MS)
}

// Entrypoint: LEARNING_LOOP_SCHED=1 -> persistent scheduler (PM2, planner-gated)
if (require.main === module) {
  runLearningLoopScheduler().catch((e) => {
    console.error('[learning-loop-scheduler] fatal', e)
    process.exit(1)
  })
}
