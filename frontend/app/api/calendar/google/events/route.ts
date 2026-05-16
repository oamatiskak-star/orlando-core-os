import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const CHANNEL_COLORS: Record<string, string> = {
  VermogenTv:         '#6366f1',
  PropertyInvestorTv: '#ec4899',
  VastgoedTv:         '#0ea5e9',
  SpaarTv:            '#10b981',
  CryptoVermogen:     '#f59e0b',
  BeleggingsTv:       '#8b5cf6',
  AquierTv:           '#14b8a6',
}

async function tryRefresh(conn: { id: string; refresh_token: string | null }) {
  if (!conn.refresh_token) return null
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: conn.refresh_token,
      client_id:     process.env.YOUTUBE_CLIENT_ID!,
      client_secret: process.env.YOUTUBE_CLIENT_SECRET!,
      grant_type:    'refresh_token',
    }),
  })
  const data = await res.json()
  if (!res.ok) return null
  const supabase = createAdminClient()
  await supabase.from('google_calendar_connections').update({
    access_token:  data.access_token,
    token_expires: new Date(Date.now() + (data.expires_in ?? 3600) * 1000).toISOString(),
    updated_at:    new Date().toISOString(),
  }).eq('id', conn.id)
  return data.access_token as string
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const start = searchParams.get('start') ?? new Date().toISOString()
  const end   = searchParams.get('end')   ?? new Date(Date.now() + 7 * 86400_000).toISOString()

  const supabase = createAdminClient()

  // YouTube planned uploads
  const [{ data: ytRows }, { data: channels }] = await Promise.all([
    supabase.from('youtube_upload_queue')
      .select('id, title, channel_id, scheduled_publish_at, status')
      .not('scheduled_publish_at', 'is', null)
      .gte('scheduled_publish_at', start)
      .lte('scheduled_publish_at', end)
      .order('scheduled_publish_at', { ascending: true })
      .limit(1000),
    supabase.from('youtube_channels').select('id, naam'),
  ])

  const chMap = Object.fromEntries((channels ?? []).map(c => [c.id, c.naam]))

  const youtubeEvents = (ytRows ?? []).map(e => {
    const naam  = chMap[e.channel_id] ?? 'YouTube'
    const isShort = (e.title ?? '').startsWith('[Short]')
    const startDt = new Date(e.scheduled_publish_at)
    const endDt   = new Date(startDt.getTime() + 30 * 60_000)
    return {
      id:      e.id,
      title:   e.title ?? naam,
      start:   startDt.toISOString(),
      end:     endDt.toISOString(),
      color:   CHANNEL_COLORS[naam] ?? '#6366f1',
      source:  'youtube' as const,
      channel: naam,
      type:    isShort ? 'short' : 'longform',
      status:  e.status,
    }
  })

  // Google Calendar events
  const { data: conn } = await supabase
    .from('google_calendar_connections')
    .select('*')
    .eq('status', 'connected')
    .limit(1)
    .single()

  let googleEvents: object[] = []
  let googleConnected = false

  if (conn?.access_token) {
    googleConnected = true
    let token: string = conn.access_token

    if (conn.token_expires && new Date(conn.token_expires) < new Date(Date.now() + 5 * 60_000)) {
      token = await tryRefresh(conn) ?? token
    }

    const calIds: string[] = conn.selected_calendar_ids?.length
      ? conn.selected_calendar_ids
      : ['primary']

    const results = await Promise.allSettled(
      calIds.map(async (calId: string) => {
        const url = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events`)
        url.searchParams.set('timeMin',      start)
        url.searchParams.set('timeMax',      end)
        url.searchParams.set('singleEvents', 'true')
        url.searchParams.set('orderBy',      'startTime')
        url.searchParams.set('maxResults',   '200')
        const r = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` } })
        const d = await r.json()
        return (d.items ?? []) as Record<string, unknown>[]
      })
    )

    googleEvents = results
      .filter(r => r.status === 'fulfilled')
      .flatMap(r => (r as PromiseFulfilledResult<Record<string, unknown>[]>).value)
      .map(e => {
        const s = e.start as Record<string, string> | undefined
        const en = e.end as Record<string, string> | undefined
        return {
          id:          e.id,
          title:       e.summary ?? '(Geen titel)',
          start:       s?.dateTime ?? s?.date,
          end:         en?.dateTime ?? en?.date,
          color:       (e.colorId ? `#${e.colorId}` : '#4285f4'),
          source:      'google',
          allDay:      !s?.dateTime,
          location:    e.location,
          description: e.description,
        }
      })
  }

  return NextResponse.json({
    events: [...youtubeEvents, ...googleEvents],
    googleConnected,
  })
}
