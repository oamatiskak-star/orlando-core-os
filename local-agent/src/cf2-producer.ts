/**
 * CF2 Producer — orchestrator over de cf2_jobs-queue (Review Intelligence + Producer Graph).
 *
 * GATED. Standaard CF2_PRODUCER_MODE=prepared → er wordt NIETS geproduceerd, geüpload of
 * uitgegeven; de orchestrator valideert alleen de keten + lokale-model-health.
 *
 * In live-mode (aparte go, host: Mac Mini) delegeert de zware productie naar de bestaande
 * lokale-first producer `runShadowTopic` (shadow-core): topic → content → scenes → voice →
 * visual → music → thumbnail → render, ALLES lokaal en ZONDER upload/publicatie. De
 * stapresultaten worden gelogd in cf2_job_steps (Producer Graph audittrail).
 *
 * Upload is gecodeerd maar HARD GATED: alleen bij CF2_PUBLISH=1 wordt een queue-rij in
 * youtube_upload_queue gemaakt, ALTIJD privacy_status='private' (nooit direct publiek;
 * handmatige review vóór public). Zonder CF2_PUBLISH=1 → upload 'skipped'.
 *
 * Wordt NIET vanzelf gestart: geen import in index.ts/scheduler, geen cron. Draaien vereist
 * expliciet CF2_PRODUCER_RUN=1 + CF2_PRODUCER_MODE=live (+ CF2_PUBLISH=1 voor private upload)
 * + engine enabled=true. Host: Mac Mini (lokale modellen + render).
 */
import 'dotenv/config'   // MOET als eerste: laadt .env vóór elke transitieve lib-const (bv. USE_LM_STUDIO in local-llm.ts)
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import axios from 'axios'
import { runShadowTopic } from './shadow-core'

type Mode = 'prepared' | 'live'
const MODE: Mode = (process.env.CF2_PRODUCER_MODE as Mode) || 'prepared'
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434'
const LM_STUDIO_URL = process.env.LM_STUDIO_URL || 'http://localhost:1234'
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.2'
const LM_STUDIO_MODEL = process.env.LM_STUDIO_MODEL || 'default'

type GenStep = 'creative' | 'thumbnail' | 'video' | 'upload' | 'attribution'

const log = (...a: unknown[]) => console.log('[cf2]', ...a)

type Cf2Job = {
  id: string
  bron_niche: string | null
  bron_hook_category: string | null
  source_winner_video_id: string | null
  bron_channel_id: string | null
  bron_horizon_id: string | null
  reason: string | null
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

function langForNiche(niche: string | null): string {
  if (!niche) return 'en'
  if (niche.endsWith('_es')) return 'es'
  if (niche.includes('_nl')) return 'nl'
  return 'en'
}

/** Resolveer onderwerp + youtube-kanaal voor een job (bron-winner / horizon-plan). */
async function jobContext(client: SupabaseClient, job: Cf2Job): Promise<{ topic: string; channelId: string | null }> {
  let topic = job.reason ?? `${job.bron_niche ?? 'content'} video`
  if (job.bron_horizon_id) {
    const { data } = await client.from('content_horizon').select('title_draft').eq('id', job.bron_horizon_id).maybeSingle()
    if (data?.title_draft) topic = data.title_draft as string
  } else if (job.source_winner_video_id) {
    const { data } = await client.from('youtube_videos').select('title').eq('id', job.source_winner_video_id).maybeSingle()
    if (data?.title) topic = `Variant: ${data.title as string}`
  }
  let channelId: string | null = null
  if (job.bron_channel_id) {
    const { data } = await client.from('media_holding_channels').select('youtube_channel_id').eq('id', job.bron_channel_id).maybeSingle()
    channelId = (data?.youtube_channel_id as string | null) ?? null
  }
  return { topic, channelId }
}

const nowIso = () => new Date().toISOString()

/**
 * LIVE-productie van één job via de bestaande shadow-producer (lokaal, GEEN upload).
 * Mapt het ShadowResult op de cf2_job_steps-audittrail. Thumbnail is verplicht.
 */
async function produceJobLive(client: SupabaseClient, job: Cf2Job): Promise<void> {
  const ctx = await jobContext(client, job)
  const short = job.id.slice(0, 8)
  log(`job ${short} → "${ctx.topic}" (niche=${job.bron_niche ?? '?'}, kanaal=${ctx.channelId ?? 'geen'})`)
  await setStep(client, job.id, 'creative', { status: 'running', started_at: nowIso() })
  log(`  creative/render bezig… (lokaal model + visual + tts + ffmpeg — kan minuten duren)`)
  try {
    const r = await runShadowTopic({
      channelId: ctx.channelId,
      niche: job.bron_niche,
      topic: ctx.topic,
      language: langForNiche(job.bron_niche),
      format: '9:16',             // shorts-first (kanaalregel)
      voice: 'default',
      targetSeconds: 50,
      lmStudioModel: LM_STUDIO_MODEL,
      ollamaModel: OLLAMA_MODEL,
    })

    await setStep(client, job.id, 'creative', { status: 'done', completed_at: nowIso(), meta: { project_id: r.projectId, title: r.title, scenes: r.sceneCount } })
    log(`  creative done — project ${String(r.projectId).slice(0, 8)} "${r.title}" (${r.sceneCount} scenes)`)

    // thumbnail VERPLICHT — geen video zonder thumbnail (bewezen patroon: 100% winners)
    if (r.thumbnailVariants > 0) { await setStep(client, job.id, 'thumbnail', { status: 'done', completed_at: nowIso(), meta: { variants: r.thumbnailVariants } }); log(`  thumbnail done (${r.thumbnailVariants} varianten)`) }
    else { await setStep(client, job.id, 'thumbnail', { status: 'failed', failed_at: nowIso(), failure_reason: 'thumbnail-gate: geen variant gegenereerd' }); log(`  thumbnail FAILED (geen variant)`) }

    if (r.renderUrl && r.gatePassed) { await setStep(client, job.id, 'video', { status: 'done', completed_at: nowIso(), meta: { render_url: r.renderUrl, cqi: r.cqi } }); log(`  video done — ${r.renderUrl} (cqi=${r.cqi})`) }
    else { await setStep(client, job.id, 'video', { status: 'failed', failed_at: nowIso(), failure_reason: r.reasons ?? 'kwaliteits-gate niet gehaald' }); log(`  video FAILED — ${r.reasons ?? 'kwaliteits-gate niet gehaald'}`) }

    const ok = r.thumbnailVariants > 0 && !!r.renderUrl && r.gatePassed

    // upload — HARD GATED: alleen bij CF2_PUBLISH=1 én geslaagde render; ALTIJD privacy='private'
    // (nooit direct publiek). De youtube-engine pikt de queue-rij op; review vóór public maken.
    if (ok && process.env.CF2_PUBLISH === '1' && ctx.channelId) {
      await setStep(client, job.id, 'upload', { status: 'running', started_at: nowIso() })
      try {
        const { data: q, error } = await client.from('youtube_upload_queue').insert({
          channel_id: ctx.channelId,
          title: r.title,
          privacy_status: 'private',
          status: 'queued',
          viral_score: r.cqi,
          scheduled_publish_at: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
        }).select('id').single()
        if (error) throw new Error(error.message)
        await setStep(client, job.id, 'upload', { status: 'done', completed_at: nowIso(), meta: { queue_id: q?.id, privacy: 'private' } })
      } catch (e) {
        await setStep(client, job.id, 'upload', { status: 'failed', failed_at: nowIso(), failure_reason: String((e as Error).message ?? e) })
      }
    } else {
      await setStep(client, job.id, 'upload', {
        status: 'skipped',
        failure_reason: process.env.CF2_PUBLISH === '1' ? 'geen geslaagde render' : 'publicatie uit (CF2_PUBLISH!=1)',
      })
    }
    await setStep(client, job.id, 'attribution', { status: 'skipped', failure_reason: 'wacht op publicatie + UTM' })

    await client.from('cf2_jobs').update({ status: ok ? 'produced' : 'failed', output_content_id: r.projectId, updated_at: nowIso() }).eq('id', job.id)
    log(`  job ${short} → ${ok ? 'PRODUCED ✅' : 'FAILED ❌'}`)
  } catch (e) {
    const msg = String((e as Error).message ?? e)
    await setStep(client, job.id, 'creative', { status: 'failed', failed_at: nowIso(), failure_reason: msg })
    await client.from('cf2_jobs').update({ status: 'failed', updated_at: nowIso() }).eq('id', job.id)
    log(`  job ${short} → FAILED ❌ (${msg})`)
  }
}

export async function runCf2Producer(limit = 3): Promise<{ mode: Mode; health: { ollama: boolean; lmstudio: boolean }; processed: number; pending: number }> {
  const client = db()
  const backend = (process.env.USE_LM_STUDIO !== 'false') ? `LM Studio (${LM_STUDIO_MODEL})` : `Ollama (${OLLAMA_MODEL})`
  const health = await localModelHealth()
  const { count: pending } = await client.from('cf2_jobs').select('id', { count: 'exact', head: true }).eq('status', 'planned')
  log(`mode=${MODE} · backend=${backend} · health ollama=${health.ollama} lmstudio=${health.lmstudio} · planned=${pending ?? 0}`)

  // PREPARED (default): alleen valideren — geen mutaties, geen productie, geen spend.
  if (MODE === 'prepared') { log('prepared-mode → alleen validatie, geen productie.'); return { mode: MODE, health, processed: 0, pending: pending ?? 0 } }

  // LIVE (gated): lokaal-first vereist; cloud alleen uitzondering.
  if (!health.ollama && !health.lmstudio) {
    throw new Error('geen lokaal model bereikbaar (Ollama/LM Studio) — start lokale modellen vóór live-productie')
  }
  const { data: jobs } = await client.from('cf2_jobs')
    .select('id, bron_niche, bron_hook_category, source_winner_video_id, bron_channel_id, bron_horizon_id, reason')
    .eq('status', 'planned').order('created_at', { ascending: true }).limit(limit)

  const queue = (jobs ?? []) as Cf2Job[]
  if (queue.length === 0) { log('geen planned jobs — niets te doen.'); return { mode: MODE, health, processed: 0, pending: pending ?? 0 } }
  log(`${queue.length} job(s) deze run (limit=${limit}).`)

  let processed = 0
  for (const job of queue) {
    await client.from('cf2_jobs').update({ status: 'producing', updated_at: nowIso() }).eq('id', job.id)
    await produceJobLive(client, job)
    processed++
    log(`voortgang: ${processed}/${queue.length} verwerkt`)
  }
  log(`klaar — ${processed} verwerkt.`)
  return { mode: MODE, health, processed, pending: pending ?? 0 }
}

// Alleen draaien bij expliciete opt-in. Geen auto-start.
if (require.main === module && process.env.CF2_PRODUCER_RUN === '1') {
  runCf2Producer(Number(process.env.CF2_PRODUCER_LIMIT) || 3)
    .then((r) => { console.log('[cf2-producer]', JSON.stringify(r)); process.exit(0) })
    .catch((e) => { console.error('[cf2-producer] error', e); process.exit(1) })
}
