import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const revalidate = 0

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const channelId = req.nextUrl.searchParams.get('channel_id')
  let q = supabase.from('affiliate_links')
    .select('*, channel:media_holding_channels(id, name)')
    .order('created_at', { ascending: false })
  if (channelId) q = q.eq('channel_id', channelId)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ links: data ?? [] })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  if (!body.affiliate_id || !body.product || !body.url) {
    return NextResponse.json({ error: 'affiliate_id, product en url zijn vereist' }, { status: 400 })
  }

  const { data, error } = await supabase.from('affiliate_links').insert({
    affiliate_id:   body.affiliate_id,
    network:        body.network ?? null,
    product:        body.product,
    url:            body.url,
    commission_pct: body.commission_pct ?? null,
    channel_id:     body.channel_id ?? null,
    short_code:     body.short_code ?? null,
    active:         body.active ?? true,
  }).select('*').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ link: data }, { status: 201 })
}
