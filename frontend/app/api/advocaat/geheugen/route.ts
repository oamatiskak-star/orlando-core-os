import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = new URL(req.url)
  const dossier_id = searchParams.get('dossier_id')
  const type       = searchParams.get('type')
  const query      = searchParams.get('q')
  const limit      = parseInt(searchParams.get('limit') ?? '50')

  let q = supabase
    .from('advocaat_geheugen')
    .select('*')
    .eq('is_active', true)
    .order('last_used_at', { ascending: false })
    .limit(limit)

  if (dossier_id) q = q.eq('dossier_id', dossier_id)
  if (type)       q = q.eq('type', type)
  if (query)      q = q.or(`subject.ilike.%${query}%,content.ilike.%${query}%,tags.cs.{${query}}`)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ memories: data ?? [] })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const body = await req.json()
  const { dossier_id, type, subject, content, confidence, source_document_ids, tags } = body

  if (!type || !subject || !content) {
    return NextResponse.json({ error: 'type, subject en content vereist' }, { status: 400 })
  }

  // Upsert op subject + type + dossier (voorkom duplicaten)
  const { data: existing } = await supabase
    .from('advocaat_geheugen')
    .select('id, times_used')
    .eq('type', type)
    .eq('subject', subject)
    .eq('dossier_id', dossier_id ?? null)
    .maybeSingle()

  if (existing) {
    const { data, error } = await supabase
      .from('advocaat_geheugen')
      .update({
        content,
        confidence: confidence ?? 0.80,
        source_document_ids: source_document_ids ?? [],
        tags: tags ?? [],
        last_used_at: new Date().toISOString(),
        times_used: existing.times_used + 1,
      })
      .eq('id', existing.id)
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ memory: data, updated: true })
  }

  const { data, error } = await supabase
    .from('advocaat_geheugen')
    .insert({
      dossier_id:          dossier_id ?? null,
      type,
      subject,
      content,
      confidence:          confidence ?? 0.80,
      source_document_ids: source_document_ids ?? [],
      tags:                tags ?? [],
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ memory: data, updated: false })
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { id, ...updates } = await req.json()
  if (!id) return NextResponse.json({ error: 'id vereist' }, { status: 400 })

  const { data, error } = await supabase
    .from('advocaat_geheugen')
    .update({ ...updates, last_used_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ memory: data })
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'id vereist' }, { status: 400 })

  // Soft delete
  const { error } = await supabase
    .from('advocaat_geheugen')
    .update({ is_active: false })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ deleted: true })
}
