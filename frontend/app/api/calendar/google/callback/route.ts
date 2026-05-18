import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const code = searchParams.get('code')
  const error = searchParams.get('error')

  const base = process.env.NEXT_PUBLIC_APP_URL!

  if (error || !code) {
    return NextResponse.redirect(`${base}/dashboard/agenda?error=${error ?? 'no_code'}`)
  }

  const clientId = process.env.YOUTUBE_CLIENT_ID!
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET!
  const redirectUri = `${base}/api/calendar/google/callback`

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

  const tokens = await tokenRes.json()
  if (!tokenRes.ok) {
    return NextResponse.redirect(`${base}/dashboard/agenda?error=${tokens.error ?? 'token_failed'}`)
  }

  const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  })
  const userInfo = await userRes.json().catch(() => ({}))

  const supabase = createAdminClient()

  // Wipe old Google connection, keep iCloud
  await supabase.from('google_calendar_connections').delete().eq('provider', 'google')

  const { error: dbErr } = await supabase.from('google_calendar_connections').insert({
    provider:      'google',
    access_token:  tokens.access_token,
    refresh_token: tokens.refresh_token ?? null,
    token_expires: new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000).toISOString(),
    email:         userInfo.email ?? null,
    status:        'connected',
    selected_calendar_ids: [],
  })

  if (dbErr) {
    return NextResponse.redirect(`${base}/dashboard/agenda?error=db_error`)
  }

  return NextResponse.redirect(`${base}/dashboard/agenda?connected=1`)
}
