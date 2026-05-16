import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const revalidate = 0

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sp         = req.nextUrl.searchParams
  const status     = sp.get('status') ?? ''
  const companyId  = sp.get('company_id') ?? ''
  const type       = sp.get('type') ?? ''

  let q = supabase
    .from('employees')
    .select('*, company:companies(id,name)', { count: 'exact' })
    .order('name', { ascending: true })

  if (status)    q = q.eq('status', status)
  if (companyId) q = q.eq('company_id', companyId)
  if (type)      q = q.eq('type', type)

  const { data, error, count } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ employees: data ?? [], total: count ?? 0 })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { name, email, phone, type, job_title, company_id, start_date, end_date, hourly_rate, monthly_salary, hours_per_week, bsn, iban, notes } = body

  if (!name) return NextResponse.json({ error: 'naam vereist' }, { status: 400 })

  const { data, error } = await supabase
    .from('employees')
    .insert({
      name,
      email:          email ?? null,
      phone:          phone ?? null,
      type:           type ?? 'medewerker',
      job_title:      job_title ?? null,
      company_id:     company_id ?? null,
      start_date:     start_date ?? null,
      end_date:       end_date ?? null,
      hourly_rate:    hourly_rate ? Number(hourly_rate) : null,
      monthly_salary: monthly_salary ? Number(monthly_salary) : null,
      hours_per_week: hours_per_week ? Number(hours_per_week) : null,
      bsn:            bsn ?? null,
      iban:           iban ?? null,
      notes:          notes ?? null,
      status:         'actief',
    })
    .select('*, company:companies(id,name)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ employee: data }, { status: 201 })
}
