import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const revalidate = 0

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sp         = req.nextUrl.searchParams
  const group_type = sp.get('group_type') ?? ''
  const status     = sp.get('status') ?? ''
  const priority   = sp.get('priority') ?? ''
  const limit      = Math.min(parseInt(sp.get('limit') ?? '100'), 500)
  const offset     = parseInt(sp.get('offset') ?? '0')

  let q = supabase
    .from('fb_group_deals')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (group_type) q = q.eq('group_type', group_type)
  if (status)     q = q.eq('status', status)
  if (priority)   q = q.eq('priority', priority)

  const { data, error, count } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ deals: data ?? [], total: count ?? 0 })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { group_type, title, description, asking_price, location, city, contact_name, contact_url, source_url, notes, priority } = body

  if (!title)      return NextResponse.json({ error: 'titel vereist' }, { status: 400 })
  if (!group_type) return NextResponse.json({ error: 'group_type vereist' }, { status: 400 })

  const { data, error } = await supabase
    .from('fb_group_deals')
    .insert({
      group_type,
      title,
      description:  description ?? null,
      asking_price: asking_price ? Number(asking_price) : null,
      location:     location ?? null,
      city:         city ?? null,
      contact_name: contact_name ?? null,
      contact_url:  contact_url ?? null,
      source_url:   source_url ?? null,
      notes:        notes ?? null,
      priority:     priority ?? 'normaal',
      status:       'nieuw',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ deal: data }, { status: 201 })
}
