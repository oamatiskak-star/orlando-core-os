import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const revalidate = 0

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sp        = req.nextUrl.searchParams
  const map       = sp.get('map') ?? ''
  const companyId = sp.get('company_id') ?? ''
  const projectId = sp.get('project_id') ?? ''

  let q = supabase
    .from('company_documents')
    .select('*, company:companies(id,name), project:projects(id,name)', { count: 'exact' })
    .order('created_at', { ascending: false })

  if (map)       q = q.eq('map', map)
  if (companyId) q = q.eq('company_id', companyId)
  if (projectId) q = q.eq('project_id', projectId)

  const { data, error, count } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ documents: data ?? [], total: count ?? 0 })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { naam, map, company_id, project_id, bestandstype, bestandsgrootte, url, notes } = body

  if (!naam) return NextResponse.json({ error: 'naam vereist' }, { status: 400 })

  const { data, error } = await supabase
    .from('company_documents')
    .insert({
      naam,
      map:            map ?? 'Gedeeld',
      company_id:     company_id ?? null,
      project_id:     project_id ?? null,
      bestandstype:   bestandstype ?? null,
      bestandsgrootte:bestandsgrootte ?? null,
      url:            url ?? null,
      notes:          notes ?? null,
    })
    .select('*, company:companies(id,name), project:projects(id,name)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ document: data }, { status: 201 })
}
