import { getSupabase } from '../lib/supabase'
import { workerLogger } from '../lib/logger'
import {
  fetchChannelInfo, fetchRecentUploads, fetchVideoStats, PublicVideoInfo,
} from '../lib/youtube-public-api'
import { detectSignals } from './signal-detector'

const log = workerLogger('competitor-scanner')

export interface CompetitorRow {
  id: string
  platform: string
  external_id: string
  name: string
  niche: string | null
  language: string | null
  watch_reason: string        // 'competitor' | 'viral_radar' | 'inactive'
  subscriber_count: number
  video_count: number
  total_view_count: number
  last_scanned_at: string | null
}

export interface ScanResult {
  competitor_id: string
  videos_seen: number
  videos_new: number
  signals_emitted: number
  error?: string
}

const RECENT_UPLOAD_WINDOW = 25 // hoeveel recente uploads per scan inspecteren

export async function scanCompetitor(c: CompetitorRow): Promise<ScanResult> {
  const db = getSupabase()
  log.info('Scanning', { name: c.name, external_id: c.external_id, platform: c.platform })

  if (c.platform !== 'youtube') {
    return { competitor_id: c.id, videos_seen: 0, videos_new: 0, signals_emitted: 0, error: `unsupported_platform:${c.platform}` }
  }

  // 1) Channel metadata refresh
  const channelInfo = await fetchChannelInfo(c.external_id)
  if (!channelInfo) {
    log.warn('Channel niet gevonden via API', { external_id: c.external_id })
    return { competitor_id: c.id, videos_seen: 0, videos_new: 0, signals_emitted: 0, error: 'channel_not_found' }
  }

  const prevSubs = c.subscriber_count
  await db.from('competitor_channels').update({
    name:             channelInfo.title,
    handle:           channelInfo.customUrl,
    thumbnail_url:    channelInfo.thumbnailUrl,
    subscriber_count: channelInfo.subscriberCount,
    video_count:      channelInfo.videoCount,
    total_view_count: channelInfo.viewCount,
    last_scanned_at:  new Date().toISOString(),
    updated_at:       new Date().toISOString(),
  }).eq('id', c.id)

  if (!channelInfo.uploadsPlaylistId) {
    log.warn('Geen uploads playlist', { external_id: c.external_id })
    return { competitor_id: c.id, videos_seen: 0, videos_new: 0, signals_emitted: 0, error: 'no_uploads_playlist' }
  }

  // 2) Recente uploads ophalen + stats
  const recent = await fetchRecentUploads(channelInfo.uploadsPlaylistId, RECENT_UPLOAD_WINDOW)
  if (recent.length === 0) {
    return { competitor_id: c.id, videos_seen: 0, videos_new: 0, signals_emitted: 0 }
  }
  const stats = await fetchVideoStats(recent.map((r) => r.videoId))

  // 3) Bestaande rows ophalen om te bepalen wat nieuw is
  const { data: existingRows } = await db
    .from('competitor_videos')
    .select('id, platform_video_id, views, likes, comments, published_at')
    .eq('competitor_id', c.id)
    .in('platform_video_id', stats.map((s) => s.id))

  const existingByVid = new Map((existingRows ?? []).map((r) => [r.platform_video_id, r]))

  let newCount = 0
  const upsertRows = stats.map((v) => {
    const isNew = !existingByVid.has(v.id)
    if (isNew) newCount++
    return {
      competitor_id:     c.id,
      platform_video_id: v.id,
      title:             v.title,
      url:               `https://www.youtube.com/watch?v=${v.id}`,
      thumbnail_url:     v.thumbnailUrl,
      format:            inferFormat(v),
      duration_seconds:  v.durationSeconds,
      published_at:      v.publishedAt,
      views:             v.views,
      likes:             v.likes,
      comments:          v.comments,
      view_velocity:     calcViewVelocity(v),
      is_viral_spike:    false, // signal detector zet dit
      updated_at:        new Date().toISOString(),
    }
  })

  if (upsertRows.length) {
    const { error } = await db
      .from('competitor_videos')
      .upsert(upsertRows, { onConflict: 'competitor_id,platform_video_id' })
    if (error) {
      log.error('Upsert competitor_videos faalde', { error: error.message })
      return { competitor_id: c.id, videos_seen: stats.length, videos_new: newCount, signals_emitted: 0, error: error.message }
    }
  }

  // 4) Signal detectie op de actuele dataset
  const signalsEmitted = await detectSignals({
    competitor:    c,
    channelInfo:   { subscriberCount: channelInfo.subscriberCount, prevSubscriberCount: prevSubs },
    currentVideos: stats,
    previousViews: existingByVid,
  })

  log.info('Scan klaar', {
    name: c.name, videos_seen: stats.length, new: newCount, signals: signalsEmitted,
  })

  return {
    competitor_id:   c.id,
    videos_seen:     stats.length,
    videos_new:      newCount,
    signals_emitted: signalsEmitted,
  }
}

function calcViewVelocity(v: PublicVideoInfo): number {
  if (!v.publishedAt) return 0
  const hours = Math.max(1, (Date.now() - new Date(v.publishedAt).getTime()) / 3_600_000)
  return Number((v.views / hours).toFixed(2))
}

function inferFormat(v: PublicVideoInfo): 'short' | 'long' | 'unknown' {
  if (v.isShort) return 'short'
  if (v.durationSeconds >= 60) return 'long'
  return 'unknown'
}
