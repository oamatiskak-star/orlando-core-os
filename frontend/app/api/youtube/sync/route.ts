import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Channel statistics zijn publieke data — geen OAuth nodig.
// We gebruiken YOUTUBE_DATA_API_KEY zodat sync werkt ongeacht oauth_status.
// channels.list?id=<csv,max=50>&part=statistics,snippet = 1 quota-unit per batch.
//
// Eerder gebruikte deze route per-channel OAuth bearer tokens; bij verlopen
// OAuth bleef view_count maandenlang stilstaan (BrickPulse Lab probleem).

interface YtChannelItem {
  id?: string
  snippet?: { title?: string; thumbnails?: { default?: { url?: string }; medium?: { url?: string }; high?: { url?: string } } }
  statistics?: { viewCount?: string; subscriberCount?: string; videoCount?: string }
}

export async function POST(request: NextRequest) {
  const { channelId } = await request.json().catch(() => ({}))
  const admin = createAdminClient()

  const apiKey = process.env.YOUTUBE_DATA_API_KEY ?? process.env.YOUTUBE_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'YOUTUBE_DATA_API_KEY env missing' }, { status: 500 })
  }

  const query = admin.from('youtube_channels').select('id, channel_id, naam')
  const { data: channels, error: chErr } = channelId
    ? await query.eq('id', channelId)
    : await query.not('channel_id', 'is', null)

  if (chErr) return NextResponse.json({ error: chErr.message }, { status: 500 })
  if (!channels?.length) return NextResponse.json({ synced: 0 })

  const ytIdToRow = new Map<string, { id: string; naam: string | null }>()
  for (const c of channels) {
    if (c.channel_id) ytIdToRow.set(c.channel_id as string, { id: c.id as string, naam: c.naam })
  }
  const ytIds = Array.from(ytIdToRow.keys())

  const results: { naam: string | null; status: string }[] = []
  let quotaUnits = 0

  for (let i = 0; i < ytIds.length; i += 50) {
    const batch = ytIds.slice(i, i + 50)
    const url = new URL('https://www.googleapis.com/youtube/v3/channels')
    url.searchParams.set('part', 'statistics,snippet')
    url.searchParams.set('id', batch.join(','))
    url.searchParams.set('key', apiKey)
    url.searchParams.set('maxResults', '50')

    const res = await fetch(url.toString(), { cache: 'no-store' })
    quotaUnits += 1
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      for (const ytId of batch) {
        results.push({ naam: ytIdToRow.get(ytId)?.naam ?? null, status: `http ${res.status}: ${body.slice(0, 120)}` })
      }
      if (res.status === 403) break
      continue
    }

    const data = (await res.json()) as { items?: YtChannelItem[] }
    const items = data.items ?? []
    const seen = new Set<string>()

    for (const item of items) {
      const ytId = item.id
      if (!ytId) continue
      const row = ytIdToRow.get(ytId)
      if (!row) continue
      seen.add(ytId)

      const s = item.statistics ?? {}
      const thumb = item.snippet?.thumbnails?.high?.url ?? item.snippet?.thumbnails?.medium?.url ?? item.snippet?.thumbnails?.default?.url ?? null

      const { error: upErr } = await admin
        .from('youtube_channels')
        .update({
          subscriber_count: parseInt(s.subscriberCount ?? '0', 10),
          view_count:       parseInt(s.viewCount ?? '0', 10),
          video_count:      parseInt(s.videoCount ?? '0', 10),
          last_sync:        new Date().toISOString(),
          status:           'active',
          ...(thumb ? { thumbnail_url: thumb } : {}),
        })
        .eq('id', row.id)

      results.push({ naam: row.naam, status: upErr ? `db: ${upErr.message}` : 'ok' })
    }

    for (const ytId of batch) {
      if (!seen.has(ytId)) {
        results.push({ naam: ytIdToRow.get(ytId)?.naam ?? null, status: 'not_found_on_youtube' })
      }
    }
  }

  return NextResponse.json({
    synced: results.filter(r => r.status === 'ok').length,
    quota_units_used: quotaUnits,
    results,
  })
}
