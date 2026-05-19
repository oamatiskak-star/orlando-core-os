import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const revalidate = 0

// POST /api/media-holding/channels/[id]/credentials
// Body: { platform, client_id, client_secret, redirect_uri }
// Slaat OAuth client credentials op voor channel × platform combinatie.
// Status gaat naar 'configured'.
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: channelId } = await ctx.params
  const body = await req.json().catch(() => ({}))

  if (!body.platform || !body.client_id || !body.client_secret) {
    return NextResponse.json({ error: 'platform, client_id en client_secret zijn vereist' }, { status: 400 })
  }
  const validPlatforms = ['youtube','tiktok','instagram','facebook','snapchat'] as const
  if (!validPlatforms.includes(body.platform)) {
    return NextResponse.json({ error: `platform moet één van: ${validPlatforms.join(', ')}` }, { status: 400 })
  }

  // Default redirect URI op basis van request origin (Vercel/local)
  const origin = req.nextUrl.origin
  const defaultRedirect = `${origin}/api/media-holding/oauth/${body.platform}/callback`

  // Default scopes per platform
  const defaultScopes: Record<string, string[]> = {
    youtube: [
      'https://www.googleapis.com/auth/youtube.upload',
      'https://www.googleapis.com/auth/youtube.readonly',
      'https://www.googleapis.com/auth/yt-analytics.readonly', // Phase 5 Retention Lab
    ],
    tiktok:    ['video.upload', 'user.info.basic'],
    instagram: ['instagram_basic','instagram_content_publish'],
    facebook:  ['pages_show_list','pages_manage_posts','pages_read_engagement'],
    snapchat:  [], // Spotlight is partner-only
  }

  const { data, error } = await supabase
    .from('platform_credentials')
    .upsert({
      channel_id:   channelId,
      platform:     body.platform,
      client_id:    body.client_id,
      client_secret:body.client_secret,
      redirect_uri: body.redirect_uri ?? defaultRedirect,
      scopes:       body.scopes ?? defaultScopes[body.platform] ?? [],
      status:       'configured',
      last_error:   null,
    }, { onConflict: 'channel_id,platform' })
    .select('id, platform, status, redirect_uri')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ credentials: data }, { status: 201 })
}

// GET — list credentials for a channel (zonder client_secret in response)
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: channelId } = await ctx.params
  const { data, error } = await supabase
    .from('platform_credentials')
    .select('id, platform, status, redirect_uri, scopes, external_account_id, external_account_name, expires_at, last_error, created_at, updated_at')
    .eq('channel_id', channelId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ credentials: data ?? [] })
}
