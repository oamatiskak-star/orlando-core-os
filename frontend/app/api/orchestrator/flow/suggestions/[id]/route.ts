import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { guardRscFetch } from '@/lib/orchestrator/rsc-guard'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// PATCH { resolved: true|false } — markeer suggestion afgehandeld
export async function PATCH(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const blocked = guardRscFetch(request)
  if (blocked) return blocked

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await ctx.params

  let body: { resolved?: boolean } = {}
  try { body = await request.json() } catch {}

  const { data, error } = await supabase
    .from('orchestrator_events')
    .update({ resolved: body.resolved ?? true })
    .eq('id', id)
    .like('type', 'flow_%')
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ event: data })
}
