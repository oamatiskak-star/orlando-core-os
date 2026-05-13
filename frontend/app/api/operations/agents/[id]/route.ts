import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('oc_ai_agents')
    .select('*, oc_agent_runs(id, status, started_at, completed_at, tokens_used, duration_ms)')
    .eq('id', id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json(data)
}

export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const body = await req.json()

  const { data, error } = await supabase
    .from('oc_ai_agents')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()

  const { error } = await supabase.from('oc_ai_agents').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const body = await req.json()

  const { data: run, error } = await supabase
    .from('oc_agent_runs')
    .insert({
      agent_id: id,
      trigger: 'api',
      input: body.input ?? {},
      status: 'running',
      started_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await supabase.from('oc_ai_agents').update({
    status: 'running',
    last_active_at: new Date().toISOString(),
  }).eq('id', id)

  return NextResponse.json({ run_id: run.id, status: 'triggered' }, { status: 202 })
}
