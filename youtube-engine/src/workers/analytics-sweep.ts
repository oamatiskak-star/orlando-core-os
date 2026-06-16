import { getSupabase } from '../lib/supabase'
import { enqueueAnalytics } from '../lib/redis-queue'
import { workerLogger } from '../lib/logger'

const log = workerLogger('analytics-sweep')

// Engine Planner key (zie migratie 215). sync_engine_windows() (mig 093) houdt enabled
// gelijk aan engine_window_open(); wij checken hier direct voor fail-safe gating.
const ENGINE_KEY = 'content:analytics-feedback'
const CHECK_INTERVAL_MS = 15 * 60_000 // venster elke 15 min controleren
const PAGE = 1000

let lastSweepDay = -1

async function windowOpen(): Promise<boolean> {
  try {
    const db = getSupabase()
    const { data, error } = await db.rpc('engine_window_open', { p_engine_key: ENGINE_KEY })
    if (error) {
      log.warn('engine_window_open error — fail-open', { error: error.message })
      return true
    }
    return data !== false
  } catch (e) {
    log.warn('engine_window_open exception — fail-open', { error: (e as Error).message })
    return true
  }
}

/**
 * Her-poll ALLE live video's. Lost de kern van de meetlus op: video's werden tot nu toe
 * één keer ~direct na upload gemeten (views=0) en nooit opnieuw, waardoor ctr/rpm/retentie
 * structureel 0 bleven. De sweep enqueued dagelijks (window-gated) analytics-jobs voor elke
 * verified_live video; dankzij dag-gebucketde jobId in enqueueAnalytics is dit idempotent.
 */
async function runSweep(): Promise<number> {
  const db = getSupabase()
  let from = 0
  let total = 0
  for (;;) {
    const { data, error } = await db
      .from('youtube_upload_queue')
      .select('video_id, channel_id, youtube_video_id')
      .eq('status', 'verified_live')
      .not('youtube_video_id', 'is', null)
      .range(from, from + PAGE - 1)

    if (error) {
      log.error('sweep query failed', { error: error.message })
      break
    }
    if (!data || data.length === 0) break

    for (const row of data) {
      if (!row.video_id || !row.channel_id || !row.youtube_video_id) continue
      try {
        await enqueueAnalytics({
          videoId: row.video_id,
          channelId: row.channel_id,
          youtubeVideoId: row.youtube_video_id,
        })
        total++
      } catch (e) {
        log.warn('enqueue failed for video', { videoId: row.video_id, error: (e as Error).message })
      }
    }

    if (data.length < PAGE) break
    from += PAGE
  }
  return total
}

export function startAnalyticsSweep(): NodeJS.Timeout {
  const tick = async () => {
    try {
      if (!(await windowOpen())) return
      const today = Math.floor(Date.now() / 86_400_000)
      if (today === lastSweepDay) return // al gesweept vandaag
      lastSweepDay = today
      log.info('Analytics window open — running daily re-poll sweep')
      const n = await runSweep()
      log.info('Analytics sweep enqueued', { videos: n })
    } catch (e) {
      log.error('sweep tick failed', { error: (e as Error).message })
    }
  }

  void tick()
  const timer = setInterval(() => void tick(), CHECK_INTERVAL_MS)
  log.info('Analytics sweep scheduler started', { engineKey: ENGINE_KEY, intervalMs: CHECK_INTERVAL_MS })
  return timer
}
