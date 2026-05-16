import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const revalidate = 0

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sp         = req.nextUrl.searchParams
  const status     = sp.get('status') ?? ''
  const employeeId = sp.get('employee_id') ?? ''

  let q = supabase
    .from('hr_contracts')
    .select('*, employee:employees(id,name,job_title)', { count: 'exact' })
    .order('created_at', { ascending: false })

  if (status)     q = q.eq('status', status)
  if (employeeId) q = q.eq('employee_id', employeeId)

  const { data, error, count } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ contracts: data ?? [], total: count ?? 0 })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { employee_id, company_id, type, start_date, end_date, salary, hours_per_week, file_url, notes } = body

  if (!employee_id) return NextResponse.json({ error: 'employee_id vereist' }, { status: 400 })

  const { data, error } = await supabase
    .from('hr_contracts')
    .insert({
      employee_id,
      company_id:    company_id ?? null,
      type:          type ?? 'arbeidscontract',
      status:        'actief',
      start_date:    start_date ?? null,
      end_date:      end_date ?? null,
      salary:        salary ? Number(salary) : null,
      hours_per_week: hours_per_week ? Number(hours_per_week) : null,
      file_url:      file_url ?? null,
      notes:         notes ?? null,
    })
    .select('*, employee:employees(id,name,job_title)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ contract: data }, { status: 201 })
}
