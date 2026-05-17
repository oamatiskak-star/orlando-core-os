import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = new URL(req.url)
  const dossier_id   = searchParams.get('dossier_id')
  const source_filter = searchParams.get('source')
  const relevance    = searchParams.get('relevance')

  if (!dossier_id) return NextResponse.json({ error: 'dossier_id vereist' }, { status: 400 })

  let q = supabase
    .from('advocaat_tijdlijn')
    .select(`*, advocaat_documenten ( id, title, document_type )`)
    .eq('dossier_id', dossier_id)
    .order('event_date', { ascending: true })

  if (source_filter) q = q.eq('source', source_filter)
  if (relevance)     q = q.eq('legal_relevance', relevance)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ events: data ?? [] })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const body = await req.json()

  const {
    dossier_id, document_id, event_date, event_type,
    title, description, source, confidence_score,
    participants, legal_relevance, notes,
  } = body

  if (!dossier_id || !event_date || !title) {
    return NextResponse.json({ error: 'dossier_id, event_date, title vereist' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('advocaat_tijdlijn')
    .insert({
      dossier_id,
      document_id: document_id ?? null,
      event_date,
      event_type: event_type ?? 'overig',
      title,
      description: description ?? '',
      source: source ?? 'ONBEKEND',
      confidence_score: confidence_score ?? 50,
      participants: participants ?? [],
      legal_relevance: legal_relevance ?? 'laag',
      notes: notes ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await supabase.from('advocaat_audit_log').insert({
    dossier_id,
    action: 'tijdlijn_event_toegevoegd',
    actor: 'gebruiker',
    description: `Tijdlijn event: ${title} (${event_date})`,
    metadata: { event_type, source },
  })

  return NextResponse.json({ event: data }, { status: 201 })
}
