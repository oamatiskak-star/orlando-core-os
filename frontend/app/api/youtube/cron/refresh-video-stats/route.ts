import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const revalidate = 0
export const maxDuration = 60

// Efficient per-video stats refresh via youtube.videos.list?part=statistics.
// Kosten: 1 quota-unit per call, batch van 50 video-IDs.
//
// 11 channels × ~50 recent videos = ~500 videos = 10 batches = 10 units/run.
// Bij */30 = 480 units/dag (4.8% van 10k quota). Veel goedkoper dan
// sync-video-analytics dat search gebruikt (100 units per channel per call).
//
// Schrijft views/likes/comments terug naar youtube_videos. Voor diepere
// analytics (retention, CTR, revenue) is de YouTube Analytics API nodig —
// dat blijft daily via sync-video-analytics totdat scopes zijn gefixt.

async function getAccessTokenForOauth(): Promise<string | null> {
  const apiKey = process.env.YOUTUBE_DATA_API_KEY
  if (apiKey) return apiKey
  return null
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startedAt = Date.now()
  const admin = createAdminClient()
  const apiKey = await getAccessTokenForOauth()
  if (!apiKey) {
    return NextResponse.json({ error: 'YOUTUBE_DATA_API_KEY env missing' }, { status: 500 })
  }

  const { data: videos, error: vErr } = await admin
    .from('youtube_videos')
    .select('id, channel_id, youtube_video_id, video_id, updated_at')
    .or('youtube_video_id.not.is.null,video_id.not.is.null')
    .order('updated_at', { ascending: true, nullsFirst: true })
    .limit(500)

  if (vErr) return NextResponse.json({ error: vErr.message }, { status: 500 })
  if (!videos || videos.length === 0) {
    return NextResponse.json({ videos_refreshed: 0, ms: Date.now() - startedAt })
  }

  const idMap = new Map<string, string>()
  for (const v of videos) {
    const ytId = (v.youtube_video_id ?? v.video_id) as string | null
    if (ytId) idMap.set(ytId, v.id as string)
  }

  const ytIds = Array.from(idMap.keys())
  let totalUpdated = 0
  let quotaUnitsUsed = 0
  const errors: string[] = []

  for (let i = 0; i < ytIds.length; i += 50) {
    const batch = ytIds.slice(i, i + 50)
    const url = new URL('https://www.googleapis.com/youtube/v3/videos')
    url.searchParams.set('part', 'statistics')
    url.searchParams.set('id', batch.join(','))
    url.searchParams.set('key', apiKey)
    url.searchParams.set('maxResults', '50')

    const res = await fetch(url.toString())
    quotaUnitsUsed += 1
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      errors.push(`batch ${i}: HTTP ${res.status} — ${body.slice(0, 200)}`)
      if (res.status === 403) break
      continue
    }

    const data = await res.json() as { items?: Array<{ id: string; statistics?: { viewCount?: string; likeCount?: string; commentCount?: string } }> }
    const updates = (data.items ?? []).map(item => {
      const dbId = idMap.get(item.id)
      if (!dbId) return null
      return {
        id: dbId,
        views: parseInt(item.statistics?.viewCount ?? '0', 10),
        likes: parseInt(item.statistics?.likeCount ?? '0', 10),
        comments: parseInt(item.statistics?.commentCount ?? '0', 10),
        updated_at: new Date().toISOString(),
      }
    }).filter((u): u is NonNullable<typeof u> => u !== null)

    for (const u of updates) {
      const { error: upErr } = await admin
        .from('youtube_videos')
        .update({ views: u.views, likes: u.likes, comments: u.comments, updated_at: u.updated_at })
        .eq('id', u.id)
      if (!upErr) totalUpdated += 1
    }
  }

  return NextResponse.json({
    videos_in_batch: ytIds.length,
    videos_refreshed: totalUpdated,
    quota_units_used: quotaUnitsUsed,
    errors: errors.slice(0, 5),
    ms: Date.now() - startedAt,
  })
}
