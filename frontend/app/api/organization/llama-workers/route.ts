import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const revalidate = 0

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sp = req.nextUrl.searchParams
  const status = sp.get('status')
  const limit = parseInt(sp.get('limit') ?? '100')
  const offset = parseInt(sp.get('offset') ?? '0')

  const { data, error } = await supabase.rpc('get_organization_llama_workers', {
    p_status: status,
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
    host,
    port,
    model_name,
    model_path,
    context_size,
    threads,
    gpu_layers,
  } = body

  if (!worker_name || !host || !port || !model_name) {
    return NextResponse.json(
      { error: 'Missing required fields: worker_name, host, port, model_name' },
      { status: 400 }
    )
  }

  const { data, error } = await supabase
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
      status: 'offline',
      last_heartbeat: new Date(),
    }, { onConflict: 'worker_name' })
    .select()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ worker: data?.[0] }, { status: 201 })
}
