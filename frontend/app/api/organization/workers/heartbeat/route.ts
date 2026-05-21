import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const revalidate = 0

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
    status = 'idle',
    current_task_id,
    queue_length = 0,
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
      status,
      current_task_id,
      queue_length,
      metadata,
      last_heartbeat: new Date(),
    }, { onConflict: 'worker_name' })
    .select()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ worker: data?.[0] })
}
