import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getApplicationToken } from '@/lib/ing/client'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/login', req.url))

  const state       = crypto.randomUUID()
  const redirectUri = `${req.nextUrl.origin}/api/bank/ing/callback`
  const clientId    = process.env.ING_CLIENT_ID ?? 'e77d776b-90af-4684-bebc-521e5b2614dd'
  const baseUrl     = process.env.ING_BASE_URL  ?? 'https://api.sandbox.ing.com'

  // Sla state op in supabase voor CSRF bescherming
  await supabase.from('personal_bank_connections').upsert({
    bank_id:   'ING',
    bank_name: 'ING',
    status:    'pending',
    iban:      null,
    raw_data:  { oauth_state: state, redirect_uri: redirectUri },
  }, { onConflict: 'bank_id' })

  // Haal application token op
  let authServerUrl = `${baseUrl}/oauth2/authorization-server-url`
  try {
    const appToken = await getApplicationToken()
    const res = await fetch(`${baseUrl}/oauth2/authorization-server-url?scope=accounts%3Aview&redirect_uri=${encodeURIComponent(redirectUri)}&client_id=${clientId}&response_type=code&state=${state}`, {
      headers: { 'Authorization': `Bearer ${appToken}` },
    })
    const data = await res.json() as { location?: string }
    if (data.location) authServerUrl = data.location
  } catch {
    // Fallback: direct naar ING auth
  }

  const params = new URLSearchParams({
    client_id:     clientId,
    scope:         'accounts:view',
    redirect_uri:  redirectUri,
    response_type: 'code',
    state,
  })

  const finalUrl = authServerUrl.includes('?')
    ? `${authServerUrl}&${params}`
    : `${authServerUrl}?${params}`

  return NextResponse.redirect(finalUrl)
}
