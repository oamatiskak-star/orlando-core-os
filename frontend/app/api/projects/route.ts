import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const revalidate = 0

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sp     = req.nextUrl.searchParams
  const status = sp.get('status') ?? ''
  const companyId = sp.get('company_id') ?? ''

  let q = supabase
    .from('projects')
    .select('*, company:companies(id,name)', { count: 'exact' })
    .order('created_at', { ascending: false })

  if (status)    q = q.eq('status', status)
  if (companyId) q = q.eq('company_id', companyId)

  const { data, error, count } = await q

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ projects: data ?? [], total: count ?? 0 })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { name, type, status, company_id, budget, location, address, start_date, end_date, notes } = body

  if (!name) return NextResponse.json({ error: 'naam vereist' }, { status: 400 })
  if (!type) return NextResponse.json({ error: 'type vereist' }, { status: 400 })

  const { data, error } = await supabase
    .from('projects')
    .insert({
      name,
      type,
      status:     status ?? 'planning',
      company_id: company_id ?? null,
      budget:     budget ? Number(budget) : null,
      spent:      0,
      location:   location ?? null,
      address:    address ?? null,
      start_date: start_date ?? null,
      end_date:   end_date ?? null,
      notes:      notes ?? null,
    })
    .select('*, company:companies(id,name)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ project: data }, { status: 201 })
}
