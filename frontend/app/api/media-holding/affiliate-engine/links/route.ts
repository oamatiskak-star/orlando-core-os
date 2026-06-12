import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const revalidate = 0

export async function GET(_req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [links, performance, channels] = await Promise.all([
    supabase.from('affiliate_links')
      .select('*, channel:media_holding_channels(id, name, naam, niche)')
      .order('created_at', { ascending: false }),
    supabase.from('affiliate_performance').select('*'),
    supabase.from('media_holding_channels').select('id, name, naam, niche'),
  ])
  if (links.error) return NextResponse.json({ error: links.error.message }, { status: 500 })

  return NextResponse.json({
    links: links.data ?? [],
    performance: performance.data ?? [],
    channels: channels.data ?? [],
  })
}

// POST /api/media-holding/affiliate-engine/links
// Body: { affiliate_id, network?, product, url, niche?, channel_id?, commission_pct?, utm_template?, short_link?, notes? }
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  if (!body.affiliate_id || !body.product || !body.url) {
    return NextResponse.json({ error: 'affiliate_id, product, url verplicht' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('affiliate_links')
    .insert({
      affiliate_id:    body.affiliate_id,
      network:         body.network ?? null,
      product:         body.product,
      url:             body.url,
      niche:           body.niche ?? null,
      channel_id:      body.channel_id ?? null,
      content_item_id: body.content_item_id ?? null,
      commission_pct:  body.commission_pct ?? null,
      utm_template:    body.utm_template ?? undefined,
      short_link:      body.short_link ?? null,
      notes:           body.notes ?? null,
      active:          true,
    })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ link: data }, { status: 201 })
}
