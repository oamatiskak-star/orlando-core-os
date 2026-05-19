import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const revalidate = 0

export async function GET(_req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('autopilot_config')
    .select('*')
    .order('link_key')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ config: data ?? [] })
}

// PATCH /api/media-holding/autopilot/config
// Body: { link_key: string, enabled?: bool, threshold?: number }
export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  if (!body.link_key) return NextResponse.json({ error: 'link_key vereist' }, { status: 400 })

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (typeof body.enabled === 'boolean') patch.enabled = body.enabled
  if (typeof body.threshold === 'number') patch.threshold = body.threshold

  const { data, error } = await supabase
    .from('autopilot_config')
    .update(patch)
    .eq('link_key', body.link_key)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ config: data })
}
