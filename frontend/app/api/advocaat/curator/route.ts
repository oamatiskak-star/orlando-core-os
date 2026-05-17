import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = new URL(req.url)
  const dossier_id = searchParams.get('dossier_id')

  let q = supabase
    .from('advocaat_curator')
    .select(`*, advocaat_dossiers ( id, title, status, risk_score )`)
    .order('created_at', { ascending: false })

  if (dossier_id) q = q.eq('dossier_id', dossier_id)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ curatoren: data ?? [] })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const body = await req.json()

  const {
    dossier_id, bedrijf_naam, kvk_nummer, insolventienummer,
    rechtbank, faillissementsdatum, curator_naam, curator_kantoor,
    curator_email, boedel_vordering, betwiste_vordering, notes,
    aansprakelijkheid_risk, pauliana_risk,
  } = body

  if (!dossier_id || !bedrijf_naam) {
    return NextResponse.json({ error: 'dossier_id en bedrijf_naam vereist' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('advocaat_curator')
    .insert({
      dossier_id,
      bedrijf_naam,
      kvk_nummer: kvk_nummer ?? null,
      insolventienummer: insolventienummer ?? null,
      rechtbank: rechtbank ?? null,
      faillissementsdatum: faillissementsdatum ?? null,
      curator_naam: curator_naam ?? null,
      curator_kantoor: curator_kantoor ?? null,
      curator_email: curator_email ?? null,
      boedel_vordering: boedel_vordering ?? null,
      betwiste_vordering: betwiste_vordering ?? null,
      notes: notes ?? null,
      aansprakelijkheid_risk: aansprakelijkheid_risk ?? false,
      pauliana_risk: pauliana_risk ?? false,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await supabase.from('advocaat_audit_log').insert({
    dossier_id,
    action: 'curator_toegevoegd',
    actor: 'gebruiker',
    description: `Curator dossier aangemaakt voor ${bedrijf_naam}`,
    metadata: { kvk_nummer, curator_naam },
  })

  return NextResponse.json({ curator: data }, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const body = await req.json()
  const { id, ...updates } = body

  if (!id) return NextResponse.json({ error: 'id vereist' }, { status: 400 })

  const { data, error } = await supabase
    .from('advocaat_curator')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ curator: data })
}
