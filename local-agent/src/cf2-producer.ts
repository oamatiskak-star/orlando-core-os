/**
 * CF2 Producer — orchestrator over de cf2_jobs-queue (Review Intelligence + Producer Graph).
 *
 * GATED / PREPARED. Standaard CF2_PRODUCER_MODE=prepared → er wordt NIETS geproduceerd,
 * geüpload of uitgegeven; de orchestrator valideert alleen de keten + lokale-model-health.
 * In live-mode (aparte go) delegeert hij per stap naar de bestaande lokale-first toolkit in
 * local-agent/src/lib (ai/scene-planner/visual-intelligence/thumbnail-intelligence/tts/
 * audio/render/video/storage) en logt status/timestamps per stap in cf2_job_steps.
 *
 * Wordt NIET vanzelf gestart: geen import in index.ts/scheduler, geen cron. Draaien vereist
 * expliciet CF2_PRODUCER_RUN=1 + CF2_PRODUCER_MODE=live + engine enabled=true (host: Mac Mini).
 */
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import axios from 'axios'

type Mode = 'prepared' | 'live'
const MODE: Mode = (process.env.CF2_PRODUCER_MODE as Mode) || 'prepared'
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434'
const LM_STUDIO_URL = process.env.LM_STUDIO_URL || 'http://localhost:1234'

// Generatie-stappen (selectie-stappen viral/hook/winner/horizon zijn al 'done' bij seeding)
const GEN_STEPS = ['creative', 'thumbnail', 'video', 'upload', 'attribution'] as const
type GenStep = (typeof GEN_STEPS)[number]

type Cf2Job = {
  id: string
  bron_niche: string | null
  bron_hook_category: string | null
  bron_thumbnail_ref: string | null
  source_winner_video_id: string | null
  reason: string | null
  status: string
}

function db(): SupabaseClient {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/** Lokale-first health: pingt Ollama + LM Studio (read-only, geen spend). */
async function localModelHealth(): Promise<{ ollama: boolean; lmstudio: boolean }> {
  const ping = async (url: string, path: string) => {
    try { await axios.get(`${url}${path}`, { timeout: 2500 }); return true } catch { return false }
  }
  return { ollama: await ping(OLLAMA_URL, '/api/tags'), lmstudio: await ping(LM_STUDIO_URL, '/v1/models') }
}

async function setStep(client: SupabaseClient, jobId: string, step: GenStep, patch: Record<string, unknown>) {
  await client.from('cf2_job_steps').update(patch).eq('job_id', jobId).eq('step', step)
}

/**
 * Live-generator integratiepunt. Tot expliciete koppeling gooit dit bewust een fout, zodat
 * live-mode niet stilletjes "niets" produceert. Koppel hier de bestaande lokale-first libs:
 *   creative   → lib/ai.ts (generateContent) + lib/scene-planner.ts
 *   thumbnail  → lib/thumbnail-intelligence.ts (VERPLICHT — geen video zonder thumbnail)
 *   video      → lib/visual-intelligence.ts + lib/tts.ts + lib/audio.ts + lib/render.ts + lib/video.ts
 *   upload     → youtube_upload_queue (youtube-engine)
 *   attribution→ video_attribution / affiliate_*
 */
async function runLiveStep(_job: Cf2Job, step: GenStep): Promise<void> {
  throw new Error(`live-generator voor stap '${step}' nog niet gekoppeld — koppel local-agent/src/lib/* vóór activatie`)
}

/** Verwerk één job door de generatie-stappen. Prepared = valideren/loggen, geen spend. */
async function processJob(client: SupabaseClient, job: Cf2Job): Promise<void> {
  for (const step of GEN_STEPS) {
    if (MODE === 'prepared') {
      // niet uitvoeren: markeer expliciet als voorbereid, geen generatie/upload/spend
      await setStep(client, job.id, step, {
        status: 'skipped',
        failure_reason: 'prepared: niet uitgevoerd (geen spend) — wacht op live-activatie',
      })
      continue
    }
    // live-mode
    await setStep(client, job.id, step, { status: 'running', started_at: new Date().toISOString() })
    try {
      // thumbnail is verplicht: geen video zonder thumbnail (bewezen patroon: 100% winners)
      await runLiveStep(job, step)
      await setStep(client, job.id, step, { status: 'done', completed_at: new Date().toISOString() })
    } catch (e) {
      await setStep(client, job.id, step, {
        status: 'failed', failed_at: new Date().toISOString(), failure_reason: String((e as Error).message ?? e),
      })
      await client.from('cf2_jobs').update({ status: 'failed', updated_at: new Date().toISOString() }).eq('id', job.id)
      return
    }
  }
  if (MODE === 'live') {
    await client.from('cf2_jobs').update({ status: 'produced', updated_at: new Date().toISOString() }).eq('id', job.id)
  }
}

export async function runCf2Producer(limit = 5): Promise<{ mode: Mode; health: { ollama: boolean; lmstudio: boolean }; processed: number; pending: number }> {
  const client = db()
  const health = await localModelHealth()

  const { count: pending } = await client.from('cf2_jobs').select('id', { count: 'exact', head: true }).eq('status', 'planned')

  // PREPARED: valideer alleen — geen mutaties, geen productie.
  if (MODE === 'prepared') {
    return { mode: MODE, health, processed: 0, pending: pending ?? 0 }
  }

  // LIVE (gated): vereist gezonde lokale modellen (lokaal-first; cloud alleen uitzondering).
  if (!health.ollama && !health.lmstudio) {
    throw new Error('geen lokaal model bereikbaar (Ollama/LM Studio) — start lokale modellen vóór live-productie')
  }
  const { data: jobs } = await client.from('cf2_jobs')
    .select('id, bron_niche, bron_hook_category, bron_thumbnail_ref, source_winner_video_id, reason, status')
    .eq('status', 'planned').order('created_at', { ascending: true }).limit(limit)

  let processed = 0
  for (const job of (jobs ?? []) as Cf2Job[]) {
    await client.from('cf2_jobs').update({ status: 'producing', updated_at: new Date().toISOString() }).eq('id', job.id)
    await processJob(client, job)
    processed++
  }
  return { mode: MODE, health, processed, pending: pending ?? 0 }
}

// Alleen draaien bij expliciete opt-in. Geen auto-start.
if (require.main === module && process.env.CF2_PRODUCER_RUN === '1') {
  runCf2Producer()
    .then((r) => { console.log('[cf2-producer]', JSON.stringify(r)); process.exit(0) })
    .catch((e) => { console.error('[cf2-producer] error', e); process.exit(1) })
}
