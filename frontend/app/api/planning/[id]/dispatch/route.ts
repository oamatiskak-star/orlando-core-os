import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const revalidate = 0

// POST /api/planning/[id]/dispatch
// Body: { persona?: string }  — default 'ai'
//
// Dispatcht een planning_item naar de orchestrator, ongeacht huidige toegewezen waarde.
// 1. Delete bestaande orchestrator_tasks voor dit planning_item
// 2. Zet toegewezen = persona (default 'ai'), status = 'open', reset completed_at + notes
//    → trigger sync_planning_to_orchestrator maakt nieuwe orchestrator_task aan
// 3. Return de aangemaakte task ID
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const persona: string = typeof body.persona === 'string' && body.persona.trim()
    ? body.persona.trim().toLowerCase()
    : 'ai'

  // Verifieer dat item bestaat
  const { data: planning, error: e0 } = await supabase
    .from('planning_items')
    .select('id, titel')
    .eq('id', id)
    .single()
  if (e0 || !planning) {
    return NextResponse.json({ error: 'planning item niet gevonden' }, { status: 404 })
  }

  // Delete bestaande orchestrator_tasks voor dit planning_item
  await supabase
    .from('orchestrator_tasks')
    .delete()
    .eq('payload->>planning_item_id', id)

  // Update planning_item: trigger maakt nieuwe orchestrator_task aan
  const { data, error: e1 } = await supabase
    .from('planning_items')
    .update({
      toegewezen:   persona,
      status:       'open',
      completed_at: null,
      notes:        null,
      updated_at:   new Date().toISOString(),
    })
    .eq('id', id)
    .select('*, project:projects(id,name)')
    .single()
  if (e1) {
    return NextResponse.json({ error: e1.message }, { status: 500 })
  }

  // Zoek de net-aangemaakte orchestrator_task
  const { data: task } = await supabase
    .from('orchestrator_tasks')
    .select('id, status')
    .eq('payload->>planning_item_id', id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return NextResponse.json({ item: data, dispatched: true, task_id: task?.id ?? null })
}
