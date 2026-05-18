import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const revalidate = 0

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sp      = req.nextUrl.searchParams
  const type    = sp.get('type') ?? ''
  const gelezen = sp.get('gelezen') ?? ''

  let q = supabase
    .from('notifications')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(100)

  if (type)    q = q.eq('type', type)
  if (gelezen !== '') q = q.eq('gelezen', gelezen === 'true')

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const unread = (data ?? []).filter(n => !n.gelezen).length
  return NextResponse.json({ notifications: data ?? [], unread })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { type, titel, bericht, link_url, metadata } = body

  if (!bericht) return NextResponse.json({ error: 'bericht vereist' }, { status: 400 })

  const { data, error } = await supabase
    .from('notifications')
    .insert({
      user_id:  user.id,
      type:     type ?? 'Systeem',
      titel:    titel ?? null,
      bericht,
      link_url: link_url ?? null,
      metadata: metadata ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ notification: data }, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { action } = body

  if (action === 'mark_all_read') {
    const { error } = await supabase
      .from('notifications')
      .update({ gelezen: true })
      .eq('user_id', user.id)
      .eq('gelezen', false)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'unknown action' }, { status: 400 })
}
