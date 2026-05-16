import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const revalidate = 0

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sp         = req.nextUrl.searchParams
  const employeeId = sp.get('employee_id') ?? ''
  const docType    = sp.get('doc_type') ?? ''

  let q = supabase
    .from('hr_documents')
    .select('*, employee:employees(id,name)', { count: 'exact' })
    .order('created_at', { ascending: false })

  if (employeeId) q = q.eq('employee_id', employeeId)
  if (docType)    q = q.eq('doc_type', docType)

  const { data, error, count } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ documents: data ?? [], total: count ?? 0 })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { employee_id, company_id, doc_type, title, file_url, expires_at, notes } = body

  if (!title) return NextResponse.json({ error: 'titel vereist' }, { status: 400 })

  const { data, error } = await supabase
    .from('hr_documents')
    .insert({
      employee_id: employee_id ?? null,
      company_id:  company_id ?? null,
      doc_type:    doc_type ?? 'overig',
      title,
      file_url:    file_url ?? null,
      expires_at:  expires_at ?? null,
      notes:       notes ?? null,
    })
    .select('*, employee:employees(id,name)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ document: data }, { status: 201 })
}
