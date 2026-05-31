import 'dotenv/config'
import cron from 'node-cron'
import { getSupabase } from '../lib/supabase'
import { workerLogger } from '../lib/logger'
import { searchYouTube, fetchVideoStats, YouTubeSearchHit } from '../lib/youtube-public-api'
import { DISCOVERY_NICHES } from './discovery-keywords'

// ─────────────────────────────────────────────────────────────────────────────
// DISCOVERY-RUNNER (lokaal, dagploeg 1x/dag) — vindt zelf nieuwe virale video's
// + kanalen via YouTube search.list, scoort ze, en schrijft kansrijke video's
// naar viral_opportunities. De bestaande trigger bridge_viral_to_osil() pakt
// alles met virality_score >= 70 op en voedt de OSIL -> media_holding-funnel.
// Nieuwe kanalen worden aan competitor_channels toegevoegd zodat de volglijst-
// scraper ze gaat volgen.
//
// QUOTA: search.list = 100 units/call. DISCOVERY_MAX_SEARCHES (default 8) begrenst
// het aantal searches per run. Vereist env: SUPABASE_*, YOUTUBE_DATA_API_KEY.
// ─────────────────────────────────────────────────────────────────────────────

const log = workerLogger('yt-discovery')
const MAX_SEARCHES   = Number(process.env.DISCOVERY_MAX_SEARCHES ?? 8)
const RESULTS_PER_Q  = Number(process.env.DISCOVERY_RESULTS_PER_QUERY ?? 15)
const INSERT_MIN     = Number(process.env.DISCOVERY_INSERT_MIN_SCORE ?? 60) // net onder bridge-drempel 70
const LOOKBACK_DAYS  = Number(process.env.DISCOVERY_LOOKBACK_DAYS ?? 21)

interface ScoredVideo {
  id: string; title: string; url: string; thumbnailUrl: string | null
  channelId: string | null; channelName: string
  niche: string; language: string
  durationSeconds: number; publishedAt: string | null
  views: number; likes: number; comments: number
  viewVelocity: number; viralityScore: number
}

function scoreVideo(views: number, likes: number, comments: number, publishedAt: string | null): { virality: number; velocity: number } {
  const ageHours = publishedAt ? Math.max(1, (Date.now() - new Date(publishedAt).getTime()) / 3_600_000) : 1e9
  const velocity = views / ageHours
  const velScore = Math.min(100, Math.round(velocity / 10)) // ~1000 views/uur => 100
  const engagement = views > 0 ? (likes + comments) / views : 0
  const engBonus = Math.min(25, Math.round(engagement * 500))
  const recent = ageHours <= 24 * LOOKBACK_DAYS
  // virality_score kolom is 0–100 (DB-constraint) → hard cappen
  const virality = Math.min(100, Math.max(0, recent ? velScore + engBonus : Math.round((velScore + engBonus) * 0.3)))
  return { virality, velocity: Number(velocity.toFixed(2)) }
}

// Bouw de (niche, keyword) werklijst tot het search-budget
function buildSearchPlan(): { niche: string; language: string; keyword: string }[] {
  const plan: { niche: string; language: string; keyword: string }[] = []
  for (const n of DISCOVERY_NICHES) {
    for (const k of n.keywords) plan.push({ niche: n.niche, language: n.language, keyword: k })
  }
  return plan.slice(0, MAX_SEARCHES)
}

async function discover(): Promise<ScoredVideo[]> {
  const publishedAfter = new Date(Date.now() - LOOKBACK_DAYS * 24 * 3_600_000).toISOString()
  const plan = buildSearchPlan()
  const hitByVideoId = new Map<string, { hit: YouTubeSearchHit; niche: string; language: string }>()

  for (const p of plan) {
    try {
      const hits = await searchYouTube(p.keyword, {
        type: 'video', order: 'viewCount', maxResults: RESULTS_PER_Q,
        regionCode: 'NL', relevanceLanguage: p.language, publishedAfter,
      })
      for (const h of hits) {
        if (h.videoId && !hitByVideoId.has(h.videoId)) {
          hitByVideoId.set(h.videoId, { hit: h, niche: p.niche, language: p.language })
        }
      }
      log.info('Search klaar', { keyword: p.keyword, hits: hits.length })
    } catch (err) {
      log.error('Search faalde', { keyword: p.keyword, error: (err as Error).message })
    }
  }

  const videoIds = [...hitByVideoId.keys()]
  if (videoIds.length === 0) return []

  const stats = await fetchVideoStats(videoIds)
  const scored: ScoredVideo[] = []
  for (const v of stats) {
    const meta = hitByVideoId.get(v.id)
    if (!meta) continue
    const { virality, velocity } = scoreVideo(v.views, v.likes, v.comments, v.publishedAt)
    scored.push({
      id: v.id, title: v.title, url: `https://www.youtube.com/watch?v=${v.id}`, thumbnailUrl: v.thumbnailUrl,
      channelId: meta.hit.channelId, channelName: meta.hit.channelTitle,
      niche: meta.niche, language: meta.language,
      durationSeconds: v.durationSeconds, publishedAt: v.publishedAt,
      views: v.views, likes: v.likes, comments: v.comments,
      viewVelocity: velocity, viralityScore: virality,
    })
  }
  return scored
}

async function persist(scored: ScoredVideo[]): Promise<{ opportunities: number; channels: number }> {
  const db = getSupabase()
  const candidates = scored.filter((s) => s.viralityScore >= INSERT_MIN)
  if (candidates.length === 0) return { opportunities: 0, channels: 0 }

  // dedup viral_opportunities op external_id
  const { data: existing } = await db
    .from('viral_opportunities')
    .select('external_id')
    .eq('source_platform', 'youtube')
    .in('external_id', candidates.map((c) => c.id))
  const known = new Set((existing ?? []).map((r) => r.external_id))
  const fresh = candidates.filter((c) => !known.has(c.id))

  let opportunities = 0
  if (fresh.length) {
    const { error } = await db.from('viral_opportunities').insert(fresh.map((c) => ({
      source_platform:     'youtube',
      external_id:         c.id,
      title:               c.title,
      url:                 c.url,
      thumbnail_url:       c.thumbnailUrl,
      channel_name:        c.channelName,
      channel_external_id: c.channelId,
      niche:               c.niche,
      language:            c.language,
      duration_seconds:    c.durationSeconds,
      published_at:        c.publishedAt,
      views:               c.views,
      likes:               c.likes,
      comments:            c.comments,
      view_velocity:       c.viewVelocity,
      virality_score:      c.viralityScore,
      raw_payload:         { discovered_via: 'yt-discovery' },
    })))
    if (error) log.error('Insert viral_opportunities faalde', { error: error.message })
    else opportunities = fresh.length
  }

  // nieuwe kanalen -> competitor_channels (volglijst-scraper verrijkt ze later)
  const channelIds = [...new Set(candidates.map((c) => c.channelId).filter(Boolean) as string[])]
  let channels = 0
  if (channelIds.length) {
    const { data: existingCh } = await db
      .from('competitor_channels')
      .select('external_id')
      .eq('platform', 'youtube')
      .in('external_id', channelIds)
    const knownCh = new Set((existingCh ?? []).map((r) => r.external_id))
    const newCh = candidates.filter((c) => c.channelId && !knownCh.has(c.channelId))
    const seen = new Set<string>()
    const rows = newCh.filter((c) => { if (seen.has(c.channelId!)) return false; seen.add(c.channelId!); return true })
      .map((c) => ({
        platform: 'youtube', external_id: c.channelId!, name: c.channelName,
        niche: c.niche, language: c.language, active: true,
      }))
    if (rows.length) {
      const { error } = await db.from('competitor_channels').insert(rows)
      if (error) log.error('Insert competitor_channels faalde', { error: error.message })
      else channels = rows.length
    }
  }

  return { opportunities, channels }
}

async function runCycle(): Promise<void> {
  const db = getSupabase()
  const t0 = Date.now()
  const { data: runRow } = await db.from('scraper_runs')
    .insert({ source: 'youtube_discovery', status: 'running', started_at: new Date().toISOString() })
    .select('id').maybeSingle()
  const runId = runRow?.id as string | undefined

  try {
    const scored = await discover()
    const { opportunities, channels } = await persist(scored)
    if (runId) {
      await db.from('scraper_runs').update({
        status: 'success', finished_at: new Date().toISOString(),
        duration_ms: Date.now() - t0, records_found: scored.length, records_new: opportunities,
      }).eq('id', runId)
    }
    log.info('Discovery klaar', { gescoord: scored.length, kansen: opportunities, nieuwe_kanalen: channels })
  } catch (err) {
    const msg = (err as Error).message
    if (runId) {
      await db.from('scraper_runs').update({
        status: 'error', finished_at: new Date().toISOString(), error_msg: msg,
      }).eq('id', runId)
    }
    log.error('Discovery faalde', { error: msg })
  }
}

async function main() {
  if (process.argv.includes('--once')) { await runCycle(); process.exit(0) }
  log.info('Lokale YouTube discovery gestart — dagploeg 06:30 NL', { maxSearches: MAX_SEARCHES })
  cron.schedule('30 6 * * *', () => {
    runCycle().catch((e) => log.error('cron-run faalde', { error: (e as Error).message }))
  })
  runCycle().catch((e) => log.error('startup-run faalde', { error: (e as Error).message }))
}

main().catch((e) => { log.error('fatale startfout', { error: (e as Error).message }); process.exit(1) })
