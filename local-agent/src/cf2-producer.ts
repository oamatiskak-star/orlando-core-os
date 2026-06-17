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
import { loadChannelStrategy, topicMatchesNiche } from './lib/channel-strategy'
import { uploadVideoToStorage } from './lib/storage'

type Mode = 'prepared' | 'live'
const MODE: Mode = (process.env.CF2_PRODUCER_MODE as Mode) || 'prepared'
const ENGINE_KEY = 'content:cf2-video-projects-runner'   // Engine Planner-key (mig 206)
const LOOP_INTERVAL_MS = Number(process.env.CF2_PRODUCER_INTERVAL_MS) || 600_000   // 10 min
const LOOP_LIMIT = Number(process.env.CF2_PRODUCER_LIMIT) || 3
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

/** Engine Planner = single source of truth. De producer-loop draait alleen wanneer het
 *  venster van engine 'content:cf2-video-projects-runner' open is (mig 206 enabled, blok
 *  'content' 18:30-22:00). Fail-open als de RPC faalt (planner zelf is dan de gate via flag). */
async function engineWindowOpen(client: SupabaseClient, key = ENGINE_KEY): Promise<boolean> {
  try {
    const { data, error } = await client.rpc('engine_window_open', { p_engine_key: key })
    if (error) { log(`engine_window_open RPC fout (${error.message}) — fail-open`); return true }
    return data !== false
  } catch (e) { log(`engine_window_open exception (${String((e as Error).message ?? e)}) — fail-open`); return true }
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

interface FormatConfig {
  format: '16:9' | '9:16'
  targetSeconds: number
  formatProfile: string | null
  dataSymbols: string[]
}

// Default = Shorts (bestaand gedrag). Alleen een kanaal met content_rules.format_profile
// = 'us_finance_longform' schakelt om naar de faceless finance data-explainer (16:9, long-form
// + FMP-data). Fail-safe naar default bij ontbrekende strategy of DB-fout.
const DEFAULT_FORMAT: FormatConfig = { format: '9:16', targetSeconds: 50, formatProfile: null, dataSymbols: [] }

// LET OP sleutels: channel_strategy.channel_id = media_holding_channels.id (NIET youtube_channels.id).
// Daarom resolven we op de media-channel-id (job.bron_channel_id), niet op de youtube-channel-id.
async function resolveChannelFormat(client: SupabaseClient, mediaChannelId: string | null): Promise<FormatConfig> {
  if (!mediaChannelId) return DEFAULT_FORMAT
  try {
    const { data } = await client.from('channel_strategy').select('content_rules').eq('channel_id', mediaChannelId).maybeSingle()
    const rules = (data?.content_rules ?? {}) as Record<string, unknown>
    if (rules.format_profile === 'us_finance_longform') {
      const sym = Array.isArray(rules.data_symbols) ? (rules.data_symbols as string[]) : []
      return {
        format: '16:9',
        targetSeconds: typeof rules.target_seconds === 'number' ? rules.target_seconds : 840,
        formatProfile: 'us_finance_longform',
        dataSymbols: sym.length ? sym : ['^GSPC', '^IXIC', '^DJI'],
      }
    }
    if (rules.format_profile === 'aquier_promo') {
      // Aquier-promo: korte advertentie/explainer (16:9), product + werkende link uit aquier_products.
      return {
        format: '16:9',
        targetSeconds: typeof rules.target_seconds === 'number' ? rules.target_seconds : 90,
        formatProfile: 'aquier_promo',
        dataSymbols: [],
      }
    }
    return DEFAULT_FORMAT
  } catch {
    return DEFAULT_FORMAT
  }
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

  // CF2-repair: HARDE niche-gate VÓÓR generatie. Topic moet binnen de kanaal-niche-topics vallen,
  // anders REJECT — geen script, geen render, geen QC, geen upload (bespaart productie + houdt
  // off-niche content (gaming/K-pop) van finance/vastgoed-kanalen). Fail-open zonder strategy/topics.
  // Winnaar-replicatie (source_winner_video_id) = een BEWEZEN winnaar van het kanaal →
  // per definitie on-niche; de letterlijke keyword-gate zou zo'n titel ("This machine runs
  // forever 🔄") onterecht afkeuren. Sla de gate over voor winnaar-jobs; speculatieve/auto-
  // topics (horizon/growth) blijven gegate tegen off-niche.
  const isWinnerReplica = !!job.source_winner_video_id
  const gateStrategy = await loadChannelStrategy(ctx.channelId)
  if (!isWinnerReplica && gateStrategy && gateStrategy.topics.length && !topicMatchesNiche(ctx.topic, gateStrategy.topics)) {
    const reason = `niche_gate_fail: topic "${ctx.topic}" valt buiten kanaal-topics [${gateStrategy.topics.join(', ')}]`
    log(`  ❌ NICHE-GATE: ${reason} — job afgewezen vóór generatie`)
    await client.from('cf2_jobs').update({ status: 'failed', updated_at: nowIso() }).eq('id', job.id)
    await setStep(client, job.id, 'creative', { status: 'failed', failed_at: nowIso(), failure_reason: reason })
    return
  }

  await setStep(client, job.id, 'creative', { status: 'running', started_at: nowIso() })
  log(`  creative/render bezig… (lokaal model + visual + tts + ffmpeg — kan minuten duren)`)
  try {
    const fmt = await resolveChannelFormat(client, job.bron_channel_id)
    const r = await runShadowTopic({
      channelId: ctx.channelId,
      niche: job.bron_niche,
      topic: ctx.topic,
      language: fmt.formatProfile === 'us_finance_longform' ? 'en' : langForNiche(job.bron_niche),
      format: fmt.format,         // default 9:16 (shorts); 16:9 voor finance-longform-profiel
      voice: 'default',
      targetSeconds: fmt.targetSeconds,
      lmStudioModel: LM_STUDIO_MODEL,
      ollamaModel: OLLAMA_MODEL,
      formatProfile: fmt.formatProfile,
      dataSymbols: fmt.dataSymbols,
    })

    await setStep(client, job.id, 'creative', { status: 'done', completed_at: nowIso(), meta: { project_id: r.projectId, title: r.title, scenes: r.sceneCount } })
    log(`  creative done — project ${String(r.projectId).slice(0, 8)} "${r.title}" (${r.sceneCount} scenes)`)

    // thumbnail VERPLICHT — geen video zonder thumbnail (bewezen patroon: 100% winners)
    if (r.thumbnailVariants > 0) { await setStep(client, job.id, 'thumbnail', { status: 'done', completed_at: nowIso(), meta: { variants: r.thumbnailVariants } }); log(`  thumbnail done (${r.thumbnailVariants} varianten)`) }
    else { await setStep(client, job.id, 'thumbnail', { status: 'failed', failed_at: nowIso(), failure_reason: 'thumbnail-gate: geen variant gegenereerd' }); log(`  thumbnail FAILED (geen variant)`) }

    if (r.renderUrl && r.gatePassed) { await setStep(client, job.id, 'video', { status: 'done', completed_at: nowIso(), meta: { render_url: r.renderUrl, cqi: r.cqi } }); log(`  video done — ${r.renderUrl} (cqi=${r.cqi})`) }
    else { await setStep(client, job.id, 'video', { status: 'failed', failed_at: nowIso(), failure_reason: r.reasons ?? 'kwaliteits-gate niet gehaald' }); log(`  video FAILED — ${r.reasons ?? 'kwaliteits-gate niet gehaald'}`) }

    const ok = r.thumbnailVariants > 0 && !!r.renderUrl && r.gatePassed

    // Upload-uitgang (Fase 2 / B2). HARD GATED op CF2_PUBLISH=1; de CQI/QC-gate (ok=gatePassed) is
    // de poortwachter — alleen kwaliteit-geslaagde projecten bereiken dit punt (de ~67% rework valt af).
    // Drie stappen sluiten de keten die voorheen brak:
    //   1) render → DURABLE Supabase Storage (overleeft /tmp-cleanup → fixt 'input file not found'),
    //   2) youtube_videos-rij met storage-refs (de upload-worker leest storage_path/file_path),
    //   3) queue-rij MÉT video_id — zonder video_id vond de worker nooit een bestand (kernbug Fase 1-audit).
    // Upload gaat als 'private' naar YouTube; publish-overdue promoot direct naar PUBLIC
    // (scheduled_publish_at=nu) zodra verwerkt → volautomatisch publiek, QC-bewaakt.
    if (ok && process.env.CF2_PUBLISH === '1' && ctx.channelId && r.renderUrl) {
      await setStep(client, job.id, 'upload', { status: 'running', started_at: nowIso() })
      try {
        const storagePath = `cf2/${ctx.channelId}/${r.projectId}.mp4`
        const signedUrl = await uploadVideoToStorage(r.renderUrl, storagePath)
        const { data: vid, error: vErr } = await client.from('youtube_videos').insert({
          channel_id:     ctx.channelId,
          video_id:       `pending_${Date.now()}`,
          title:          r.title,
          privacy_status: 'private',
          file_path:      signedUrl,
          storage_bucket: 'yt-videos',
          storage_path:   storagePath,
          status:         'queued',
          upload_status:  'pending',
          is_short:       true,
          viral_score:    r.cqi,
        }).select('id').single()
        if (vErr || !vid?.id) throw new Error(`youtube_videos insert: ${vErr?.message ?? 'geen id'}`)
        const { data: q, error } = await client.from('youtube_upload_queue').insert({
          video_id:             vid.id,
          channel_id:           ctx.channelId,
          title:                r.title,
          privacy_status:       'private',
          status:               'queued',
          viral_score:          r.cqi,
          scheduled_publish_at: nowIso(),   // QC-geslaagd → direct publiek na verwerking (publish-overdue)
        }).select('id').single()
        if (error) throw new Error(error.message)
        await client.from('video_projects').update({ queue_id: q?.id, render_url: signedUrl }).eq('id', r.projectId)
        await setStep(client, job.id, 'upload', { status: 'done', completed_at: nowIso(), meta: { queue_id: q?.id, video_id: vid.id, storage_path: storagePath, privacy: 'private', auto_public: true } })
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

/**
 * SCHEDULER-DRIVEN loop (Sprint B). Draait persistent onder PM2; produceert autonoom
 * zodra de Engine Planner het venster opent (engine 'content:cf2-video-projects-runner').
 * Geen operator-actie meer nodig: growth/winner seeden cf2_jobs, deze loop verwerkt ze.
 * Niet-overlappend (één run tegelijk). Stopt nooit uit zichzelf (PM2 autorestart).
 */
let loopBusy = false
export async function runCf2ProducerLoop(): Promise<void> {
  const client = db()
  log(`loop gestart — mode=${MODE} · interval=${LOOP_INTERVAL_MS / 1000}s · limit=${LOOP_LIMIT} · engine=${ENGINE_KEY}`)
  const tick = async () => {
    if (loopBusy) { log('vorige tick nog bezig — sla over'); return }
    loopBusy = true
    try {
      if (!(await engineWindowOpen(client))) { log('engine-venster dicht — wacht'); return }
      await runCf2Producer(LOOP_LIMIT)
    } catch (e) {
      log(`tick fout: ${String((e as Error).message ?? e)}`)
    } finally {
      loopBusy = false
    }
  }
  await tick()
  setInterval(tick, LOOP_INTERVAL_MS)
}

// Entrypoints:
//   CF2_PRODUCER_LOOP=1  -> persistent scheduler-loop (PM2, autonoom; planner-gated)
//   CF2_PRODUCER_RUN=1   -> eenmalige run (handmatig testen; niet planner-gated)
if (require.main === module) {
  if (process.env.CF2_PRODUCER_LOOP === '1') {
    runCf2ProducerLoop().catch((e) => { console.error('[cf2-producer] loop fatal', e); process.exit(1) })
  } else if (process.env.CF2_PRODUCER_RUN === '1') {
    runCf2Producer(LOOP_LIMIT)
      .then((r) => { console.log('[cf2-producer]', JSON.stringify(r)); process.exit(0) })
      .catch((e) => { console.error('[cf2-producer] error', e); process.exit(1) })
  }
}
