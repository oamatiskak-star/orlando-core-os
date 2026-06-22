import { getSupabase } from '../lib/supabase'
import { buildOAuthClient, setVideoPublic } from '../lib/youtube-api'
import { workerLogger } from '../lib/logger'
import { ensureOwnedLinks } from '../lib/owned-link'

const log = workerLogger('publish-overdue-finance')

// Engine Planner key. Window-gated (zoals analytics-sweep) zodat publiceren niet
// ongepland naast zware batches draait. sync_engine_windows() houdt enabled gelijk
// aan engine_window_open(); wij checken hier direct voor fail-safe gating.
const ENGINE_KEY = 'content:publish-overdue-finance'
const CHECK_INTERVAL_MS = 30 * 60_000 // venster elke 30 min controleren
// Quota-vriendelijk: elke publish (videos.update) kost ~50 YouTube-quota-units. Cap per dag
// zodat uploads/analytics genoeg quota overhouden. Bij grote achterstand spreidt het over dagen.
const MAX_PER_RUN = parseInt(process.env.PUBLISH_FINANCE_MAX_PER_RUN ?? '40', 10)

const FINANCE_CHANNELS = [
  'VermogenTv', 'SpaarTv', 'VastgoedTv', 'CryptoVermogen', 'BeleggingsTv',
  'AquierTv', 'AquierNL', 'AquierTvEs', 'AquierDE', 'PropertyInvestorTv',
]

let lastRunDay = -1

async function windowOpen(): Promise<boolean> {
  try {
    const db = getSupabase()
    const { data, error } = await db.rpc('engine_window_open', { p_engine_key: ENGINE_KEY })
    if (error) { log.warn('engine_window_open error — fail-open', { error: error.message }); return true }
    return data !== false
  } catch (e) {
    log.warn('engine_window_open exception — fail-open', { error: (e as Error).message })
    return true
  }
}

/**
 * Publiceer tot `max` overdue private FINANCE-video's (privacy → public via de YouTube-API).
 * Idempotent (alleen nog-private), stopt NETJES bij een YouTube-quota-error i.p.v. door te
 * blijven hameren. Returnt #gepubliceerd + of de quota geraakt is.
 */
export async function publishOverdueFinance(max: number = MAX_PER_RUN): Promise<{ published: number; quotaHit: boolean }> {
  const db = getSupabase()

  const { data: chans } = await db.from('youtube_channels').select('id, name').in('name', FINANCE_CHANNELS)
  const financeIds = (chans ?? []).map((c) => c.id)
  if (financeIds.length === 0) return { published: 0, quotaHit: false }

  const { data: overdue } = await db
    .from('youtube_upload_queue')
    .select('id, video_id, channel_id, youtube_video_id')
    .in('status', ['uploaded_pending_processing', 'verified_live', 'verifying', 'manual_review_required'])
    .not('youtube_video_id', 'is', null)
    .in('channel_id', financeIds)
    .lte('scheduled_publish_at', new Date().toISOString())
    .limit(max * 3)
  if (!overdue || overdue.length === 0) return { published: 0, quotaHit: false }

  const videoIds = overdue.map((i) => i.video_id)
  const { data: privateVideos } = await db
    .from('youtube_videos').select('id').in('id', videoIds).eq('privacy_status', 'private')
  const privateSet = new Set((privateVideos ?? []).map((v) => v.id))
  const toPublish = overdue.filter((i) => privateSet.has(i.video_id)).slice(0, max)

  let published = 0
  let quotaHit = false
  for (const item of toPublish) {
    try {
      const { data: channel } = await db.from('youtube_channels').select('*').eq('id', item.channel_id).single()
      if (!channel?.refresh_token) continue
      const auth = buildOAuthClient(channel)
      await setVideoPublic(auth, item.youtube_video_id)
      await db.from('youtube_videos').update({ privacy_status: 'public', status: 'live', updated_at: new Date().toISOString() }).eq('id', item.video_id)
      await db.from('youtube_upload_queue').update({ status: 'verified_live', updated_at: new Date().toISOString() }).eq('id', item.id)
      published++
    } catch (err) {
      const msg = (err as Error).message
      if (/quota/i.test(msg)) { log.warn('YouTube-quota bereikt — stop deze run', { published }); quotaHit = true; break }
      log.error('publish faalde', { video: item.youtube_video_id, error: msg })
    }
  }
  return { published, quotaHit }
}

/** Window-gated dagelijkse sweep die een capped batch overdue finance-video's publiceert. */
// Quota-realistische cap voor recovery (de orchestrator uploadt enkele/dag/kanaal binnen de YT-quota).
const RECOVER_MAX_PER_RUN = parseInt(process.env.RECOVER_ARCHIVED_MAX_PER_RUN ?? '30', 10)

/**
 * Haalt 'archived' upload-records (door de eenmalige mf_classify_dead_queue-opschoning) terug naar
 * 'queued' zodat de orchestrator ze alsnog uploadt — MITS (a) er nog een bronbestand is én (b) de
 * QC-gate fail-open doorlaat (geen video_projects-koppeling die NIET geslaagd is). Capped per run.
 * Idempotent + loop-vrij: een teruggezet record is niet meer 'archived' (mf_classify is eenmalig),
 * dus wordt niet opnieuw opgepakt; mislukte uploads gaan naar failed/unrecoverable, niet terug.
 */
export async function recoverArchivedFinance(max: number = RECOVER_MAX_PER_RUN): Promise<{ recovered: number }> {
  const db = getSupabase()
  const { data: chans } = await db.from('youtube_channels').select('id, name').in('name', FINANCE_CHANNELS)
  const financeIds = (chans ?? []).map((c) => c.id)
  if (financeIds.length === 0) return { recovered: 0 }

  const { data: archived } = await db
    .from('youtube_upload_queue')
    .select('id, video_id, channel_id')
    .eq('status', 'archived')
    .in('channel_id', financeIds)
    .is('youtube_video_id', null)
    .limit(max * 3)
  if (!archived || archived.length === 0) return { recovered: 0 }

  // (a) alleen records met een bronbestand
  const videoIds = archived.map((a) => a.video_id).filter(Boolean) as string[]
  const { data: vids } = await db
    .from('youtube_videos').select('id, file_path, storage_path').in('id', videoIds)
  const withSource = new Set((vids ?? []).filter((v) => v.file_path || v.storage_path).map((v) => v.id))

  // (b) QC-gate: sluit records uit met een CF2-koppeling die NIET geslaagd is (geen koppeling = fail-open)
  const queueIds = archived.map((a) => a.id)
  const { data: projects } = await db
    .from('video_projects').select('queue_id, approved, quality_passed').in('queue_id', queueIds)
  const qcBlocked = new Set(
    (projects ?? []).filter((p) => p.approved !== true && p.quality_passed !== true).map((p) => p.queue_id),
  )

  const eligible = archived
    .filter((a) => a.video_id && withSource.has(a.video_id) && !qcBlocked.has(a.id))
    .slice(0, max)

  let recovered = 0
  const now = new Date().toISOString()
  for (const item of eligible) {
    const { error } = await db
      .from('youtube_upload_queue')
      .update({ status: 'queued', last_error: null, retry_count: 0, scheduled_publish_at: now, updated_at: now })
      .eq('id', item.id)
    if (!error) recovered++
    else log.warn('recover-archived faalde', { id: item.id, error: error.message })
  }
  return { recovered }
}

export function startPublishOverdueSweep(): NodeJS.Timeout {
  const tick = async () => {
    try {
      if (!(await windowOpen())) return
      const today = Math.floor(Date.now() / 86_400_000)
      if (today === lastRunDay) return // al gedraaid vandaag
      lastRunDay = today
      const { published, quotaHit } = await publishOverdueFinance()
      log.info('Publish-overdue finance-sweep', { published, quotaHit, max: MAX_PER_RUN })
      // Zorg dat elk finance-kanaal de UTM-getagde owned-link in de beschrijving heeft
      // (idempotent; zet o.a. AquierDE → /de zodra de quota het toelaat).
      const links = await ensureOwnedLinks(true, log)
      log.info('Owned-links ensured', links)
      // Haal onterecht gearchiveerde (legacy, met bronbestand + QC-pass) uploads terug naar de queue.
      const rec = await recoverArchivedFinance()
      log.info('Archived-recovery', rec)
    } catch (e) {
      log.error('publish-sweep tick failed', { error: (e as Error).message })
    }
  }

  void tick()
  const timer = setInterval(() => void tick(), CHECK_INTERVAL_MS)
  log.info('Publish-overdue sweep scheduler started', { engineKey: ENGINE_KEY, intervalMs: CHECK_INTERVAL_MS })
  return timer
}
