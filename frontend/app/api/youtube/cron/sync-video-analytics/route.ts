import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { reportHeartbeat } from '@/lib/watchdog/heartbeat'

// How many days of analytics to fetch per run
const ANALYTICS_WINDOW_DAYS = 7

async function refreshTokenIfNeeded(admin: ReturnType<typeof createAdminClient>, ch: {
  id: string; access_token: string | null; token_expires: string | null; refresh_token: string | null
  oauth_client_id: string | null; oauth_client_secret: string | null
}): Promise<string | null> {
  if (!ch.token_expires || new Date(ch.token_expires) > new Date(Date.now() + 60_000)) {
    return ch.access_token
  }
  const clientId     = ch.oauth_client_id     ?? process.env.YOUTUBE_CLIENT_ID!
  const clientSecret = ch.oauth_client_secret ?? process.env.YOUTUBE_CLIENT_SECRET!
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: ch.refresh_token!, grant_type: 'refresh_token' }),
  })
  if (!res.ok) return ch.access_token
  const { access_token, expires_in } = await res.json()
  const token_expires = new Date(Date.now() + (expires_in ?? 3600) * 1000).toISOString()
  await admin.from('youtube_channels').update({ access_token, token_expires, oauth_status: 'connected', oauth_connected: true }).eq('id', ch.id)
  return access_token
}

async function getChannelVideos(token: string, channelId: string, maxResults = 50): Promise<{ id: string; title: string }[]> {
  const res = await fetch(
    `https://www.googleapis.com/youtube/v3/search?part=id,snippet&channelId=${channelId}&type=video&order=date&maxResults=${maxResults}`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  if (!res.ok) return []
  const data = await res.json()
  return (data.items ?? []).map((item: any) => ({
    id:    item.id?.videoId ?? '',
    title: item.snippet?.title ?? '',
  })).filter((v: { id: string }) => v.id)
}

async function getVideoAnalytics(
  token: string,
  ytChannelId: string,
  videoIds: string[],
  startDate: string,
  endDate: string
): Promise<Record<string, { views: number; watch_time_minutes: number; avg_view_percentage: number; likes: number; comments: number; ctr: number; impressions: number; estimated_revenue: number }>> {
  if (!videoIds.length) return {}

  const url = new URL('https://youtubeanalytics.googleapis.com/v2/reports')
  url.searchParams.set('ids', `channel==${ytChannelId}`)
  url.searchParams.set('startDate', startDate)
  url.searchParams.set('endDate', endDate)
  // NB: 'impressions' is geen geldige identifier voor het video-report (geeft 400),
  // 'estimatedRevenue' vereist de yt-analytics-monetary.readonly scope en
  // 'annotationClickThroughRate' is gedepreceerd. Daarom alleen de core-metrics.
  // ctr/impressions/estimated_revenue worden via een aparte report-call gevuld (TODO).
  url.searchParams.set('metrics', 'views,estimatedMinutesWatched,averageViewPercentage,likes,comments')
  url.searchParams.set('dimensions', 'video')
  url.searchParams.set('filters', `video==${videoIds.join(',')}`)
  url.searchParams.set('maxResults', '200')

  const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) {
    console.warn('Analytics API error:', res.status, await res.text().catch(() => ''))
    return {}
  }

  const data = await res.json()
  const result: Record<string, any> = {}

  for (const row of data.rows ?? []) {
    // Volgorde matcht de metrics-string hierboven: views, estimatedMinutesWatched,
    // averageViewPercentage, likes, comments.
    const [videoId, views, watchMin, avgPct, likes, comments] = row
    result[videoId] = {
      views:               Math.round(views ?? 0),
      watch_time_minutes:  Number((watchMin ?? 0).toFixed(2)),
      avg_view_percentage: Number((avgPct ?? 0).toFixed(2)),
      likes:               Math.round(likes ?? 0),
      comments:            Math.round(comments ?? 0),
      ctr:                 0,
      impressions:         0,
      estimated_revenue:   0,
    }
  }

  return result
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin  = createAdminClient()
  const today  = new Date().toISOString().split('T')[0]
  const start  = new Date(Date.now() - ANALYTICS_WINDOW_DAYS * 86400_000).toISOString().split('T')[0]

  const { data: channels } = await admin
    .from('youtube_channels')
    .select('id, naam, channel_id, access_token, refresh_token, token_expires, oauth_status, oauth_client_id, oauth_client_secret')
    .eq('oauth_status', 'connected')
    .not('refresh_token', 'is', null)
    .not('channel_id', 'is', null)

  if (!channels?.length) {
    return NextResponse.json({ message: 'No connected channels', processed: 0 })
  }

  const results: { naam: string; status: string; videos?: number }[] = []

  for (const ch of channels) {
    try {
      const token = await refreshTokenIfNeeded(admin, ch)
      if (!token || !ch.channel_id) {
        results.push({ naam: ch.naam, status: 'skipped_no_token' })
        continue
      }

      // Get recent videos
      const videos = await getChannelVideos(token, ch.channel_id, 50)
      if (!videos.length) {
        results.push({ naam: ch.naam, status: 'no_videos', videos: 0 })
        continue
      }

      const ytVideoIds = videos.map(v => v.id)

      // Get or create youtube_videos records
      const { data: dbVideos } = await admin
        .from('youtube_videos')
        .select('id, youtube_video_id')
        .eq('channel_id', ch.id)
        .in('youtube_video_id', ytVideoIds)

      // Also check by video_id (which stores the YouTube video string ID)
      const { data: dbVideosByVidId } = await admin
        .from('youtube_videos')
        .select('id, video_id, youtube_video_id')
        .eq('channel_id', ch.id)
        .in('video_id', ytVideoIds)

      const videoIdMap: Record<string, string> = {}
      for (const v of dbVideos ?? []) {
        if (v.youtube_video_id) videoIdMap[v.youtube_video_id] = v.id
      }
      for (const v of dbVideosByVidId ?? []) {
        videoIdMap[v.video_id] = v.id
        if (v.youtube_video_id) videoIdMap[v.youtube_video_id] = v.id
      }

      // Upsert missing videos — video_id (NOT NULL UNIQUE) = YouTube video string ID
      const missing = videos.filter(v => !videoIdMap[v.id])
      if (missing.length) {
        const { data: inserted } = await admin
          .from('youtube_videos')
          .upsert(
            missing.map(v => ({
              channel_id:       ch.id,
              video_id:         v.id,   // NOT NULL UNIQUE — use YouTube video ID
              youtube_video_id: v.id,
              title:            v.title || 'Untitled',
              status:           'published',
            })),
            { onConflict: 'video_id', ignoreDuplicates: true }
          )
          .select('id, video_id')
        for (const v of inserted ?? []) {
          videoIdMap[v.video_id] = v.id
        }
      }

      // Fetch analytics
      const analytics = await getVideoAnalytics(token, ch.channel_id, ytVideoIds, start, today)

      // Upsert to youtube_video_analytics
      const upserts = []
      for (const [ytVidId, stats] of Object.entries(analytics)) {
        const dbVidId = videoIdMap[ytVidId]
        if (!dbVidId) continue
        upserts.push({
          video_id:            dbVidId,
          channel_id:          ch.id,
          date:                today,
          recorded_at:         new Date().toISOString(),
          youtube_video_id:    ytVidId,
          views:               stats.views,
          watch_time_min:      stats.watch_time_minutes,
          watch_time_minutes:  stats.watch_time_minutes,
          avg_view_pct:        stats.avg_view_percentage,
          avg_view_percentage: stats.avg_view_percentage,
          likes:               stats.likes,
          comments:            stats.comments,
          ctr:                 stats.ctr,
          impressions:         stats.impressions,
          estimated_revenue:   stats.estimated_revenue,
        })
      }

      if (upserts.length) {
        await admin
          .from('youtube_video_analytics')
          .upsert(upserts, { onConflict: 'video_id,date' })
      }

      results.push({ naam: ch.naam, status: 'ok', videos: upserts.length })
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      results.push({ naam: ch.naam, status: `error: ${msg}` })
    }
  }

  const ok = results.filter(r => r.status === 'ok').length
  console.log(`Video analytics sync: ${ok}/${channels.length} channels`, results)

  // Dedup controle na elke live-sync
  let dedupResult: Record<string, unknown> = {}
  try {
    const base = process.env.NEXT_PUBLIC_APP_URL
    const dr = await fetch(`${base}/api/youtube/dedup`, { method: 'POST' })
    dedupResult = await dr.json().catch(() => ({}))
    if ((dedupResult.duplicates_found as number) > 0) {
      console.warn(`[DEDUP] ${dedupResult.duplicates_found} duplicaten gevonden en gearchiveerd`, dedupResult.results)
    }
  } catch (e) {
    console.error('[DEDUP] fout tijdens dedup controle:', e)
  }

  await reportHeartbeat('cron.vercel.sync-video-analytics').catch(() => {}) /* watchdog-heartbeat */

  return NextResponse.json({ ok, total: channels.length, results, dedup: dedupResult })
}
