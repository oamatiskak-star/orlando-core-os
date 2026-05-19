import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const revalidate = 0

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sp = req.nextUrl.searchParams
  const status = sp.get('status')
  const kind = sp.get('kind')
  const channelId = sp.get('channel_id')
  const limit = Math.min(500, parseInt(sp.get('limit') ?? '100', 10))

  let q = supabase
    .from('media_holding_content_items')
    .select('*, channel:media_holding_channels(id, name, niche), source_opportunity:viral_opportunities(id, title, channel_name, virality_score)')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (status)    q = q.eq('status', status)
  if (kind)      q = q.eq('kind', kind)
  if (channelId) q = q.eq('channel_id', channelId)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ items: data ?? [] })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  if (!body.kind) {
    return NextResponse.json({ error: 'kind vereist' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('media_holding_content_items')
    .insert({
      channel_id:            body.channel_id ?? null,
      source_opportunity_id: body.source_opportunity_id ?? null,
      kind:                  body.kind,
      title:                 body.title ?? null,
      prompt:                body.prompt ?? null,
      hook:                  body.hook ?? null,
      duration_seconds:      body.duration_seconds ?? null,
      language:              body.language ?? 'nl',
      status:                body.status ?? 'pending',
      content_brief:         body.content_brief ?? null,
      scheduled_at:          body.scheduled_at ?? null,
    })
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ item: data }, { status: 201 })
}
