import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const revalidate = 0

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { agent_id, worker_id } = body

  if (!agent_id) {
    return NextResponse.json(
      { error: 'Missing required field: agent_id' },
      { status: 400 }
    )
  }

  const { data, error } = await supabase.rpc('claim_organization_task', {
    p_task_id: params.id,
    p_agent_id: agent_id,
    p_worker_id: worker_id,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ result: data })
}
