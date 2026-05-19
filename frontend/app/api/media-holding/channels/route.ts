import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const revalidate = 0

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const status = req.nextUrl.searchParams.get('status')
  let q = supabase
    .from('media_holding_channels')
    .select('*')
    .order('created_at', { ascending: false })

  if (status) q = q.eq('status', status)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ channels: data ?? [] })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  if (!body.name || !body.niche) {
    return NextResponse.json({ error: 'name + niche vereist' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('media_holding_channels')
    .insert({
      name:             body.name,
      handle:           body.handle ?? null,
      niche:            body.niche,
      language:         body.language ?? 'nl',
      persona_owner:    body.persona_owner ?? 'Nova',
      status:           body.status ?? 'idea',
      target_views_10d: body.target_views_10d ?? 280000,
      branding:         body.branding ?? {},
      upload_strategy:  body.upload_strategy ?? {},
      posting_schedule: body.posting_schedule ?? {},
    })
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ channel: data }, { status: 201 })
}
