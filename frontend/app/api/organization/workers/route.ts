import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const revalidate = 0

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sp = req.nextUrl.searchParams
  const status = sp.get('status')
  const worker_type = sp.get('type')
  const limit = parseInt(sp.get('limit') ?? '100')
  const offset = parseInt(sp.get('offset') ?? '0')

  const { data, error } = await supabase.rpc('get_organization_workers', {
    p_status: status,
    p_worker_type: worker_type,
    p_limit: limit,
    p_offset: offset,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ workers: data ?? [] })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const {
    worker_name,
    worker_type,
    host,
    port,
    metadata = {},
  } = body

  if (!worker_name || !worker_type || !host) {
    return NextResponse.json(
      { error: 'Missing required fields: worker_name, worker_type, host' },
      { status: 400 }
    )
  }

  const { data, error } = await supabase
    .from('organization_workers')
    .upsert({
      worker_name,
      worker_type,
      host,
      port,
      status: 'idle',
      metadata,
      last_heartbeat: new Date(),
    }, { onConflict: 'worker_name' })
    .select()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ worker: data?.[0] }, { status: 201 })
}
