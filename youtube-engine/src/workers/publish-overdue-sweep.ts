import { getSupabase } from '../lib/supabase'
import { buildOAuthClient, setVideoPublic } from '../lib/youtube-api'
import { workerLogger } from '../lib/logger'

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
export function startPublishOverdueSweep(): NodeJS.Timeout {
  const tick = async () => {
    try {
      if (!(await windowOpen())) return
      const today = Math.floor(Date.now() / 86_400_000)
      if (today === lastRunDay) return // al gedraaid vandaag
      lastRunDay = today
      const { published, quotaHit } = await publishOverdueFinance()
      log.info('Publish-overdue finance-sweep', { published, quotaHit, max: MAX_PER_RUN })
    } catch (e) {
      log.error('publish-sweep tick failed', { error: (e as Error).message })
    }
  }

  void tick()
  const timer = setInterval(() => void tick(), CHECK_INTERVAL_MS)
  log.info('Publish-overdue sweep scheduler started', { engineKey: ENGINE_KEY, intervalMs: CHECK_INTERVAL_MS })
  return timer
}
