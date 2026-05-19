import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const revalidate = 0

// POST /api/media-holding/affiliate-engine/conversion
// Body: { link_id, click_id?, content_item_id?, channel_id?, value_eur, commission_eur, currency?, status?, network_transaction_id?, occurred_at? }
// Wordt aangeroepen door affiliate network postback OF handmatige confirmatie via dashboard.
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  if (!body.link_id) return NextResponse.json({ error: 'link_id verplicht' }, { status: 400 })

  const { data, error } = await supabase
    .from('affiliate_conversions')
    .insert({
      link_id:                body.link_id,
      click_id:               body.click_id ?? null,
      content_item_id:        body.content_item_id ?? null,
      channel_id:             body.channel_id ?? null,
      value_eur:              body.value_eur ?? 0,
      commission_eur:         body.commission_eur ?? 0,
      currency:               body.currency ?? 'EUR',
      status:                 body.status ?? 'pending',
      network_transaction_id: body.network_transaction_id ?? null,
      occurred_at:            body.occurred_at ?? new Date().toISOString(),
    })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ conversion: data }, { status: 201 })
}

// PATCH — bv. om status te wijzigen naar confirmed/rejected/refunded
export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  if (!body.id) return NextResponse.json({ error: 'id verplicht' }, { status: 400 })

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const k of ['status','value_eur','commission_eur','currency','network_transaction_id','confirmed_at']) {
    if (k in body) patch[k] = body[k]
  }

  const { data, error } = await supabase
    .from('affiliate_conversions')
    .update(patch)
    .eq('id', body.id)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ conversion: data })
}
