import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type Params = { params: Promise<{ id: string }> }

export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const body = await req.json()

  const action = body.action as 'cancel' | 'retry' | undefined

  if (action === 'cancel') {
    const { error } = await supabase
      .from('oc_queue_jobs')
      .update({ status: 'cancelled' })
      .eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, action: 'cancelled' })
  }

  if (action === 'retry') {
    const { error } = await supabase
      .from('oc_queue_jobs')
      .update({ status: 'pending', retry_count: 0, error_message: null, started_at: null, completed_at: null })
      .eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, action: 'retried' })
  }

  const { data, error } = await supabase
    .from('oc_queue_jobs')
    .update(body)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
