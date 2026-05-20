import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const revalidate = 0

// GET /api/media-holding/competitors/[id]
// Detail + recente videos + open signals.
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await ctx.params
  const [{ data: competitor, error: cErr }, { data: videos }, { data: signals }] = await Promise.all([
    supabase.from('competitor_channels').select('*').eq('id', id).single(),
    supabase.from('competitor_videos').select('*').eq('competitor_id', id)
      .order('published_at', { ascending: false, nullsFirst: false }).limit(50),
    supabase.from('competitor_signals').select('*').eq('competitor_id', id)
      .order('detected_at', { ascending: false }).limit(100),
  ])

  if (cErr) return NextResponse.json({ error: cErr.message }, { status: 404 })
  return NextResponse.json({
    competitor,
    videos:  videos  ?? [],
    signals: signals ?? [],
  })
}

const PATCHABLE = new Set(['name','handle','niche','language','notes','active','watched_by_channel','url','thumbnail_url'])

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await ctx.params
  const body = await req.json().catch(() => ({}))
  const patch: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(body)) {
    if (PATCHABLE.has(k)) patch[k] = v
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Geen geldige velden' }, { status: 400 })
  }
  patch.updated_at = new Date().toISOString()

  const { data, error } = await supabase
    .from('competitor_channels')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ competitor: data })
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await ctx.params
  const { error } = await supabase
    .from('competitor_channels')
    .update({ active: false, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
