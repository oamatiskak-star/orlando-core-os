import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const revalidate = 0

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sp        = req.nextUrl.searchParams
  const status    = sp.get('status') ?? ''
  const projectId = sp.get('project_id') ?? ''
  const type      = sp.get('type') ?? ''

  let q = supabase
    .from('planning_items')
    .select('*, project:projects(id,name), company:companies(id,name)', { count: 'exact' })
    .order('due_date', { ascending: true, nullsFirst: false })

  if (status)    q = q.eq('status', status)
  if (projectId) q = q.eq('project_id', projectId)
  if (type)      q = q.eq('type', type)

  const { data, error, count } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Verrijk elk item met orchestrator_task_id (laatste bridge-mirror)
  // zodat de UI direct kan linken naar /api/orchestrator/tasks/[id].
  type Item = { id: string; orchestrator_task_id?: string | null }
  const items = (data ?? []) as Item[]
  if (items.length > 0) {
    const ids = items.map((i) => i.id)
    const { data: orch } = await supabase
      .from('orchestrator_tasks')
      .select('id, payload, created_at')
      .not('payload->>planning_item_id', 'is', null)
      .in('payload->>planning_item_id', ids)
      .order('created_at', { ascending: false })

    const byPlanningId = new Map<string, string>()
    for (const row of (orch ?? []) as Array<{ id: string; payload: { planning_item_id?: string } }>) {
      const pid = row.payload?.planning_item_id
      if (pid && !byPlanningId.has(pid)) {
        byPlanningId.set(pid, row.id)
      }
    }
    for (const it of items) {
      it.orchestrator_task_id = byPlanningId.get(it.id) ?? null
    }
  }

  return NextResponse.json({ items, total: count ?? 0 })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { titel, type, project_id, company_id, priority, beschrijving, toegewezen, start_date, due_date, notes } = body

  if (!titel) return NextResponse.json({ error: 'titel vereist' }, { status: 400 })

  const { data, error } = await supabase
    .from('planning_items')
    .insert({
      titel,
      type:        type ?? 'taak',
      status:      'open',
      priority:    priority ?? 'normaal',
      project_id:  project_id ?? null,
      company_id:  company_id ?? null,
      beschrijving:beschrijving ?? null,
      toegewezen:  toegewezen ?? null,
      start_date:  start_date ?? null,
      due_date:    due_date ?? null,
      notes:       notes ?? null,
    })
    .select('*, project:projects(id,name)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ item: data }, { status: 201 })
}
