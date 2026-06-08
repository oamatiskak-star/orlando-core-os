import { getSupabase } from '../lib/supabase'
import { workerLogger } from '../lib/logger'
import { PublicVideoInfo } from '../lib/youtube-public-api'
import { CompetitorRow } from './scanner'

const log = workerLogger('signal-detector')

// ─────────────────────────────────────────────────────────────────────────────
// Detecteert signaal-types op basis van actuele scan + history. De drempels zijn
// GROEP-AFHANKELIJK (competitor_channels.watch_reason):
//
//   competitor  → benchmark-signalen. viral_spike pas bij 3× de EIGEN mediaan
//                 (en genoeg history), plus upload_burst / sub_surge / format_shift /
//                 dormant. signal_relevance = 'benchmark'.
//   viral_radar → brede money/lifestyle-kanalen. Geen cadans-benchmark; we vangen
//                 alleen écht grote format-winnaars: absoluut ≥500 views/u óf
//                 ≥100k views binnen 72u, plus format_shift. Titels worden op
//                 NL viral-hookwoorden geparset. signal_relevance = 'format_only'.
//
// Zo verdrinken de echte concurrent-signalen niet meer in lage-baseline-ruis van
// brede kanalen (zie migratie 135). De detector dedupliceert open signals per
// (signal_type, competitor_id, video_id).
// ─────────────────────────────────────────────────────────────────────────────

interface ExistingVideo {
  id: string
  platform_video_id: string
  views: number
  likes: number
  comments: number
  published_at: string | null
}

interface DetectInput {
  competitor: CompetitorRow
  channelInfo: { subscriberCount: number; prevSubscriberCount: number }
  currentVideos: PublicVideoInfo[]
  previousViews: Map<string, ExistingVideo>
}

// Competitor-drempels (relatief — t.o.v. eigen mediaan)
const COMP_SPIKE_MULTIPLIER = 3     // velocity > 3× eigen mediaan
const COMP_SPIKE_FLOOR      = 50    // min absolute floor: 50 views/uur
const COMP_MIN_HISTORY      = 5     // genoeg recente uploads voor een betrouwbare mediaan

// Viral-radar-drempels (absoluut — deze kanalen hebben hoge baselines)
const RADAR_ABS_VELOCITY    = 500       // ≥500 views/uur
const RADAR_BIG_VIEWS       = 100_000   // óf ≥100k views...
const RADAR_BIG_HOURS       = 72        // ...binnen 72 uur

const UPLOAD_BURST_ABS      = 4     // ≥4 uploads/24h direct signaal
const UPLOAD_BURST_RATIO    = 2     // óf 2× normale daily rate
const SUB_SURGE_MIN_ABS     = 1_000
const SUB_SURGE_MIN_PCT     = 0.05
const FORMAT_MIN_HISTORY    = 10    // minstens 10 vorige uploads voor format_shift
const FORMAT_DOMINANCE      = 0.8   // 80% dominant
const DORMANT_DAYS          = 7
const DORMANT_MIN_HIST_W    = 3     // historisch ≥3 uploads/week
const HISTORY_WINDOW_DAYS   = 14

// NL viral-hookwoorden — markeert wélke trigger een viral-radar-video gebruikt.
const HOOK_WORDS = [
  'ik testte', 'ik probeerde', 'wat gebeurt er als', 'nep', '24 uur', '24u',
  'hoeveel kost', 'geheim', 'niemand weet', 'van 0 naar', 'van €0', '€0',
  'scam', 'illegaal', 'rijk worden', 'challenge', 'dit moet je', 'waarom',
]

type SignalRelevance = 'benchmark' | 'format_only' | 'noise'

interface OutSignal {
  competitor_id: string
  signal_type: string
  magnitude: number
  video_id?: string | null
  notes: string
  metadata: Record<string, unknown>
  signal_relevance: SignalRelevance
}

export async function detectSignals(input: DetectInput): Promise<number> {
  const db = getSupabase()
  const { competitor: c, channelInfo, currentVideos, previousViews } = input

  // Groep bepalen — stuurt drempels + relevance.
  const reason = c.watch_reason ?? 'competitor'
  if (reason === 'inactive') return 0
  const isRadar = reason === 'viral_radar'
  const relevance: SignalRelevance = isRadar ? 'format_only' : 'benchmark'

  // Open signals ophalen — voor deduplicatie
  const { data: openSignalsRaw } = await db
    .from('competitor_signals')
    .select('id, signal_type, video_id')
    .eq('competitor_id', c.id)
    .is('acknowledged_at', null)
  const openSignals = openSignalsRaw ?? []

  const isOpen = (type: string, videoUuid?: string | null) =>
    openSignals.some((s) => s.signal_type === type && (s.video_id ?? null) === (videoUuid ?? null))

  const out: OutSignal[] = []

  // Mediaan van view_velocity over laatste 14d uploads
  const fourteenDaysAgo = Date.now() - HISTORY_WINDOW_DAYS * 86_400_000
  const recentForMedian = currentVideos.filter(
    (v) => v.publishedAt && new Date(v.publishedAt).getTime() > fourteenDaysAgo
  )
  const velocities = recentForMedian.map(velocity).sort((a, b) => a - b)
  const median = velocities.length ? velocities[Math.floor(velocities.length / 2)] : 0
  const compSpikeThreshold = Math.max(median * COMP_SPIKE_MULTIPLIER, 1)

  // Resolve video UUIDs voor signals
  const { data: videoRowsRaw } = await db
    .from('competitor_videos')
    .select('id, platform_video_id')
    .eq('competitor_id', c.id)
    .in('platform_video_id', currentVideos.map((v) => v.id))
  const videoUuidByExt = new Map((videoRowsRaw ?? []).map((r) => [r.platform_video_id, r.id]))

  // ── 1. viral_spike ──────────────────────────────────────────────────────────
  for (const v of currentVideos) {
    const vel = velocity(v)
    const ageHours = v.publishedAt ? (Date.now() - new Date(v.publishedAt).getTime()) / 3_600_000 : Infinity

    const fire = isRadar
      ? (vel >= RADAR_ABS_VELOCITY || (v.views >= RADAR_BIG_VIEWS && ageHours <= RADAR_BIG_HOURS))
      : (recentForMedian.length >= COMP_MIN_HISTORY && vel >= compSpikeThreshold && vel > COMP_SPIKE_FLOOR)

    if (!fire) continue
    const videoUuid = videoUuidByExt.get(v.id) ?? null
    if (isOpen('viral_spike', videoUuid)) continue

    const hooks = isRadar ? HOOK_WORDS.filter((w) => v.title.toLowerCase().includes(w)) : []
    out.push({
      competitor_id: c.id,
      signal_type:   'viral_spike',
      magnitude:     isRadar ? Number(vel.toFixed(1)) : Number((vel / Math.max(median, 1)).toFixed(2)),
      video_id:      videoUuid,
      notes:         isRadar
        ? `📡 "${truncate(v.title, 60)}" → ${Math.round(vel)} views/u${hooks.length ? ` · hooks: ${hooks.join(', ')}` : ''}`
        : `"${truncate(v.title, 70)}" → ${Math.round(vel)} views/u (median ${Math.round(median)})`,
      metadata:      {
        velocity: vel, median, views: v.views, age_hours: Math.round(ageHours),
        format: v.isShort ? 'short' : 'long', hooks,
      },
      signal_relevance: relevance,
    })
    if (videoUuid) {
      await db.from('competitor_videos').update({ is_viral_spike: true }).eq('id', videoUuid)
    }
  }

  // ── 2-3-5. cadans-signalen — alleen relevant als benchmark (concurrenten) ─────
  if (!isRadar) {
    // 2. upload_burst
    const dayAgo = Date.now() - 86_400_000
    const uploads24h = currentVideos.filter((v) => v.publishedAt && new Date(v.publishedAt).getTime() > dayAgo).length
    const uploads14d = recentForMedian.length
    const dailyAvg   = uploads14d / HISTORY_WINDOW_DAYS

    const burstByAbs   = uploads24h >= UPLOAD_BURST_ABS
    const burstByRatio = dailyAvg > 0 && uploads24h >= UPLOAD_BURST_RATIO * dailyAvg && uploads24h >= 2
    if ((burstByAbs || burstByRatio) && !isOpen('upload_burst', null)) {
      out.push({
        competitor_id: c.id,
        signal_type:   'upload_burst',
        magnitude:     dailyAvg > 0 ? Number((uploads24h / dailyAvg).toFixed(2)) : uploads24h,
        notes:         `${uploads24h} uploads in 24u (avg ${dailyAvg.toFixed(1)}/dag over 14d)`,
        metadata:      { uploads_24h: uploads24h, daily_avg: dailyAvg, uploads_14d: uploads14d },
        signal_relevance: 'benchmark',
      })
    }

    // 3. sub_surge
    const delta = channelInfo.subscriberCount - (channelInfo.prevSubscriberCount ?? 0)
    const pctDelta = channelInfo.prevSubscriberCount > 0 ? delta / channelInfo.prevSubscriberCount : 0
    if (delta >= SUB_SURGE_MIN_ABS && pctDelta >= SUB_SURGE_MIN_PCT && !isOpen('sub_surge', null)) {
      out.push({
        competitor_id: c.id,
        signal_type:   'sub_surge',
        magnitude:     Number((pctDelta * 100).toFixed(2)),
        notes:         `+${delta} subs (${(pctDelta * 100).toFixed(1)}%) sinds vorige scan`,
        metadata:      { delta, prev: channelInfo.prevSubscriberCount, now: channelInfo.subscriberCount },
        signal_relevance: 'benchmark',
      })
    }

    // 5. dormant — laatste upload >7d EN historisch ≥3 uploads/week
    const latestUpload = currentVideos.reduce<number>((max, v) => {
      const t = v.publishedAt ? new Date(v.publishedAt).getTime() : 0
      return t > max ? t : max
    }, 0)
    const daysSinceLatest = latestUpload > 0 ? (Date.now() - latestUpload) / 86_400_000 : Infinity
    const weeklyRate14d   = uploads14d / 2
    if (daysSinceLatest > DORMANT_DAYS && weeklyRate14d >= DORMANT_MIN_HIST_W && !isOpen('dormant', null)) {
      out.push({
        competitor_id: c.id,
        signal_type:   'dormant',
        magnitude:     Number(daysSinceLatest.toFixed(1)),
        notes:         `Geen upload sinds ${daysSinceLatest.toFixed(1)} dagen (historisch ${weeklyRate14d.toFixed(1)}/week)`,
        metadata:      { days_since: daysSinceLatest, historical_weekly: weeklyRate14d },
        signal_relevance: 'benchmark',
      })
    }
  }

  // ── 4. format_shift — format-intel, relevant voor BEIDE groepen ───────────────
  if (recentForMedian.length >= FORMAT_MIN_HISTORY) {
    const sortedByDate = [...recentForMedian].sort((a, b) =>
      new Date(b.publishedAt ?? 0).getTime() - new Date(a.publishedAt ?? 0).getTime()
    )
    const newest = sortedByDate[0]
    const historicalShortShare = sortedByDate.slice(1).filter((v) => v.isShort).length / (sortedByDate.length - 1)
    const switchedToLong  = !newest.isShort && historicalShortShare >= FORMAT_DOMINANCE
    const switchedToShort =  newest.isShort && (1 - historicalShortShare) >= FORMAT_DOMINANCE

    if ((switchedToLong || switchedToShort) && !isOpen('format_shift', null)) {
      const newestUuid = videoUuidByExt.get(newest.id) ?? null
      out.push({
        competitor_id: c.id,
        signal_type:   'format_shift',
        magnitude:     Number((historicalShortShare * 100).toFixed(1)),
        video_id:      newestUuid,
        notes:         switchedToLong
          ? `Kanaal was ${(historicalShortShare * 100).toFixed(0)}% shorts → nieuwste is LONG`
          : `Kanaal was ${((1 - historicalShortShare) * 100).toFixed(0)}% long → nieuwste is SHORT`,
        metadata:      { historical_short_share: historicalShortShare, new_format: newest.isShort ? 'short' : 'long' },
        signal_relevance: relevance,
      })
    }
  }

  // ── Persist ───────────────────────────────────────────────────────────────
  if (out.length === 0) return 0
  const { error } = await db.from('competitor_signals').insert(out)
  if (error) {
    log.error('Insert competitor_signals faalde', { error: error.message })
    return 0
  }
  return out.length
}

function velocity(v: PublicVideoInfo): number {
  if (!v.publishedAt) return 0
  const hours = Math.max(1, (Date.now() - new Date(v.publishedAt).getTime()) / 3_600_000)
  return v.views / hours
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + '…' : s
}
