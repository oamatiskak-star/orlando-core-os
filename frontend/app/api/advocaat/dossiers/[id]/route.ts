import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const [dossierRes, risicosRes, documentenRes, tijdlijnRes, curatorRes] = await Promise.all([
    supabase
      .from('advocaat_dossiers')
      .select('*')
      .eq('id', id)
      .single(),
    supabase
      .from('advocaat_risicos')
      .select('*')
      .eq('dossier_id', id)
      .eq('is_resolved', false)
      .order('severity', { ascending: false })
      .order('probability', { ascending: false })
      .limit(20),
    supabase
      .from('advocaat_documenten')
      .select('id, title, document_type, content_label, is_evidence, evidence_strength, document_date, source_filename, ai_summary, ai_risk_flags')
      .eq('dossier_id', id)
      .order('is_evidence', { ascending: false })
      .order('document_date', { ascending: false })
      .limit(50),
    supabase
      .from('advocaat_tijdlijn')
      .select('*')
      .eq('dossier_id', id)
      .order('event_date', { ascending: false })
      .limit(10),
    supabase
      .from('advocaat_curator')
      .select('*')
      .eq('dossier_id', id)
      .maybeSingle(),
  ])

  if (dossierRes.error) return NextResponse.json({ error: dossierRes.error.message }, { status: 404 })

  return NextResponse.json({
    dossier:    dossierRes.data,
    risicos:    risicosRes.data ?? [],
    documenten: documentenRes.data ?? [],
    tijdlijn:   tijdlijnRes.data ?? [],
    curator:    curatorRes.data ?? null,
  })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const body = await req.json()

  const allowed = [
    'title', 'description', 'status', 'priority', 'risk_score',
    'wederpartij', 'wederpartij_email', 'advocaat_naam', 'rechtbank',
    'zaaknummer', 'inzet_bedrag', 'next_deadline', 'next_action',
    'tags', 'key_dates', 'parties', 'ai_summary', 'ai_risk_analysis',
    'is_archived',
  ]
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const key of allowed) {
    if (key in body) update[key] = body[key]
  }

  const { data, error } = await supabase
    .from('advocaat_dossiers')
    .update(update)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await supabase.from('advocaat_audit_log').insert({
    dossier_id: id,
    action: 'dossier_bijgewerkt',
    actor: 'gebruiker',
    description: `Dossier bijgewerkt: ${Object.keys(update).filter(k => k !== 'updated_at').join(', ')}`,
    metadata: update,
  })

  return NextResponse.json({ dossier: data })
}
