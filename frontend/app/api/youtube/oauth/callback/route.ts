import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const code        = searchParams.get('code')
  const channelUuid = searchParams.get('state')
  const error       = searchParams.get('error')

  const dashUrl = `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/youtube`

  if (error || !code || !channelUuid) {
    return NextResponse.redirect(`${dashUrl}?oauth_error=${error ?? 'missing_code'}`)
  }

  const admin = createAdminClient()

  // Haal per-kanaal OAuth credentials op
  const { data: channel, error: chErr } = await admin
    .from('youtube_channels')
    .select('id, naam, oauth_client_id, oauth_client_secret')
    .eq('id', channelUuid)
    .maybeSingle()

  if (chErr || !channel) {
    return NextResponse.redirect(`${dashUrl}?oauth_error=channel_not_found`)
  }

  // Per-kanaal credentials hebben prioriteit, anders globale env vars
  const clientId     = channel.oauth_client_id     ?? process.env.YOUTUBE_CLIENT_ID
  const clientSecret = channel.oauth_client_secret ?? process.env.YOUTUBE_CLIENT_SECRET
  const redirectUri  = `${process.env.NEXT_PUBLIC_APP_URL}/api/youtube/oauth/callback`

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(`${dashUrl}?oauth_error=no_client_credentials_for_${channel.naam}`)
  }

  // Wissel authorization code in voor tokens
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id:     clientId,
      client_secret: clientSecret,
      redirect_uri:  redirectUri,
      grant_type:    'authorization_code',
    }),
  })

  if (!tokenRes.ok) {
    const err = await tokenRes.text()
    console.error(`Token exchange mislukt voor ${channel.naam}:`, err)
    return NextResponse.redirect(`${dashUrl}?oauth_error=token_exchange_failed`)
  }

  const tokens = await tokenRes.json()
  const { access_token, refresh_token, expires_in } = tokens

  if (!refresh_token) {
    return NextResponse.redirect(`${dashUrl}?oauth_error=no_refresh_token`)
  }

  const tokenExpires = new Date(Date.now() + (expires_in ?? 3600) * 1000).toISOString()

  const { error: dbErr } = await admin
    .from('youtube_channels')
    .update({
      access_token,
      refresh_token,
      token_expires:   tokenExpires,
      oauth_status:    'connected',
      oauth_connected: true,
      status:          'active',
    })
    .eq('id', channelUuid)

  if (dbErr) {
    console.error('Token opslaan mislukt:', dbErr)
    return NextResponse.redirect(`${dashUrl}?oauth_error=${encodeURIComponent(`${dbErr.code}:${dbErr.message}`)}`)
  }

  return NextResponse.redirect(`${dashUrl}?oauth_success=1&channel=${encodeURIComponent(channel.naam)}`)
}
