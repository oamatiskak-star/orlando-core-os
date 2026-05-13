import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()

  const { data, error } = await supabase.from('oc_routines').select('*').eq('id', id).single()
  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json(data)
}

export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const body = await req.json()

  const { data, error } = await supabase
    .from('oc_routines')
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

  const { error } = await supabase
    .from('oc_routines')
    .update({ status: 'uitgeschakeld', updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

export async function POST(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()

  const { data: run, error } = await supabase
    .from('oc_routine_runs')
    .insert({ routine_id: id, status: 'running', started_at: new Date().toISOString() })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await supabase.from('oc_routines').update({
    last_run_at: new Date().toISOString(),
    last_run_status: 'running',
  }).eq('id', id)

  return NextResponse.json({ run_id: run.id, status: 'triggered' }, { status: 202 })
}
