import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = new URL(req.url)
  const status   = searchParams.get('status')
  const priority = searchParams.get('priority')
  const type     = searchParams.get('type')
  const limit    = parseInt(searchParams.get('limit') ?? '50')

  let q = supabase
    .from('advocaat_dossiers')
    .select(`
      *,
      advocaat_curator ( id, bedrijf_naam, curator_naam, risk_level, status, next_deadline ),
      risico_count:advocaat_risicos!advocaat_risicos_dossier_id_fkey ( id ),
      document_count:advocaat_documenten!advocaat_documenten_dossier_id_fkey ( id )
    `)
    .eq('is_archived', false)
    .order('risk_score', { ascending: false })
    .limit(limit)

  if (status)   q = q.eq('status', status)
  if (priority) q = q.eq('priority', priority)
  if (type)     q = q.eq('dossier_type', type)

  const { data, error } = await q

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ dossiers: data ?? [] })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const body = await req.json()

  const {
    title, description, dossier_type, priority,
    wederpartij, wederpartij_email, advocaat_naam,
    rechtbank, zaaknummer, inzet_bedrag,
    next_deadline, next_action, tags,
  } = body

  if (!title) return NextResponse.json({ error: 'title vereist' }, { status: 400 })

  const { data, error } = await supabase
    .from('advocaat_dossiers')
    .insert({
      title,
      description: description ?? null,
      dossier_type: dossier_type ?? 'overig',
      priority: priority ?? 'medium',
      wederpartij: wederpartij ?? null,
      wederpartij_email: wederpartij_email ?? null,
      advocaat_naam: advocaat_naam ?? null,
      rechtbank: rechtbank ?? null,
      zaaknummer: zaaknummer ?? null,
      inzet_bedrag: inzet_bedrag ?? null,
      next_deadline: next_deadline ?? null,
      next_action: next_action ?? null,
      tags: tags ?? [],
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await supabase.from('advocaat_audit_log').insert({
    dossier_id: data.id,
    action: 'dossier_aangemaakt',
    actor: 'gebruiker',
    description: `Nieuw dossier aangemaakt: ${title}`,
    metadata: { dossier_type, priority },
  })

  return NextResponse.json({ dossier: data }, { status: 201 })
}
