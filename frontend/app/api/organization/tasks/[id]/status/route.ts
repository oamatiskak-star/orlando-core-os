import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const revalidate = 0

const VALID_STATUSES = [
  'new',
  'queued',
  'assigned',
  'running',
  'waiting_for_input',
  'blocked',
  'completed',
  'failed',
  'cancelled',
] as const

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { status, error, output_url } = body

  if (!status || !(VALID_STATUSES as readonly string[]).includes(status)) {
    return NextResponse.json(
      { error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` },
      { status: 400 }
    )
  }

  const { data, error: rpcError } = await supabase.rpc('update_task_status', {
    p_task_id: params.id,
    p_new_status: status,
    p_error: error,
    p_output_url: output_url,
  })

  if (rpcError) return NextResponse.json({ error: rpcError.message }, { status: 500 })

  return NextResponse.json({ result: data })
}
