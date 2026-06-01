import 'dotenv/config'
import cron from 'node-cron'
import { getSupabase } from '../lib/supabase'
import { workerLogger } from '../lib/logger'
import { resolveChannelHandle, fetchChannelInfo } from '../lib/youtube-public-api'
import { scanCompetitor, CompetitorRow, ScanResult } from './scanner'
import { FOLLOW_LIST } from './seed-channels'

// ─────────────────────────────────────────────────────────────────────────────
// LOKALE YouTube competitor-scraper (apart van de Docker youtube-engine).
// - seedt de volglijst (handles → channel-ID → competitor_channels)
// - draait één sweep via de bestaande scanCompetitor()-logica
// - logt elke cyclus naar public.scraper_runs (source='youtube_competitor')
//   zodat Hermes (scraper_idle-check) + het dashboard het zien.
// Draait in de DAGPLOEG-vensters (06:00 & 14:00 NL) via node-cron, óf eenmalig
// met `--once` voor handmatig testen.
// Vereist env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, YOUTUBE_DATA_API_KEY.
// ─────────────────────────────────────────────────────────────────────────────

const log = workerLogger('yt-competitor-scraper-local')
const SCAN_CONCURRENCY = 3

async function seedFollowList(): Promise<number> {
  const db = getSupabase()
  let seeded = 0

  for (const entry of FOLLOW_LIST) {
    try {
      const channelId = await resolveChannelHandle(entry.handle)
      if (!channelId) {
        log.warn('Handle niet resolvbaar — overgeslagen', { handle: entry.handle })
        continue
      }

      const { data: existing } = await db
        .from('competitor_channels')
        .select('id')
        .eq('platform', 'youtube')
        .eq('external_id', channelId)
        .maybeSingle()
      if (existing) continue

      const info = await fetchChannelInfo(channelId)
      const { error } = await db.from('competitor_channels').insert({
        platform:         'youtube',
        external_id:      channelId,
        handle:           info?.customUrl ?? entry.handle,
        name:             info?.title ?? entry.handle,
        niche:            entry.niche,
        language:         entry.language ?? 'nl',
        subscriber_count: info?.subscriberCount ?? 0,
        video_count:      info?.videoCount ?? 0,
        total_view_count: info?.viewCount ?? 0,
        active:           true,
      })
      if (error) {
        log.error('Seed-insert faalde', { handle: entry.handle, error: error.message })
        continue
      }
      seeded++
      log.info('Concurrent toegevoegd', { handle: entry.handle, name: info?.title })
    } catch (err) {
      log.error('Seed crashte', { handle: entry.handle, error: (err as Error).message })
    }
  }
  return seeded
}

async function sweepOnce(): Promise<{ channels: number; videos_new: number; signals: number; errors: number }> {
  const db = getSupabase()
  const { data, error } = await db
    .from('competitor_channels')
    .select('id, platform, external_id, name, niche, language, subscriber_count, video_count, total_view_count, last_scanned_at')
    .eq('platform', 'youtube')
    .eq('active', true)
    .order('last_scanned_at', { ascending: true, nullsFirst: true })
  if (error) throw new Error(`competitor_channels query: ${error.message}`)

  const list = (data ?? []) as CompetitorRow[]
  let videos_new = 0, signals = 0, errors = 0

  for (let i = 0; i < list.length; i += SCAN_CONCURRENCY) {
    const slice = list.slice(i, i + SCAN_CONCURRENCY)
    const results = await Promise.all(slice.map((c) =>
      scanCompetitor(c).catch((e): ScanResult => ({
        competitor_id: c.id, videos_seen: 0, videos_new: 0, signals_emitted: 0, error: (e as Error).message,
      })),
    ))
    for (const r of results) {
      videos_new += r.videos_new
      signals    += r.signals_emitted
      if (r.error) errors++
    }
  }
  return { channels: list.length, videos_new, signals, errors }
}

async function runCycle(): Promise<void> {
  const db = getSupabase()
  const t0 = Date.now()
  const { data: runRow } = await db
    .from('scraper_runs')
    .insert({ source: 'youtube_competitor', status: 'running', started_at: new Date().toISOString() })
    .select('id')
    .maybeSingle()
  const runId = runRow?.id as string | undefined

  try {
    const seeded = await seedFollowList()
    const s = await sweepOnce()
    const durationMs = Date.now() - t0
    if (runId) {
      await db.from('scraper_runs').update({
        status:        'success',
        finished_at:   new Date().toISOString(),
        duration_ms:   durationMs,
        records_found: s.channels,
        records_new:   s.videos_new,
      }).eq('id', runId)
    }
    log.info('Cyclus klaar', { seeded, ...s, durationMs })
  } catch (err) {
    const msg = (err as Error).message
    if (runId) {
      await db.from('scraper_runs').update({
        status: 'error', finished_at: new Date().toISOString(), error_msg: msg,
      }).eq('id', runId)
    }
    log.error('Cyclus faalde', { error: msg })
  }
}

async function main() {
  if (process.argv.includes('--once')) {
    await runCycle()
    process.exit(0)
  }

  log.info('Lokale YouTube competitor-scraper gestart — dagploeg-vensters 06:00 & 14:00 NL')
  cron.schedule('0 6,14 * * *', () => {
    runCycle().catch((e) => log.error('cron-run faalde', { error: (e as Error).message }))
  })
  // meteen één keer draaien bij start zodat er direct data is
  runCycle().catch((e) => log.error('startup-run faalde', { error: (e as Error).message }))
}

main().catch((e) => {
  log.error('fatale startfout', { error: (e as Error).message })
  process.exit(1)
})
