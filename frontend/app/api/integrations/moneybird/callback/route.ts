import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const code  = searchParams.get('code')
  const error = searchParams.get('error')
  const base  = process.env.NEXT_PUBLIC_APP_URL!

  if (error || !code) {
    return NextResponse.redirect(`${base}/dashboard/admin?error=${error ?? 'no_code'}`)
  }

  const clientId     = process.env.MONEYBIRD_CLIENT_ID!
  const clientSecret = process.env.MONEYBIRD_CLIENT_SECRET!
  const redirectUri  = `${base}/api/integrations/moneybird/callback`

  // Exchange code for tokens
  const tokenRes = await fetch('https://moneybird.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code,
      client_id:     clientId,
      client_secret: clientSecret,
      redirect_uri:  redirectUri,
      grant_type:    'authorization_code',
    }),
  })

  const tokens = await tokenRes.json()
  if (!tokenRes.ok) {
    return NextResponse.redirect(`${base}/dashboard/admin?error=${tokens.error ?? 'token_failed'}`)
  }

  // Fetch administrations to store the first administration_id
  const adminRes = await fetch('https://moneybird.com/api/v2/administrations', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  })
  const admins = await adminRes.json().catch(() => [])
  const firstAdmin = Array.isArray(admins) ? admins[0] : null

  const supabase = createAdminClient()
  await supabase.from('integration_connections').upsert({
    type:          'moneybird',
    access_token:  tokens.access_token,
    refresh_token: tokens.refresh_token ?? null,
    token_expires: tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
      : null,
    status:        'connected',
    connected_at:  new Date().toISOString(),
    updated_at:    new Date().toISOString(),
    metadata:      {
      administration_id:   firstAdmin?.id ?? null,
      administration_name: firstAdmin?.name ?? null,
      all_administrations: admins,
    },
  }, { onConflict: 'type' })

  return NextResponse.redirect(`${base}/dashboard/admin?connected=moneybird`)
}
