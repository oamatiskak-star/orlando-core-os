import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { randomBytes } from 'node:crypto'

export const revalidate = 0

// POST /api/media-holding/channels/[id]/oauth/init
// Body: { platform }
// Genereert een Google OAuth consent URL op basis van opgeslagen client_id
// + scopes voor deze channel × platform. Slaat oauth_state op als anti-CSRF
// pin. Frontend redirect de user naar de returned URL.
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: channelId } = await ctx.params
  const body = await req.json().catch(() => ({}))
  if (!body.platform) return NextResponse.json({ error: 'platform vereist' }, { status: 400 })

  const { data: cred, error: credError } = await supabase
    .from('platform_credentials')
    .select('id, client_id, redirect_uri, scopes, status')
    .eq('channel_id', channelId)
    .eq('platform', body.platform)
    .single()

  if (credError || !cred) {
    return NextResponse.json({ error: 'credentials niet gevonden — zet eerst client_id/secret via /credentials' }, { status: 400 })
  }
  if (!cred.client_id) {
    return NextResponse.json({ error: 'client_id niet ingesteld' }, { status: 400 })
  }

  // Genereer anti-CSRF state (ook gebruikt om bij callback de juiste credentials terug te vinden)
  const oauthState = `${cred.id}:${randomBytes(16).toString('hex')}`

  await supabase
    .from('platform_credentials')
    .update({ oauth_state: oauthState, status: 'oauth_pending', updated_at: new Date().toISOString() })
    .eq('id', cred.id)

  // Build Google OAuth URL voor YouTube. Andere platforms hebben hun eigen
  // authorize endpoints — die voegen we later toe.
  if (body.platform === 'youtube') {
    const params = new URLSearchParams({
      client_id:     cred.client_id,
      redirect_uri:  cred.redirect_uri ?? `${req.nextUrl.origin}/api/media-holding/oauth/youtube/callback`,
      response_type: 'code',
      access_type:   'offline',
      include_granted_scopes: 'true',
      prompt:        'consent',
      state:         oauthState,
      scope:         (cred.scopes ?? []).join(' '),
    })
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
    return NextResponse.json({ auth_url: authUrl })
  }

  return NextResponse.json({
    error: `OAuth init voor platform "${body.platform}" nog niet geïmplementeerd (alleen youtube in Phase 9)`,
  }, { status: 501 })
}
