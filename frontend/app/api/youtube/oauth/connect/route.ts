import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const SCOPES = [
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtube.readonly',
  'https://www.googleapis.com/auth/youtube.force-ssl',
  'https://www.googleapis.com/auth/yt-analytics.readonly',
].join(' ')

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const channelUuid = searchParams.get('channel_uuid')

  if (!channelUuid) {
    return NextResponse.json({ error: 'channel_uuid vereist' }, { status: 400 })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  if (!appUrl) {
    return NextResponse.json({ error: 'NEXT_PUBLIC_APP_URL niet geconfigureerd' }, { status: 500 })
  }

  // Haal per-kanaal client ID op uit youtube_channels
  const admin = createAdminClient()
  const { data: channel, error } = await admin
    .from('youtube_channels')
    .select('id, naam, oauth_client_id')
    .eq('id', channelUuid)
    .maybeSingle()

  if (error || !channel) {
    return NextResponse.json({ error: 'Kanaal niet gevonden' }, { status: 404 })
  }

  // Per-kanaal client ID heeft prioriteit, anders valt terug op globale env var
  const clientId = channel.oauth_client_id ?? process.env.YOUTUBE_CLIENT_ID
  if (!clientId) {
    return NextResponse.json(
      { error: `Geen OAuth client ID geconfigureerd voor ${channel.naam}` },
      { status: 500 }
    )
  }

  const redirectUri = `${appUrl}/api/youtube/oauth/callback`

  const params = new URLSearchParams({
    client_id:     clientId,
    redirect_uri:  redirectUri,
    response_type: 'code',
    scope:         SCOPES,
    access_type:   'offline',
    prompt:        'consent',
    state:         channelUuid,
  })

  return NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
  )
}
