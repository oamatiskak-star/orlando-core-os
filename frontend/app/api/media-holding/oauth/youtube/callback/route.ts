import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const revalidate = 0

// GET /api/media-holding/oauth/youtube/callback?code=X&state=Y
//
// Google redirected hier na user consent. We:
//   1. Vinden de platform_credentials op oauth_state
//   2. Exchangen de code voor access_token + refresh_token via Google's token endpoint
//   3. Slaan tokens op + zetten status='connected'
//   4. (optioneel) Halen YouTube channel info op via Data API om external_account_*
//      te vullen
//   5. Redirect naar dashboard cross-platform page met success/error param
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    // Niet ingelogd — redirect naar login
    return NextResponse.redirect(new URL('/login?next=/dashboard/media-holding/cross-platform', req.url))
  }

  const code = req.nextUrl.searchParams.get('code')
  const state = req.nextUrl.searchParams.get('state')
  const errorParam = req.nextUrl.searchParams.get('error')

  if (errorParam || !code || !state) {
    return NextResponse.redirect(new URL(`/dashboard/media-holding/cross-platform?oauth_error=${errorParam ?? 'missing_code_or_state'}`, req.url))
  }

  // Vind credentials op oauth_state
  const { data: cred } = await supabase
    .from('platform_credentials')
    .select('*')
    .eq('oauth_state', state)
    .eq('platform', 'youtube')
    .single()

  if (!cred) {
    return NextResponse.redirect(new URL('/dashboard/media-holding/cross-platform?oauth_error=state_not_found', req.url))
  }

  // Exchange code → tokens
  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id:     cred.client_id ?? '',
        client_secret: cred.client_secret ?? '',
        redirect_uri:  cred.redirect_uri ?? `${req.nextUrl.origin}/api/media-holding/oauth/youtube/callback`,
        grant_type:    'authorization_code',
      }),
    })

    if (!tokenRes.ok) {
      const errText = await tokenRes.text()
      await supabase.from('platform_credentials').update({
        status:     'error',
        last_error: `token exchange: ${tokenRes.status} ${errText.slice(0, 500)}`,
        updated_at: new Date().toISOString(),
      }).eq('id', cred.id)
      return NextResponse.redirect(new URL(`/dashboard/media-holding/cross-platform?oauth_error=token_exchange_failed`, req.url))
    }

    const tokens: { access_token: string; refresh_token?: string; expires_in: number; scope: string } = await tokenRes.json()

    // Optional: haal channel info
    let externalId: string | null = null
    let externalName: string | null = null
    try {
      const chRes = await fetch('https://www.googleapis.com/youtube/v3/channels?part=snippet,id&mine=true', {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      })
      if (chRes.ok) {
        const j = await chRes.json()
        externalId   = j.items?.[0]?.id ?? null
        externalName = j.items?.[0]?.snippet?.title ?? null
      }
    } catch {}

    await supabase.from('platform_credentials').update({
      refresh_token: tokens.refresh_token ?? cred.refresh_token,
      access_token:  tokens.access_token,
      expires_at:    new Date(Date.now() + (tokens.expires_in * 1000)).toISOString(),
      status:        'connected',
      oauth_state:   null,
      last_error:    null,
      external_account_id:   externalId,
      external_account_name: externalName,
      updated_at:    new Date().toISOString(),
    }).eq('id', cred.id)

    return NextResponse.redirect(new URL(`/dashboard/media-holding/cross-platform?oauth_success=youtube`, req.url))
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    await supabase.from('platform_credentials').update({
      status:     'error',
      last_error: `callback exception: ${msg.slice(0, 500)}`,
      updated_at: new Date().toISOString(),
    }).eq('id', cred.id)
    return NextResponse.redirect(new URL(`/dashboard/media-holding/cross-platform?oauth_error=exception`, req.url))
  }
}
