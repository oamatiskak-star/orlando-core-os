import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { guardRscFetch } from '@/lib/orchestrator/rsc-guard'
import { createTask, listTasks } from '@/lib/orchestrator/queries'
import type { TaskPriorityBand, TaskStatus } from '@/lib/orchestrator/types'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: NextRequest) {
  const blocked = guardRscFetch(request)
  if (blocked) return blocked

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sp = request.nextUrl.searchParams
  const statusRaw = sp.getAll('status') as TaskStatus[]
  const band = (sp.get('priority_band') ?? undefined) as TaskPriorityBand | undefined
  const companyId = sp.get('company_id') ?? undefined
  const limit = Number(sp.get('limit') ?? '100')

  try {
    const tasks = await listTasks(supabase, {
      status:        statusRaw.length ? statusRaw : undefined,
      priority_band: band,
      company_id:    companyId,
      limit:         Number.isFinite(limit) ? limit : 100,
    })
    return NextResponse.json({ tasks })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const blocked = guardRscFetch(request)
  if (blocked) return blocked

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body moet geldige JSON zijn' }, { status: 400 })
  }

  try {
    const task = await createTask(
      supabase,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      body as any,
      user.id,
    )
    return NextResponse.json({ task }, { status: 201 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown error'
    const status = /verplicht|onbekende|moet integer/.test(msg) ? 400 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}
