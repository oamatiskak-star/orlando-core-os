import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { guardRscFetch } from '@/lib/orchestrator/rsc-guard'
import { getTask, pauseTask } from '@/lib/orchestrator/queries'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const blocked = guardRscFetch(request)
  if (blocked) return blocked

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await ctx.params

  let pausedState: Record<string, unknown> = {}
  try {
    pausedState = await request.json()
  } catch {
    // body optioneel
  }

  try {
    const current = await getTask(supabase, id)
    if (!current) return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 })

    if (!current.interruptible || current.system_critical) {
      return NextResponse.json(
        { error: 'Task is niet onderbreekbaar (interruptible=false of system_critical=true)' },
        { status: 409 },
      )
    }

    const task = await pauseTask(supabase, id, {
      ...pausedState,
      _paused_by: user.id,
      _paused_at: new Date().toISOString(),
    })
    return NextResponse.json({ task })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
