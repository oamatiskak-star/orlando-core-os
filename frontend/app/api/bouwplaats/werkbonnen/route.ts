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
    .from('werkbonnen')
    .select('*, project:projects(id,name), employee:employees(id,name)', { count: 'exact' })
    .order('datum', { ascending: false })

  if (status)    q = q.eq('status', status)
  if (projectId) q = q.eq('project_id', projectId)
  if (type)      q = q.eq('type', type)

  const { data, error, count } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ werkbonnen: data ?? [], total: count ?? 0 })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { project_id, employee_id, company_id, datum, type, status, omschrijving, locatie, uren, materiaal, opmerkingen } = body

  const { data, error } = await supabase
    .from('werkbonnen')
    .insert({
      project_id:   project_id ?? null,
      employee_id:  employee_id ?? null,
      company_id:   company_id ?? null,
      datum:        datum ?? new Date().toISOString().split('T')[0],
      type:         type ?? 'normaal',
      status:       status ?? 'concept',
      omschrijving: omschrijving ?? null,
      locatie:      locatie ?? null,
      uren:         uren ? Number(uren) : null,
      materiaal:    materiaal ?? null,
      opmerkingen:  opmerkingen ?? null,
    })
    .select('*, project:projects(id,name), employee:employees(id,name)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ werkbon: data }, { status: 201 })
}
