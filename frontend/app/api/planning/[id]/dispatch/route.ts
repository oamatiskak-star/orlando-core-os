import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const revalidate = 0

// POST /api/planning/[id]/dispatch
// Body: { persona?: string }  — default 'ai'
//
// Dispatcht een planning_item direct naar de orchestrator zonder afhankelijk
// te zijn van de trigger-eligibility check (die alleen 'ai'/'claude-code'/
// 'orchestrator' accepteert). Werkt ook met persona-namen zoals 'Magnus'.
//
// 1. Delete bestaande orchestrator_tasks voor dit planning_item
// 2. Zet planning_item.toegewezen = persona (voor weergave in UI)
// 3. INSERT orchestrator_task direct met executor='anthropic' + persona in payload
// 4. Return de aangemaakte task ID

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
    ? body.persona.trim()
    : 'ai'

  // Verifieer dat item bestaat
  const { data: planning, error: e0 } = await supabase
    .from('planning_items')
    .select('id, titel, type, priority, beschrijving, project_id, company_id, due_date, start_date')
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

  // Update planning_item: toegewezen = persona (voor weergave), status reset
  const { data: updatedItem, error: e1 } = await supabase
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
  if (e1) return NextResponse.json({ error: e1.message }, { status: 500 })

  // Bouw objective uit beschrijving
  const objective = planning.beschrijving
    ? [planning.beschrijving]
    : []

  // Prioriteit mapping
  const priorityMap: Record<string, number> = { urgent: 1, hoog: 3, normaal: 5, laag: 8 }
  const priority = priorityMap[planning.priority as string] ?? 5

  // INSERT orchestrator_task direct (bypasses trigger eligibility)
  const { data: task, error: e2 } = await supabase
    .from('orchestrator_tasks')
    .insert({
      company_id:           planning.company_id ?? 'modiwerijo',
      title:                planning.titel,
      task_type:            planning.type ?? 'taak',
      executor:             'anthropic',
      allowed_actions:      ['*'],
      priority,
      status:               'open',
      interruptible:        true,
      requires_confirmation: false,
      safe_mode:            false,
      background_task:      false,
      system_critical:      false,
      estimated_runtime:    'medium',
      objective,
      notes:                [],
      payload: {
        planning_item_id: id,
        source:           'planning_items',
        persona,
        due_date:         planning.due_date,
        project_id:       planning.project_id,
      },
      run_at:       planning.start_date ?? new Date().toISOString(),
      attempts:     0,
      max_attempts: 3,
    })
    .select('id, status')
    .single()

  if (e2) return NextResponse.json({ error: e2.message }, { status: 500 })

  return NextResponse.json({
    item:        updatedItem,
    dispatched:  true,
    task_id:     task.id,
    persona,
  })
}
