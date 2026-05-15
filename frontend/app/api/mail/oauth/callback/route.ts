import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const code    = searchParams.get('code')
  const userId  = searchParams.get('state')
  const error   = searchParams.get('error')
  const base    = process.env.NEXT_PUBLIC_APP_URL!
  const mailUrl = `${base}/mobile/mail`

  if (error || !code || !userId) {
    return NextResponse.redirect(`${mailUrl}?oauth_error=${error ?? 'missing_code'}`)
  }

  const clientId     = process.env.GMAIL_CLIENT_ID     ?? process.env.YOUTUBE_CLIENT_ID
  const clientSecret = process.env.GMAIL_CLIENT_SECRET ?? process.env.YOUTUBE_CLIENT_SECRET
  const redirectUri  = `${base}/api/mail/oauth/callback`

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(`${mailUrl}?oauth_error=no_credentials`)
  }

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
    console.error('Gmail token exchange mislukt:', err)
    return NextResponse.redirect(`${mailUrl}?oauth_error=token_exchange_failed`)
  }

  const tokens = await tokenRes.json()
  const { access_token, refresh_token, expires_in } = tokens

  if (!refresh_token) {
    return NextResponse.redirect(`${mailUrl}?oauth_error=no_refresh_token`)
  }

  // Haal Gmail-profiel op voor e-mailadres
  const profileRes = await fetch('https://www.googleapis.com/gmail/v1/users/me/profile', {
    headers: { Authorization: `Bearer ${access_token}` },
  })
  const profile = await profileRes.json()
  const email   = profile.emailAddress ?? 'unknown@gmail.com'

  const tokenExpiry = new Date(Date.now() + (expires_in ?? 3600) * 1000).toISOString()

  const admin = createAdminClient()

  const { error: dbErr } = await admin
    .from('mail_accounts')
    .upsert({
      user_id:              userId,
      provider:             'gmail',
      email,
      display_name:         email.split('@')[0],
      gmail_access_token:   access_token,
      gmail_refresh_token:  refresh_token,
      gmail_token_expiry:   tokenExpiry,
      sync_status:          'idle',
    }, { onConflict: 'email' })

  if (dbErr) {
    console.error('Mail account opslaan mislukt:', dbErr)
    return NextResponse.redirect(`${mailUrl}?oauth_error=db_error`)
  }

  return NextResponse.redirect(`${mailUrl}?connected=${encodeURIComponent(email)}`)
}
