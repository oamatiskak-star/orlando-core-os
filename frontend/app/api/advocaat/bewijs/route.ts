import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = new URL(req.url)
  const dossier_id    = searchParams.get('dossier_id')
  const evidence_only = searchParams.get('evidence_only') === 'true'
  const label         = searchParams.get('label')
  const limit         = parseInt(searchParams.get('limit') ?? '200')

  let q = supabase
    .from('advocaat_documenten')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (dossier_id)    q = q.eq('dossier_id', dossier_id)
  if (evidence_only) q = q.eq('is_evidence', true)
  if (label)         q = q.eq('content_label', label)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ documents: data ?? [] })
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const body = await req.json()
  const { id, is_evidence, evidence_strength, content_label, ai_summary, tags } = body

  if (!id) return NextResponse.json({ error: 'id vereist' }, { status: 400 })

  const updates: Record<string, unknown> = {}
  if (is_evidence !== undefined)      updates.is_evidence = is_evidence
  if (evidence_strength !== undefined) updates.evidence_strength = evidence_strength
  if (content_label !== undefined)    updates.content_label = content_label
  if (ai_summary !== undefined)       updates.ai_summary = ai_summary
  if (tags !== undefined)             updates.tags = tags

  const { data, error } = await supabase
    .from('advocaat_documenten')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ document: data })
}
