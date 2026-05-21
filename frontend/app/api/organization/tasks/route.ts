import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const revalidate = 0

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sp = req.nextUrl.searchParams
  const status = sp.get('status')
  const agent_id = sp.get('agent_id')
  const worker_id = sp.get('worker_id')
  const source = sp.get('source')
  const priority = sp.get('priority')
  const system = sp.get('system')
  const limit = parseInt(sp.get('limit') ?? '100')
  const offset = parseInt(sp.get('offset') ?? '0')

  const { data, error } = await supabase.rpc('get_organization_tasks', {
    p_status: status,
    p_agent_id: agent_id,
    p_worker_id: worker_id,
    p_source: source,
    p_priority: priority,
    p_system: system,
    p_limit: limit,
    p_offset: offset,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ tasks: data ?? [] })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const {
    title,
    description,
    priority = 'normal',
    system,
    source = 'manual',
  } = body

  if (!title || !system) {
    return NextResponse.json(
      { error: 'Missing required fields: title, system' },
      { status: 400 }
    )
  }

  const { data, error } = await supabase
    .from('organization_tasks')
    .insert({
      title,
      description,
      priority,
      system,
      source,
      status: 'new',
    })
    .select()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ task: data?.[0] }, { status: 201 })
}
