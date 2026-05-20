import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const revalidate = 0
export const maxDuration = 60

// Bridge: youtube_channels + youtube_videos → media_holding_metrics snapshot.
// Schrijft per OAuth-verbonden kanaal één rij per run (channel-aggregaat) en,
// indien beschikbaar, ook per-video rijen. Schedule via vercel.json (*/30 min).
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startedAt = Date.now()
  const admin = createAdminClient()

  const { data: linked, error: linkErr } = await admin
    .from('media_holding_channels')
    .select('id, name, youtube_channel_id')
    .not('youtube_channel_id', 'is', null)
  if (linkErr) return NextResponse.json({ error: linkErr.message }, { status: 500 })
  if (!linked || linked.length === 0) {
    return NextResponse.json({ channels_synced: 0, video_rows: 0, ms: Date.now() - startedAt })
  }

  const ytIds = linked.map(l => l.youtube_channel_id as string)
  const { data: ytChannels } = await admin
    .from('youtube_channels')
    .select('id, name, view_count, subscriber_count, video_count')
    .in('id', ytIds)
  const ytMap = new Map<string, { view_count: number; subscriber_count: number; video_count: number }>()
  for (const c of ytChannels ?? []) {
    ytMap.set(c.id as string, {
      view_count: Number(c.view_count ?? 0),
      subscriber_count: Number(c.subscriber_count ?? 0),
      video_count: Number(c.video_count ?? 0),
    })
  }

  const now = new Date().toISOString()
  const channelRows = linked
    .map(l => {
      const yt = ytMap.get(l.youtube_channel_id as string)
      if (!yt) return null
      return {
        channel_id: l.id,
        youtube_video_id: null,
        platform: 'youtube',
        snapshot_at: now,
        views: yt.view_count,
        likes: 0,
        comments: 0,
        shares: 0,
        retention_pct: 0,
        ctr_pct: 0,
        revenue: 0,
      }
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)

  let channelsSynced = 0
  if (channelRows.length > 0) {
    const { error } = await admin.from('media_holding_metrics').insert(channelRows)
    if (error) {
      return NextResponse.json({ error: `channel snapshot insert failed: ${error.message}` }, { status: 500 })
    }
    channelsSynced = channelRows.length
  }

  const { data: videos } = await admin
    .from('youtube_videos')
    .select('youtube_video_id, channel_id, views, likes, comments, retention, ctr, estimated_revenue, revenue, updated_at')
    .in('channel_id', ytIds)
    .or('views.gt.0,likes.gt.0,comments.gt.0')
    .limit(500)

  const ytChannelToMh = new Map<string, string>()
  for (const l of linked) ytChannelToMh.set(l.youtube_channel_id as string, l.id as string)

  const videoRows = (videos ?? [])
    .filter(v => v.youtube_video_id && v.channel_id && ytChannelToMh.has(v.channel_id as string))
    .map(v => ({
      channel_id: ytChannelToMh.get(v.channel_id as string)!,
      youtube_video_id: v.youtube_video_id as string,
      platform: 'youtube',
      snapshot_at: now,
      views: Number(v.views ?? 0),
      likes: Number(v.likes ?? 0),
      comments: Number(v.comments ?? 0),
      shares: 0,
      retention_pct: Number(v.retention ?? 0),
      ctr_pct: Number(v.ctr ?? 0),
      revenue: Number(v.estimated_revenue ?? v.revenue ?? 0),
    }))

  let videoSynced = 0
  if (videoRows.length > 0) {
    const { error } = await admin.from('media_holding_metrics').insert(videoRows)
    if (error) {
      return NextResponse.json({
        error: `video snapshot insert failed: ${error.message}`,
        channels_synced: channelsSynced,
      }, { status: 500 })
    }
    videoSynced = videoRows.length
  }

  return NextResponse.json({
    channels_synced: channelsSynced,
    video_rows: videoSynced,
    snapshot_at: now,
    ms: Date.now() - startedAt,
  })
}
