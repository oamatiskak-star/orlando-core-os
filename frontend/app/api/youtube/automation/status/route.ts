import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const today = new Date().toISOString().slice(0, 10)

  const [slotsRes, recentRes, channelsRes] = await Promise.all([
    // All today's slots
    supabase
      .from('youtube_upload_queue')
      .select('id, title, status, scheduled_publish_at, channel_id, youtube_video_id, youtube_url, last_error, retry_count, upload_started_at, upload_finished_at')
      .gte('scheduled_publish_at', `${today}T00:00:00`)
      .lte('scheduled_publish_at', `${today}T23:59:59`)
      .order('scheduled_publish_at'),

    // Last 8 uploaded videos
    supabase
      .from('youtube_videos')
      .select('id, title, youtube_video_id, thumbnail_url, is_short, published_at, channel_id')
      .order('published_at', { ascending: false })
      .limit(8),

    // Channel names + status
    supabase
      .from('youtube_channels')
      .select('id, name, oauth_status, last_upload_at'),
  ])

  const slots = slotsRes.data ?? []
  const channels = channelsRes.data ?? []
  const idToChannel: Record<string, string> = {}
  for (const ch of channels) idToChannel[ch.id] = ch.name

  // Per-channel stats for today
  const channelStats: Record<string, { name: string; uploaded: number; planned: number; failed: number; uploading: number }> = {}
  for (const slot of slots) {
    const name = idToChannel[slot.channel_id] ?? slot.channel_id
    if (!channelStats[name]) channelStats[name] = { name, uploaded: 0, planned: 0, failed: 0, uploading: 0 }
    const st = slot.status
    if (st === 'uploaded' || st === 'verified_live') channelStats[name].uploaded++
    else if (st === 'planned') channelStats[name].planned++
    else if (st === 'failed') channelStats[name].failed++
    else channelStats[name].uploading++
  }

  // Daemon health: look for any slot updated (upload_started_at) within last 10 minutes
  const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString()
  const daemonActive = slots.some(s => s.upload_started_at && s.upload_started_at > tenMinAgo)

  // Last daemon activity
  const lastActivity = slots
    .filter(s => s.upload_started_at)
    .sort((a, b) => (b.upload_started_at ?? '').localeCompare(a.upload_started_at ?? ''))[0]
    ?.upload_started_at ?? null

  return NextResponse.json({
    slots: slots.map(s => ({ ...s, channel_name: idToChannel[s.channel_id] ?? '?' })),
    channelStats: Object.values(channelStats),
    recentUploads: (recentRes.data ?? []).map(v => ({
      ...v,
      channel_name: idToChannel[v.channel_id] ?? '?',
    })),
    daemon: { active: daemonActive, lastActivity },
    channels: channels.map(ch => ({
      id: ch.id, name: ch.name,
      oauth_status: ch.oauth_status,
      last_upload_at: ch.last_upload_at,
    })),
  })
}
