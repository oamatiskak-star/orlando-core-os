import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const revalidate = 0

// GET /api/media-holding/archives?channel=<uuid>&since=<iso>&limit=200
// Read-only archief view: media_holding_archives × content_items × channels.
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const channelId = req.nextUrl.searchParams.get('channel')
  const since     = req.nextUrl.searchParams.get('since')
  const limit     = Math.max(1, Math.min(500, Number(req.nextUrl.searchParams.get('limit') ?? '200')))

  let q = supabase
    .from('media_holding_archives')
    .select(`
      id, reason, archived_at,
      content:media_holding_content_items!inner (
        id, title, kind, language, status, output_url, published_at, created_at,
        channel:media_holding_channels ( id, name, niche, language )
      )
    `)
    .order('archived_at', { ascending: false })
    .limit(limit)

  if (since) q = q.gte('archived_at', since)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  type Row = {
    id: string; reason: string | null; archived_at: string
    content: {
      id: string; title: string | null; kind: string; language: string; status: string
      output_url: string | null; published_at: string | null; created_at: string
      channel: { id: string; name: string; niche: string | null; language: string } | { id: string; name: string; niche: string | null; language: string }[] | null
    } | {
      id: string; title: string | null; kind: string; language: string; status: string
      output_url: string | null; published_at: string | null; created_at: string
      channel: { id: string; name: string; niche: string | null; language: string } | { id: string; name: string; niche: string | null; language: string }[] | null
    }[]
  }
  const rows = ((data ?? []) as Row[]).map((r) => {
    const content = Array.isArray(r.content) ? r.content[0] : r.content
    const channel = content?.channel
      ? (Array.isArray(content.channel) ? content.channel[0] : content.channel)
      : null
    return {
      id:           r.id,
      reason:       r.reason,
      archived_at:  r.archived_at,
      content_id:   content?.id ?? null,
      title:        content?.title ?? null,
      kind:         content?.kind ?? null,
      language:     content?.language ?? null,
      status:       content?.status ?? null,
      output_url:   content?.output_url ?? null,
      published_at: content?.published_at ?? null,
      created_at:   content?.created_at ?? null,
      channel,
    }
  })

  const filtered = channelId ? rows.filter((r) => r.channel?.id === channelId) : rows

  // Aggregated stats
  const stats = {
    total: filtered.length,
    by_reason: aggregate(filtered, (r) => r.reason ?? 'geen reden'),
    by_kind:   aggregate(filtered, (r) => r.kind   ?? 'onbekend'),
    by_channel: aggregate(filtered, (r) => r.channel?.name ?? '—'),
  }

  return NextResponse.json({ archives: filtered, stats })
}

function aggregate<T>(rows: T[], keyFn: (r: T) => string) {
  const m = new Map<string, number>()
  for (const r of rows) {
    const k = keyFn(r); m.set(k, (m.get(k) ?? 0) + 1)
  }
  return [...m.entries()].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count)
}
