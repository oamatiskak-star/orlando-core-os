import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { guardRscFetch } from '@/lib/orchestrator/rsc-guard'
import {
  getTask,
  getTaskErrors,
  getTaskLogs,
  updateTaskStatus,
} from '@/lib/orchestrator/queries'
import type { TaskStatus } from '@/lib/orchestrator/types'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const VALID_STATUS: TaskStatus[] = [
  'open', 'running', 'completed', 'failed', 'retry', 'waiting', 'paused',
]

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const blocked = guardRscFetch(request)
  if (blocked) return blocked

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await ctx.params
  try {
    const task = await getTask(supabase, id)
    if (!task) return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 })

    const [logs, errors] = await Promise.all([
      getTaskLogs(supabase, id),
      getTaskErrors(supabase, id),
    ])
    return NextResponse.json({ task, logs, errors })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

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

  let body: { status?: TaskStatus; run_at?: string } = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body moet geldige JSON zijn' }, { status: 400 })
  }

  if (body.status && !VALID_STATUS.includes(body.status)) {
    return NextResponse.json({ error: `Onbekende status: ${body.status}` }, { status: 400 })
  }

  try {
    const status = body.status ?? 'retry'
    const patch: Record<string, unknown> = {}
    if (status === 'retry') {
      patch.error = null
      patch.run_at = body.run_at ?? new Date().toISOString()
    }
    const task = await updateTaskStatus(supabase, id, status, patch)
    return NextResponse.json({ task })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
