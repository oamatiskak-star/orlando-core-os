import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const revalidate = 0

export async function GET(_req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('media_holding_workers')
    .select('*')
    .order('kind', { ascending: true })
    .order('name', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Vercel-cron heartbeats — de echte pipeline (analyse, scraper, sync).
  // Via admin-client want infra_watchdog_heartbeats heeft strakke RLS.
  const admin = createAdminClient()
  const { data: crons } = await admin
    .from('infra_watchdog_heartbeats')
    .select('slug, last_seen_at, status')
    .like('slug', 'cron.vercel.%')
    .order('last_seen_at', { ascending: false })

  return NextResponse.json({ workers: data ?? [], crons: crons ?? [] })
}

// Handmatige ingreep op een worker: reset error-state, pauzeer of hervat.
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const id = typeof body.id === 'string' ? body.id : null
  const action = body.action as string | undefined
  if (!id) return NextResponse.json({ error: 'id vereist' }, { status: 400 })

  let patch: Record<string, unknown>
  if (action === 'reset')       patch = { status: 'idle', last_error: null }
  else if (action === 'pause')  patch = { status: 'paused' }
  else if (action === 'resume') patch = { status: 'idle', last_error: null }
  else return NextResponse.json({ error: 'onbekende actie' }, { status: 400 })

  const admin = createAdminClient()
  const { error } = await admin.from('media_holding_workers').update(patch).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
