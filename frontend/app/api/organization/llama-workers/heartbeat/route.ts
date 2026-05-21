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
    host,
    port,
    model_name,
    model_path,
    context_size,
    threads,
    gpu_layers,
    status = 'idle',
    current_task_id,
    queue_length = 0,
    tokens_per_second,
    memory_usage_mb,
    error,
  } = body

  if (!worker_name || !host || !port || !model_name) {
    return NextResponse.json(
      { error: 'Missing required fields: worker_name, host, port, model_name' },
      { status: 400 }
    )
  }

  const { data, dbError } = await supabase
    .from('organization_llama_workers')
    .upsert({
      worker_name,
      host,
      port,
      model_name,
      model_path,
      context_size,
      threads,
      gpu_layers,
      status,
      current_task_id,
      queue_length,
      tokens_per_second,
      memory_usage_mb,
      error,
      last_heartbeat: new Date(),
    }, { onConflict: 'worker_name' })
    .select()

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })

  return NextResponse.json({ worker: data?.[0] })
}
