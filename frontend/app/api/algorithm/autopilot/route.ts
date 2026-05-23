import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const revalidate = 0
export const dynamic = 'force-dynamic'

const ALLOWED_KEYS = new Set([
  'gravity_to_winner',
  'gravity_to_language',
  'viral_to_factory',
  'upload_to_crossplatform',
])

export async function PATCH(req: NextRequest) {
  let body: { link_key?: string; enabled?: boolean }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.link_key || !ALLOWED_KEYS.has(body.link_key)) {
    return NextResponse.json({ error: 'Unknown link_key' }, { status: 400 })
  }
  if (typeof body.enabled !== 'boolean') {
    return NextResponse.json({ error: 'enabled must be boolean' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('autopilot_config')
    .update({ enabled: body.enabled, updated_at: new Date().toISOString() })
    .eq('link_key', body.link_key)
    .select('link_key,enabled')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, link: data })
}
