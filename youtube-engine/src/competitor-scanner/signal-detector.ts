import { getSupabase } from '../lib/supabase'
import { workerLogger } from '../lib/logger'
import { PublicVideoInfo } from '../lib/youtube-public-api'
import { CompetitorRow } from './scanner'

const log = workerLogger('signal-detector')

// ─────────────────────────────────────────────────────────────────────────────
// Detecteert 5 signaal types op basis van actuele scan + history:
//   viral_spike   — video view_velocity > 5× kanaal-mediaan (laatste 14d)
//   upload_burst  — uploads_24h > 3   óf > 2× normale rate
//   sub_surge     — subscriber delta > max(1000, 5% * vorige)
//   format_shift  — eerste 'long' op kanaal dat 80%+ shorts deed (of vv.)
//   dormant       — laatste upload > 7d  én historisch ≥ 3 uploads/week
//
// De detector dedupliceert: identieke (signal_type, competitor_id, video_id)
// die al open staat wordt niet opnieuw aangemaakt.
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

const SPIKE_MULTIPLIER     = 5     // velocity > 5× median
const UPLOAD_BURST_ABS     = 4     // ≥4 uploads/24h direct signaal
const UPLOAD_BURST_RATIO   = 2     // óf 2× normale daily rate
const SUB_SURGE_MIN_ABS    = 1_000
const SUB_SURGE_MIN_PCT    = 0.05
const FORMAT_MIN_HISTORY   = 10    // minstens 10 vorige uploads voor format_shift
const FORMAT_DOMINANCE     = 0.8   // 80% dominant
const DORMANT_DAYS         = 7
const DORMANT_MIN_HIST_W   = 3     // historisch ≥3 uploads/week
const HISTORY_WINDOW_DAYS  = 14

export async function detectSignals(input: DetectInput): Promise<number> {
  const db = getSupabase()
  const { competitor: c, channelInfo, currentVideos, previousViews } = input

  // Open signals ophalen — voor deduplicatie
  const { data: openSignalsRaw } = await db
    .from('competitor_signals')
    .select('id, signal_type, video_id')
    .eq('competitor_id', c.id)
    .is('acknowledged_at', null)
  const openSignals = openSignalsRaw ?? []

  const isOpen = (type: string, videoUuid?: string | null) =>
    openSignals.some((s) => s.signal_type === type && (s.video_id ?? null) === (videoUuid ?? null))

  const out: Array<{
    competitor_id: string; signal_type: string; magnitude: number;
    video_id?: string | null; notes: string; metadata: Record<string, unknown>
  }> = []

  // ── 1. viral_spike ────────────────────────────────────────────────────────
  // Mediaan van view_velocity over laatste 14d uploads
  const fourteenDaysAgo = Date.now() - HISTORY_WINDOW_DAYS * 86_400_000
  const recentForMedian = currentVideos.filter(
    (v) => v.publishedAt && new Date(v.publishedAt).getTime() > fourteenDaysAgo
  )
  const velocities = recentForMedian.map(velocity).sort((a, b) => a - b)
  const median = velocities.length ? velocities[Math.floor(velocities.length / 2)] : 0
  const spikeThreshold = Math.max(median * SPIKE_MULTIPLIER, 1)

  // Resolve video UUIDs voor signals
  const { data: videoRowsRaw } = await db
    .from('competitor_videos')
    .select('id, platform_video_id')
    .eq('competitor_id', c.id)
    .in('platform_video_id', currentVideos.map((v) => v.id))
  const videoUuidByExt = new Map((videoRowsRaw ?? []).map((r) => [r.platform_video_id, r.id]))

  for (const v of currentVideos) {
    const vel = velocity(v)
    if (vel >= spikeThreshold && vel > 50) { // min absolute floor: 50 views/uur
      const videoUuid = videoUuidByExt.get(v.id) ?? null
      if (!isOpen('viral_spike', videoUuid)) {
        out.push({
          competitor_id: c.id,
          signal_type:   'viral_spike',
          magnitude:     Number((vel / Math.max(median, 1)).toFixed(2)),
          video_id:      videoUuid,
          notes:         `"${truncate(v.title, 70)}" → ${Math.round(vel)} views/u (median ${Math.round(median)})`,
          metadata:      { velocity: vel, median, views: v.views, multiplier: vel / Math.max(median, 1) },
        })
        // Markeer video als viral_spike in tabel
        if (videoUuid) {
          await db.from('competitor_videos').update({ is_viral_spike: true }).eq('id', videoUuid)
        }
      }
    }
  }

  // ── 2. upload_burst ───────────────────────────────────────────────────────
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
    })
  }

  // ── 3. sub_surge ──────────────────────────────────────────────────────────
  const delta = channelInfo.subscriberCount - (channelInfo.prevSubscriberCount ?? 0)
  const pctDelta = channelInfo.prevSubscriberCount > 0 ? delta / channelInfo.prevSubscriberCount : 0
  if (delta >= SUB_SURGE_MIN_ABS && pctDelta >= SUB_SURGE_MIN_PCT && !isOpen('sub_surge', null)) {
    out.push({
      competitor_id: c.id,
      signal_type:   'sub_surge',
      magnitude:     Number((pctDelta * 100).toFixed(2)),
      notes:         `+${delta} subs (${(pctDelta * 100).toFixed(1)}%) sinds vorige scan`,
      metadata:      { delta, prev: channelInfo.prevSubscriberCount, now: channelInfo.subscriberCount },
    })
  }

  // ── 4. format_shift ───────────────────────────────────────────────────────
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
      })
    }
  }

  // ── 5. dormant ────────────────────────────────────────────────────────────
  // Laatste upload >7d geleden EN historisch ≥3 uploads/week (op basis van 14d)
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
    })
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
