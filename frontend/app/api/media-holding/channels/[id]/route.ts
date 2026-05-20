import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const revalidate = 0

// GET /api/media-holding/channels/[id]
// Single channel record — gebruikt door Settings module.
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await ctx.params
  const { data, error } = await supabase
    .from('media_holding_channels')
    .select('*')
    .eq('id', id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json({ channel: data })
}

// PATCH /api/media-holding/channels/[id]
// Body: gedeeltelijke channel-update. Alleen toegestane kolommen.
const ALLOWED_FIELDS = new Set([
  'name', 'handle', 'niche', 'language', 'persona_owner', 'status',
  'target_views_10d', 'branding', 'upload_strategy', 'posting_schedule',
])
const ALLOWED_STATUSES = new Set(['idea', 'incubating', 'live', 'scaling', 'killed', 'paused'])

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
    if (ALLOWED_FIELDS.has(k)) patch[k] = v
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Geen geldige velden in body' }, { status: 400 })
  }
  if (patch.status && !ALLOWED_STATUSES.has(patch.status as string)) {
    return NextResponse.json({ error: `status moet één van: ${[...ALLOWED_STATUSES].join(', ')}` }, { status: 400 })
  }
  if (patch.target_views_10d !== undefined) {
    const n = Number(patch.target_views_10d)
    if (!Number.isFinite(n) || n < 0) {
      return NextResponse.json({ error: 'target_views_10d moet een positief getal zijn' }, { status: 400 })
    }
    patch.target_views_10d = n
  }
  patch.updated_at = new Date().toISOString()

  const { data, error } = await supabase
    .from('media_holding_channels')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ channel: data })
}

// DELETE /api/media-holding/channels/[id]
export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await ctx.params
  const { error } = await supabase
    .from('media_holding_channels')
    .delete()
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
