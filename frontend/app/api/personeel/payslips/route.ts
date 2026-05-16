import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const revalidate = 0

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sp         = req.nextUrl.searchParams
  const employeeId = sp.get('employee_id') ?? ''
  const period     = sp.get('period') ?? ''

  let q = supabase
    .from('payslips')
    .select('*, employee:employees(id,name)', { count: 'exact' })
    .order('period', { ascending: false })

  if (employeeId) q = q.eq('employee_id', employeeId)
  if (period)     q = q.eq('period', period)

  const { data, error, count } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ payslips: data ?? [], total: count ?? 0 })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { employee_id, company_id, period, gross_salary, net_salary, file_url, notes } = body

  if (!employee_id) return NextResponse.json({ error: 'employee_id vereist' }, { status: 400 })
  if (!period)      return NextResponse.json({ error: 'period vereist' }, { status: 400 })

  const { data, error } = await supabase
    .from('payslips')
    .insert({
      employee_id,
      company_id:   company_id ?? null,
      period,
      gross_salary: gross_salary ? Number(gross_salary) : null,
      net_salary:   net_salary ? Number(net_salary) : null,
      file_url:     file_url ?? null,
      notes:        notes ?? null,
    })
    .select('*, employee:employees(id,name)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ payslip: data }, { status: 201 })
}
