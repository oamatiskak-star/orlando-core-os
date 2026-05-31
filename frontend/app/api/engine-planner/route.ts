import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

// GET: volledige planner — blokken + engines (met live window-status).
export async function GET() {
  const admin = createAdminClient()
  const [blocksRes, enginesRes] = await Promise.all([
    admin.from('engine_schedule_blocks').select('*').order('sort'),
    admin.from('v_engine_planner').select('*').order('grp').order('label'),
  ])
  if (blocksRes.error) return NextResponse.json({ error: blocksRes.error.message }, { status: 500 })
  return NextResponse.json({ blocks: blocksRes.data ?? [], engines: enginesRes.data ?? [] })
}

// POST: muteer planner.
//  { action:'assign', engine_key, block_key }     → engine naar ander blok
//  { action:'toggle_engine', engine_key, enabled }
//  { action:'update_block', block_key, window_start?, window_end?, days?, enabled? }
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const admin = createAdminClient()
  const now = new Date().toISOString()

  if (body.action === 'assign' && body.engine_key) {
    const { error } = await admin.from('engine_schedule')
      .update({ block_key: body.block_key ?? null, updated_at: now })
      .eq('engine_key', body.engine_key)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (body.action === 'toggle_engine' && body.engine_key) {
    const { error } = await admin.from('engine_schedule')
      .update({ enabled: !!body.enabled, updated_at: now })
      .eq('engine_key', body.engine_key)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (body.action === 'update_block' && body.block_key) {
    const patch: Record<string, unknown> = { updated_at: now }
    if (typeof body.window_start === 'string') patch.window_start = body.window_start
    if (typeof body.window_end === 'string') patch.window_end = body.window_end
    if (Array.isArray(body.days)) patch.days = body.days
    if (typeof body.enabled === 'boolean') patch.enabled = body.enabled
    const { error } = await admin.from('engine_schedule_blocks')
      .update(patch).eq('block_key', body.block_key)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'onbekende actie' }, { status: 400 })
}
