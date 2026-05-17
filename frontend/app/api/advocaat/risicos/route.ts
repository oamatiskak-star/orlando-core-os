import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = new URL(req.url)
  const dossier_id = searchParams.get('dossier_id')
  const severity   = searchParams.get('severity')
  const open_only  = searchParams.get('open') !== 'false'

  let q = supabase
    .from('advocaat_risicos')
    .select('*')
    .order('severity', { ascending: false })
    .order('probability', { ascending: false })

  if (dossier_id) q = q.eq('dossier_id', dossier_id)
  if (severity)   q = q.eq('severity', severity)
  if (open_only)  q = q.eq('is_resolved', false)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ risicos: data ?? [] })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const body = await req.json()

  const {
    dossier_id, risk_type, severity, probability,
    title, description, recommended_action, legal_basis, deadline,
  } = body

  if (!dossier_id || !title || !risk_type) {
    return NextResponse.json({ error: 'dossier_id, title, risk_type vereist' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('advocaat_risicos')
    .insert({
      dossier_id,
      risk_type,
      severity: severity ?? 'medium',
      probability: probability ?? 50,
      title,
      description: description ?? '',
      recommended_action: recommended_action ?? null,
      legal_basis: legal_basis ?? null,
      deadline: deadline ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const newScore = await supabase.rpc('advocaat_compute_risk_score', { p_dossier_id: dossier_id })
  if (!newScore.error && newScore.data != null) {
    await supabase.from('advocaat_dossiers').update({ risk_score: newScore.data }).eq('id', dossier_id)
  }

  return NextResponse.json({ risico: data }, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { id, dossier_id, is_resolved, resolution_notes } = await req.json()

  if (!id) return NextResponse.json({ error: 'id vereist' }, { status: 400 })

  const { data, error } = await supabase
    .from('advocaat_risicos')
    .update({
      is_resolved: is_resolved ?? true,
      resolved_at: is_resolved ? new Date().toISOString() : null,
      resolution_notes: resolution_notes ?? null,
    })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (dossier_id) {
    const newScore = await supabase.rpc('advocaat_compute_risk_score', { p_dossier_id: dossier_id })
    if (!newScore.error && newScore.data != null) {
      await supabase.from('advocaat_dossiers').update({ risk_score: newScore.data }).eq('id', dossier_id)
    }
  }

  return NextResponse.json({ risico: data })
}
