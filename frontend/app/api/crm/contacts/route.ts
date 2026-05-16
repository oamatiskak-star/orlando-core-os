import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const revalidate = 0

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sp     = req.nextUrl.searchParams
  const search = sp.get('search') ?? ''
  const type   = sp.get('type') ?? ''
  const prio   = sp.get('priority') ?? ''
  const limit  = Math.min(parseInt(sp.get('limit') ?? '100'), 500)
  const offset = parseInt(sp.get('offset') ?? '0')

  let q = supabase
    .from('mail_contacts')
    .select('*', { count: 'exact' })
    .order('last_interaction_at', { ascending: false, nullsFirst: false })
    .range(offset, offset + limit - 1)

  if (search) {
    q = q.or(`name.ilike.%${search}%,email.ilike.%${search}%,company.ilike.%${search}%`)
  }
  if (type)  q = q.eq('contact_type', type)
  if (prio)  q = q.eq('priority', prio)

  const { data, error, count } = await q

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ contacts: data ?? [], total: count ?? 0 })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { name, email, company, contact_type, priority, notes } = body

  if (!email) return NextResponse.json({ error: 'email vereist' }, { status: 400 })

  const { data, error } = await supabase
    .from('mail_contacts')
    .insert({
      name:          name ?? null,
      email,
      company:       company ?? null,
      contact_type:  contact_type ?? 'overig',
      priority:      priority ?? 'normaal',
      notes:         notes ?? null,
      total_interactions: 0,
      open_actions:       0,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ contact: data }, { status: 201 })
}
