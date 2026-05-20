import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const revalidate = 0

// GET /api/media-holding/competitors/signals?status=open|all
// Cross-competitor signal feed voor de surveillance-dashboard alert lane.
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const status = req.nextUrl.searchParams.get('status') ?? 'open'
  const limit  = Math.max(1, Math.min(500, Number(req.nextUrl.searchParams.get('limit') ?? '100')))

  let q = supabase
    .from('competitor_signals')
    .select(`
      *,
      competitor:competitor_channels!inner ( id, name, platform, niche, thumbnail_url, url ),
      video:competitor_videos ( id, title, url, thumbnail_url, views, published_at )
    `)
    .order('detected_at', { ascending: false })
    .limit(limit)

  if (status === 'open') q = q.is('acknowledged_at', null)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ signals: data ?? [] })
}

// PATCH /api/media-holding/competitors/signals
// Body: { id, acknowledged: true }
export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  if (!body.id) return NextResponse.json({ error: 'id vereist' }, { status: 400 })

  const patch = body.acknowledged
    ? { acknowledged_at: new Date().toISOString(), acknowledged_by: user.id }
    : { acknowledged_at: null, acknowledged_by: null }

  const { data, error } = await supabase
    .from('competitor_signals')
    .update(patch)
    .eq('id', body.id)
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ signal: data })
}
