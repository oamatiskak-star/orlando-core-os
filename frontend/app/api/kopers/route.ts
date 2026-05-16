import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const revalidate = 0

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sp        = req.nextUrl.searchParams
  const type      = sp.get('type') ?? ''
  const status    = sp.get('status') ?? ''
  const projectId = sp.get('project_id') ?? ''

  let q = supabase
    .from('kopers_huurders')
    .select('*, project:projects(id,name), company:companies(id,name)', { count: 'exact' })
    .order('created_at', { ascending: false })

  if (type)      q = q.eq('type', type)
  if (status)    q = q.eq('status', status)
  if (projectId) q = q.eq('project_id', projectId)

  const { data, error, count } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ kopers: data ?? [], total: count ?? 0 })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { naam, type, project_id, company_id, email, telefoon, adres, bsn, koopsom, huurprijs, bouwnummer, notaris, leverdatum, tekendatum, opleverdatum, notes } = body

  if (!naam) return NextResponse.json({ error: 'naam vereist' }, { status: 400 })

  const { data, error } = await supabase
    .from('kopers_huurders')
    .insert({
      naam,
      type:        type ?? 'koper',
      status:      'prospect',
      project_id:  project_id ?? null,
      company_id:  company_id ?? null,
      email:       email ?? null,
      telefoon:    telefoon ?? null,
      adres:       adres ?? null,
      bsn:         bsn ?? null,
      koopsom:     koopsom ? Number(koopsom) : null,
      huurprijs:   huurprijs ? Number(huurprijs) : null,
      bouwnummer:  bouwnummer ?? null,
      notaris:     notaris ?? null,
      leverdatum:  leverdatum ?? null,
      tekendatum:  tekendatum ?? null,
      opleverdatum:opleverdatum ?? null,
      notes:       notes ?? null,
    })
    .select('*, project:projects(id,name), company:companies(id,name)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ koper: data }, { status: 201 })
}
