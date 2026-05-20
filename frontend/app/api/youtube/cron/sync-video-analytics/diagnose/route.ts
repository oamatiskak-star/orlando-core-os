import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const revalidate = 0
export const maxDuration = 60

// Diagnostic endpoint: voert dezelfde sync-video-analytics logic uit maar
// retourneert per kanaal de exacte HTTP status + body van de YouTube Analytics
// en YouTube Data v3 search calls — zodat we zien WAAROM youtube_video_analytics
// leeg blijft (vermoedelijk: OAuth scope mist yt-analytics.readonly).
// Geen CRON_SECRET vereist — endpoint draait niet automatisch.

async function refreshTokenIfNeeded(
  admin: ReturnType<typeof createAdminClient>,
  ch: {
    id: string
    access_token: string | null
    token_expires: string | null
    refresh_token: string | null
    oauth_client_id: string | null
    oauth_client_secret: string | null
  }
): Promise<{ token: string | null; refresh_error?: string }> {
  if (!ch.token_expires || new Date(ch.token_expires) > new Date(Date.now() + 60_000)) {
    return { token: ch.access_token }
  }
  const clientId = ch.oauth_client_id ?? process.env.YOUTUBE_CLIENT_ID
  const clientSecret = ch.oauth_client_secret ?? process.env.YOUTUBE_CLIENT_SECRET
  if (!clientId || !clientSecret || !ch.refresh_token) {
    return { token: ch.access_token, refresh_error: 'missing client_id/secret/refresh_token' }
  }
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: ch.refresh_token,
      grant_type: 'refresh_token',
    }),
  })
  const body = await res.text()
  if (!res.ok) {
    return { token: ch.access_token, refresh_error: `${res.status}: ${body.slice(0, 200)}` }
  }
  const parsed = JSON.parse(body)
  const access_token = parsed.access_token as string
  const token_expires = new Date(Date.now() + ((parsed.expires_in as number) ?? 3600) * 1000).toISOString()
  await admin
    .from('youtube_channels')
    .update({ access_token, token_expires, oauth_status: 'connected', oauth_connected: true })
    .eq('id', ch.id)
  return { token: access_token }
}

export async function POST() {
  const admin = createAdminClient()
  const today = new Date().toISOString().split('T')[0]
  const start = new Date(Date.now() - 7 * 86400_000).toISOString().split('T')[0]

  const { data: channels, error: chErr } = await admin
    .from('youtube_channels')
    .select('id, name, channel_id, access_token, refresh_token, token_expires, oauth_status, oauth_client_id, oauth_client_secret')
    .eq('oauth_status', 'connected')
    .not('refresh_token', 'is', null)
    .not('channel_id', 'is', null)

  if (chErr) return NextResponse.json({ error: chErr.message }, { status: 500 })
  if (!channels?.length) {
    return NextResponse.json({ message: 'No connected channels match filter', filter_matched: 0 })
  }

  const diagnostics: Array<{
    name: string
    yt_channel_id: string
    token_refresh?: { ok: boolean; error?: string }
    search_call?: { status: number; body_preview: string; video_count: number }
    analytics_call?: { status: number; body_preview: string; rows: number }
    scopes_check?: { status: number; granted_scopes?: string; required: string[] }
  }> = []

  for (const ch of channels.slice(0, 3)) {
    const entry: typeof diagnostics[number] = {
      name: ch.name as string,
      yt_channel_id: ch.channel_id as string,
    }

    const { token, refresh_error } = await refreshTokenIfNeeded(admin, ch)
    entry.token_refresh = { ok: !!token, error: refresh_error }
    if (!token) {
      diagnostics.push(entry)
      continue
    }

    const tokenInfoRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?access_token=${token}`)
    const tokenInfoBody = await tokenInfoRes.text()
    let scopeGranted: string | undefined
    try {
      const parsed = JSON.parse(tokenInfoBody)
      scopeGranted = parsed.scope as string | undefined
    } catch {
      scopeGranted = undefined
    }
    entry.scopes_check = {
      status: tokenInfoRes.status,
      granted_scopes: scopeGranted,
      required: [
        'https://www.googleapis.com/auth/youtube.readonly',
        'https://www.googleapis.com/auth/yt-analytics.readonly',
        'https://www.googleapis.com/auth/youtube',
      ],
    }

    const searchRes = await fetch(
      `https://www.googleapis.com/youtube/v3/search?part=id,snippet&channelId=${ch.channel_id}&type=video&order=date&maxResults=10`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    const searchBody = await searchRes.text()
    let videoCount = 0
    try {
      const parsed = JSON.parse(searchBody)
      videoCount = (parsed.items ?? []).length
    } catch { /* ignore */ }
    entry.search_call = { status: searchRes.status, body_preview: searchBody.slice(0, 250), video_count: videoCount }

    let firstVideoIds: string[] = []
    try {
      const parsed = JSON.parse(searchBody)
      firstVideoIds = (parsed.items ?? [])
        .map((it: { id?: { videoId?: string } }) => it.id?.videoId)
        .filter((v: string | undefined): v is string => !!v)
        .slice(0, 5)
    } catch { /* ignore */ }

    if (firstVideoIds.length > 0) {
      const url = new URL('https://youtubeanalytics.googleapis.com/v2/reports')
      url.searchParams.set('ids', `channel==${ch.channel_id}`)
      url.searchParams.set('startDate', start)
      url.searchParams.set('endDate', today)
      url.searchParams.set('metrics', 'views,likes,comments,estimatedMinutesWatched,averageViewPercentage')
      url.searchParams.set('dimensions', 'video')
      url.searchParams.set('filters', `video==${firstVideoIds.join(',')}`)

      const anaRes = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` } })
      const anaBody = await anaRes.text()
      let rows = 0
      try {
        const parsed = JSON.parse(anaBody)
        rows = (parsed.rows ?? []).length
      } catch { /* ignore */ }
      entry.analytics_call = { status: anaRes.status, body_preview: anaBody.slice(0, 400), rows }
    } else {
      entry.analytics_call = { status: 0, body_preview: 'no video ids from search', rows: 0 }
    }

    diagnostics.push(entry)
  }

  return NextResponse.json({
    filter_matched: channels.length,
    diagnosed_first_n: diagnostics.length,
    diagnostics,
    now: new Date().toISOString(),
  })
}
