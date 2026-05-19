import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const revalidate = 0

// POST /api/media-holding/affiliate-engine/click
// Body: { link_id, content_item_id?, channel_id?, source_platform?, session_token?, referrer?, country_code? }
// Wordt aangeroepen door redirect endpoint of analytics pixel.
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  // Public-facing — geen auth check, dit moet vanaf elke bron werken
  const body = await req.json().catch(() => ({}))
  if (!body.link_id) return NextResponse.json({ error: 'link_id verplicht' }, { status: 400 })

  const { data, error } = await supabase
    .from('affiliate_clicks')
    .insert({
      link_id:         body.link_id,
      content_item_id: body.content_item_id ?? null,
      channel_id:      body.channel_id ?? null,
      source_platform: body.source_platform ?? null,
      referrer:        body.referrer ?? req.headers.get('referer') ?? null,
      country_code:    body.country_code ?? null,
      session_token:   body.session_token ?? null,
      user_agent_hash: body.user_agent_hash ?? null,
    })
    .select('id')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ click_id: data.id }, { status: 201 })
}
