import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { host_id?: unknown; deploy_id?: unknown }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const host_id = typeof body.host_id === 'string' ? body.host_id : null
  const deploy_id = typeof body.deploy_id === 'string' ? body.deploy_id : null
  if (!host_id || !deploy_id) {
    return NextResponse.json({ error: 'host_id and deploy_id required' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('infra_watchdog_incidents')
    .update({ status: 'resolved', resolved_at: new Date().toISOString() })
    .eq('host_id', host_id)
    .eq('deploy_id', deploy_id)
    .eq('status', 'open')
    .select('host_id, deploy_id, service_name')
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Not found or already resolved' }, { status: 404 })

  await admin.from('infra_watchdog_events').insert({
    host_id,
    service_id: `pm2:${data.service_name}`,
    service_name: data.service_name,
    service_type: host_id === 'render' ? 'render' : 'pm2',
    kind: 'recovered',
    deploy_id,
    message: `manually resolved by ${user.email ?? user.id}`,
  })

  return NextResponse.json({ ok: true, resolved: data })
}
