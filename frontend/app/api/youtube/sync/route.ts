import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

async function refreshIfNeeded(admin: ReturnType<typeof createAdminClient>, ch: {
  id: string; access_token: string | null; token_expires: string | null; refresh_token: string | null
}) {
  if (!ch.token_expires) return ch.access_token
  if (new Date(ch.token_expires) > new Date(Date.now() + 60_000)) return ch.access_token

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     process.env.YOUTUBE_CLIENT_ID!,
      client_secret: process.env.YOUTUBE_CLIENT_SECRET!,
      refresh_token: ch.refresh_token!,
      grant_type:    'refresh_token',
    }),
  })
  if (!res.ok) {
    // Refresh failed — keep using current access_token if still potentially valid, don't wipe oauth_status
    console.warn(`Token refresh failed for ${ch.id}:`, await res.text())
    return ch.access_token
  }
  const { access_token, expires_in } = await res.json()
  const token_expires = new Date(Date.now() + (expires_in ?? 3600) * 1000).toISOString()
  await admin.from('youtube_channels').update({ access_token, token_expires, oauth_status: 'connected' }).eq('id', ch.id)
  return access_token
}

export async function POST(request: NextRequest) {
  const { channelId } = await request.json().catch(() => ({}))
  const admin = createAdminClient()

  const query = admin.from('youtube_channels').select('id, channel_id, naam, access_token, refresh_token, token_expires, oauth_status')
  const { data: channels } = channelId
    ? await query.eq('id', channelId)
    : await query.in('oauth_status', ['connected', 'expired'])

  if (!channels?.length) return NextResponse.json({ synced: 0 })

  const results: { naam: string; status: string }[] = []

  for (const ch of channels) {
    const token = await refreshIfNeeded(admin, ch)
    if (!token || !ch.channel_id) {
      results.push({ naam: ch.naam, status: 'skipped' })
      continue
    }

    try {
      const res = await fetch(
        `https://www.googleapis.com/youtube/v3/channels?part=statistics,snippet&id=${ch.channel_id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      const item = data.items?.[0]
      if (!item) throw new Error('No channel data')

      const stats = item.statistics
      await admin.from('youtube_channels').update({
        subscriber_count: parseInt(stats.subscriberCount ?? '0'),
        view_count:        parseInt(stats.viewCount ?? '0'),
        video_count:       parseInt(stats.videoCount ?? '0'),
        last_sync:         new Date().toISOString(),
        status:            'active',
      }).eq('id', ch.id)

      results.push({ naam: ch.naam, status: 'ok' })
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      results.push({ naam: ch.naam, status: `error: ${msg}` })
    }
  }

  return NextResponse.json({ synced: results.filter(r => r.status === 'ok').length, results })
}
