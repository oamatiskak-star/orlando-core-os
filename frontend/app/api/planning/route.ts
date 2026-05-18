import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const revalidate = 0

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sp        = req.nextUrl.searchParams
  const status    = sp.get('status') ?? ''
  const projectId = sp.get('project_id') ?? ''
  const type      = sp.get('type') ?? ''

  let q = supabase
    .from('planning_items')
    .select('*, project:projects(id,name), company:companies(id,name)', { count: 'exact' })
    .order('due_date', { ascending: true, nullsFirst: false })

  if (status)    q = q.eq('status', status)
  if (projectId) q = q.eq('project_id', projectId)
  if (type)      q = q.eq('type', type)

  const { data, error, count } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ items: data ?? [], total: count ?? 0 })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { titel, type, project_id, company_id, priority, beschrijving, toegewezen, start_date, due_date, notes } = body

  if (!titel) return NextResponse.json({ error: 'titel vereist' }, { status: 400 })

  const { data, error } = await supabase
    .from('planning_items')
    .insert({
      titel,
      type:        type ?? 'taak',
      status:      'open',
      priority:    priority ?? 'normaal',
      project_id:  project_id ?? null,
      company_id:  company_id ?? null,
      beschrijving:beschrijving ?? null,
      toegewezen:  toegewezen ?? null,
      start_date:  start_date ?? null,
      due_date:    due_date ?? null,
      notes:       notes ?? null,
    })
    .select('*, project:projects(id,name)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ item: data }, { status: 201 })
}
