import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  const { channelId } = await request.json()
  if (!channelId) return NextResponse.json({ error: 'channelId required' }, { status: 400 })

  const admin = createAdminClient()
  const { data: ch, error } = await admin
    .from('youtube_channels')
    .select('id, refresh_token')
    .eq('id', channelId)
    .single()

  if (error || !ch?.refresh_token) {
    return NextResponse.json({ error: 'No refresh token' }, { status: 404 })
  }

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     process.env.YOUTUBE_CLIENT_ID!,
      client_secret: process.env.YOUTUBE_CLIENT_SECRET!,
      refresh_token: ch.refresh_token,
      grant_type:    'refresh_token',
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    await admin.from('youtube_channels').update({ oauth_status: 'expired' }).eq('id', channelId)
    return NextResponse.json({ error: 'Token refresh failed', detail: err }, { status: 502 })
  }

  const { access_token, expires_in } = await res.json()
  const token_expires = new Date(Date.now() + (expires_in ?? 3600) * 1000).toISOString()

  await admin.from('youtube_channels').update({
    access_token,
    token_expires,
    oauth_status: 'connected',
  }).eq('id', channelId)

  return NextResponse.json({ ok: true })
}
