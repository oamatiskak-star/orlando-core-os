import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = new URL(req.url)
  const dossier_id    = searchParams.get('dossier_id')
  const evidence_only = searchParams.get('evidence_only') === 'true'
  const label         = searchParams.get('label')
  const doc_type      = searchParams.get('doc_type')
  const source        = searchParams.get('source')
  const search        = searchParams.get('search')
  const limit         = parseInt(searchParams.get('limit') ?? '100')
  const offset        = parseInt(searchParams.get('offset') ?? '0')

  let q = supabase
    .from('advocaat_documenten')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (dossier_id)    q = q.eq('dossier_id', dossier_id)
  if (evidence_only) q = q.eq('is_evidence', true)
  if (label)         q = q.eq('content_label', label)
  if (doc_type)      q = q.eq('document_type', doc_type)
  if (source)        q = q.eq('source', source)
  if (search)        q = q.or(
    `title.ilike.%${search}%,source_filename.ilike.%${search}%,raw_text.ilike.%${search}%,ai_summary.ilike.%${search}%`
  )

  const { data, error, count } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ documents: data ?? [], total: count ?? 0 })
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const body = await req.json()
  const { id, ids, is_evidence, evidence_strength, content_label, ai_summary, tags, dossier_id } = body

  // Bulk update
  if (ids && Array.isArray(ids)) {
    const updates: Record<string, unknown> = {}
    if (is_evidence !== undefined)      updates.is_evidence = is_evidence
    if (evidence_strength !== undefined) updates.evidence_strength = evidence_strength
    if (content_label !== undefined)    updates.content_label = content_label
    if (dossier_id !== undefined)       updates.dossier_id = dossier_id || null

    const { error } = await supabase
      .from('advocaat_documenten')
      .update(updates)
      .in('id', ids)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ updated: ids.length })
  }

  // Single update
  if (!id) return NextResponse.json({ error: 'id vereist' }, { status: 400 })

  const updates: Record<string, unknown> = {}
  if (is_evidence !== undefined)      updates.is_evidence = is_evidence
  if (evidence_strength !== undefined) updates.evidence_strength = evidence_strength
  if (content_label !== undefined)    updates.content_label = content_label
  if (ai_summary !== undefined)       updates.ai_summary = ai_summary
  if (tags !== undefined)             updates.tags = tags
  if (dossier_id !== undefined)       updates.dossier_id = dossier_id || null

  const { data, error } = await supabase
    .from('advocaat_documenten')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ document: data })
}
