import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const revalidate = 0

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const companyId = req.nextUrl.searchParams.get('company_id') ?? ''

  let q = supabase
    .from('ubo_records')
    .select('*, company:companies(id,name)', { count: 'exact' })
    .order('created_at', { ascending: false })

  if (companyId) q = q.eq('company_id', companyId)

  const { data, error, count } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ records: data ?? [], total: count ?? 0 })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { company_id, name, date_of_birth, nationality, percentage, address, registered_at, notes } = body

  if (!name) return NextResponse.json({ error: 'naam vereist' }, { status: 400 })

  const { data, error } = await supabase
    .from('ubo_records')
    .insert({
      company_id:    company_id ?? null,
      name,
      date_of_birth: date_of_birth ?? null,
      nationality:   nationality ?? null,
      percentage:    percentage ? Number(percentage) : null,
      address:       address ?? null,
      registered_at: registered_at ?? null,
      notes:         notes ?? null,
    })
    .select('*, company:companies(id,name)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ record: data }, { status: 201 })
}
