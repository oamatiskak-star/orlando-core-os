import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const revalidate = 0

// POST /api/planning/[id]/rerun
//
// Voert een taak opnieuw uit via de orchestrator-bridge:
//   1. (optioneel) update beschrijving als die in de body staat
//   2. delete alle bestaande orchestrator_tasks rows die naar dit
//      planning_item wijzen (zodat de forward-trigger op stap 3
//      een nieuwe row insert ipv een no-op update)
//   3. zet planning_items.status='open', completed_at=NULL,
//      notes=NULL → trigger sync_planning_to_orchestrator maakt
//      een verse orchestrator_tasks row aan
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const newBeschrijving: string | undefined =
    typeof body.beschrijving === 'string' ? body.beschrijving : undefined

  // 1. Verifieer dat item bestaat en eligible is (toegewezen ∈ {claude-code, ai, orchestrator})
  const { data: planning, error: e0 } = await supabase
    .from('planning_items')
    .select('id, toegewezen')
    .eq('id', id)
    .single()
  if (e0 || !planning) {
    return NextResponse.json({ error: 'planning item niet gevonden' }, { status: 404 })
  }
  const toegewezen = (planning.toegewezen ?? '').toLowerCase()
  if (!['claude-code', 'ai', 'orchestrator'].includes(toegewezen)) {
    return NextResponse.json(
      { error: 'taak heeft geen AI-toewijzing — zet toegewezen op "ai", "claude-code" of "orchestrator"' },
      { status: 400 },
    )
  }

  // 2. Delete bestaande orchestrator_tasks voor dit planning_item
  const { error: e1 } = await supabase
    .from('orchestrator_tasks')
    .delete()
    .eq('payload->>planning_item_id', id)
  if (e1) {
    return NextResponse.json({ error: `orchestrator cleanup faalde: ${e1.message}` }, { status: 500 })
  }

  // 3. Reset planning_item — trigger maakt nieuwe orchestrator_tasks row
  const update: Record<string, unknown> = {
    status:        'open',
    completed_at:  null,
    notes:         null,
    updated_at:    new Date().toISOString(),
  }
  if (newBeschrijving !== undefined) update.beschrijving = newBeschrijving

  const { data, error: e2 } = await supabase
    .from('planning_items')
    .update(update)
    .eq('id', id)
    .select('*, project:projects(id,name)')
    .single()
  if (e2) {
    return NextResponse.json({ error: e2.message }, { status: 500 })
  }

  return NextResponse.json({ item: data, rerun: true })
}
