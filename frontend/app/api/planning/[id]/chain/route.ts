import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const revalidate = 0

// POST /api/planning/[id]/chain
// Body: { chain: ["Scout", "Magnus", "Victoria"] }
//
// 1. Verifieert dat planning_item bestaat en eligible is (toegewezen ∈ persona set)
// 2. Verifieert dat alle persona-namen in de chain bestaan in agent_personas
// 3. Cleanup eventuele bestaande orchestrator_tasks rows voor dit planning_item
// 4. Reset planning_item naar status=open met toegewezen = chain[0]
//    → forward trigger maakt root orchestrator_task aan
// 5. Insert chain steps (vanaf index 1) in orchestrator_task_chain met parent=root
// 6. Wanneer root task completed → trigger dispatcht chain[1] etc.

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const chain: string[] = Array.isArray(body.chain) ? body.chain.filter((x: unknown) => typeof x === 'string') : []
  const beschrijving: string | undefined =
    typeof body.beschrijving === 'string' ? body.beschrijving : undefined

  if (chain.length === 0) {
    return NextResponse.json({ error: 'chain mag niet leeg zijn' }, { status: 400 })
  }

  // Verifieer alle persona-namen
  const { data: foundPersonas, error: e0 } = await supabase
    .from('agent_personas')
    .select('name')
  if (e0) return NextResponse.json({ error: e0.message }, { status: 500 })
  const validNames = new Set((foundPersonas ?? []).map((p) => p.name.toLowerCase()))
  const invalid = chain.filter((n) => !validNames.has(n.toLowerCase()))
  if (invalid.length > 0) {
    return NextResponse.json({ error: `Onbekende persona(s): ${invalid.join(', ')}` }, { status: 400 })
  }

  // Cleanup vorige run
  await supabase
    .from('orchestrator_tasks')
    .delete()
    .eq('payload->>planning_item_id', id)

  // Reset planning_item — first chain step wordt toegewezen
  const update: Record<string, unknown> = {
    status:       'open',
    completed_at: null,
    notes:        null,
    toegewezen:   chain[0],
    updated_at:   new Date().toISOString(),
  }
  if (beschrijving !== undefined) update.beschrijving = beschrijving

  const { error: e1 } = await supabase
    .from('planning_items')
    .update(update)
    .eq('id', id)
  if (e1) return NextResponse.json({ error: e1.message }, { status: 500 })

  // Vind de net-gecreeerde orchestrator_task root row
  const { data: rootTask, error: e2 } = await supabase
    .from('orchestrator_tasks')
    .select('id')
    .eq('payload->>planning_item_id', id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (e2 || !rootTask) {
    return NextResponse.json({ error: 'kon root orchestrator_task niet vinden' }, { status: 500 })
  }

  // Insert chain steps voor [1..n] — step[0] is al de root
  const remainingSteps = chain.slice(1).map((persona_name, idx) => ({
    parent_task_id: rootTask.id,
    step_order:     idx + 1, // root = step 0, chain rows zijn 1..n
    persona_name,
    status:         'pending',
  }))

  if (remainingSteps.length > 0) {
    const { error: e3 } = await supabase
      .from('orchestrator_task_chain')
      .insert(remainingSteps)
    if (e3) return NextResponse.json({ error: e3.message }, { status: 500 })
  }

  // Markeer root task met persona payload zodat handler dit weet
  await supabase
    .from('orchestrator_tasks')
    .update({
      payload: {
        planning_item_id: id,
        source:           'planning_items',
        persona:          chain[0],
        chain_root:       rootTask.id,
        chain_total:      chain.length,
      },
    })
    .eq('id', rootTask.id)

  return NextResponse.json({
    root_task_id: rootTask.id,
    chain:        chain,
    pending_steps: remainingSteps.length,
  })
}
