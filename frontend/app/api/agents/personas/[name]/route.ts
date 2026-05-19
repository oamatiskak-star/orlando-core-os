import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const revalidate = 0

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ name: string }> },
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name } = await ctx.params
  const decoded = decodeURIComponent(name)

  // Case-insensitive lookup
  const { data: persona, error } = await supabase
    .from('agent_personas')
    .select('*')
    .ilike('name', decoded)
    .maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!persona) return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 })

  // Active planning_items met toegewezen = persona.name (case-insensitive)
  const { data: tasks } = await supabase
    .from('planning_items')
    .select('id, titel, status, priority, due_date, project:projects(id,name)')
    .ilike('toegewezen', persona.name)
    .order('due_date', { ascending: true, nullsFirst: false })
    .limit(50)

  return NextResponse.json({ persona, tasks: tasks ?? [] })
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ name: string }> },
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name } = await ctx.params
  const decoded = decodeURIComponent(name)
  const body = await req.json().catch(() => ({}))

  const allowed = ['status', 'description', 'capabilities', 'icon', 'config']
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const key of allowed) {
    if (key in body) update[key] = body[key]
  }

  const { data, error } = await supabase
    .from('agent_personas')
    .update(update)
    .ilike('name', decoded)
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ persona: data })
}
