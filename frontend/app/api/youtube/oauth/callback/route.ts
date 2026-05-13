import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const code         = searchParams.get('code')
  const channelUuid  = searchParams.get('state')
  const error        = searchParams.get('error')

  const dashUrl = `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/youtube`

  if (error || !code || !channelUuid) {
    return NextResponse.redirect(`${dashUrl}?oauth_error=${error ?? 'missing_code'}`)
  }

  const clientId     = process.env.YOUTUBE_CLIENT_ID!
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET!
  const redirectUri  = `${process.env.NEXT_PUBLIC_APP_URL}/api/youtube/oauth/callback`

  // Exchange code for tokens
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
    console.error('YouTube token exchange mislukt:', err)
    return NextResponse.redirect(`${dashUrl}?oauth_error=token_exchange_failed`)
  }

  const tokens = await tokenRes.json()
  const { access_token, refresh_token, expires_in } = tokens

  if (!refresh_token) {
    return NextResponse.redirect(`${dashUrl}?oauth_error=no_refresh_token`)
  }

  const tokenExpires = new Date(Date.now() + (expires_in ?? 3600) * 1000).toISOString()

  const admin = createAdminClient()
  const { error: dbErr } = await admin
    .from('youtube_channels')
    .update({
      access_token,
      refresh_token,
      token_expires:  tokenExpires,
      oauth_status:   'connected',
      status:         'active',
    })
    .eq('id', channelUuid)

  if (dbErr) {
    console.error('Token opslaan mislukt:', dbErr)
    const detail = encodeURIComponent(`${dbErr.code}:${dbErr.message}`)
    return NextResponse.redirect(`${dashUrl}?oauth_error=${detail}`)
  }

  return NextResponse.redirect(`${dashUrl}?oauth_success=1`)
}
