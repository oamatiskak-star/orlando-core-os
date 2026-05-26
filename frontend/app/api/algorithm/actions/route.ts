import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const revalidate = 0
export const dynamic = 'force-dynamic'

type ActionKind = 'swarm' | 'clone' | 'push' | 'expand'

type ActionBody = {
  kind: ActionKind
  gravity_event_id?: string | null
  content_item_id?: string | null
  channel_id?: string | null
  niche?: string | null
  notes?: string | null
}

const TITLE: Record<ActionKind, string> = {
  swarm:  'Algorithm Swarm — fan-out variant cluster',
  clone:  'Algorithm Clone — duplicate winning hook',
  push:   'Algorithm Push — boost cross-platform variants',
  expand: 'Algorithm Expand — open new niche or language',
}

const REC_ACTION_KIND: Record<ActionKind, string> = {
  swarm:  'activate_swarm_mode',
  clone:  'clone_format',
  push:   'push_variants',
  expand: 'launch_expansion',
}

const PRIORITY: Record<ActionKind, number> = {
  swarm:  2,  // hoog
  clone:  3,
  push:   3,
  expand: 4,
}

export async function POST(req: NextRequest) {
  let body: ActionBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.kind || !['swarm', 'clone', 'push', 'expand'].includes(body.kind)) {
    return NextResponse.json({ error: 'Missing or invalid kind' }, { status: 400 })
  }

  const admin = createAdminClient()

  // 1. Schrijf een orchestrator_task voor de content_factory executor.
  const taskPayload = {
    source: 'algorithm-intelligence-center',
    action: body.kind,
    gravity_event_id: body.gravity_event_id ?? null,
    content_item_id: body.content_item_id ?? null,
    channel_id: body.channel_id ?? null,
    niche: body.niche ?? null,
    notes: body.notes ?? null,
    issued_at: new Date().toISOString(),
  }

  const { data: taskRow, error: taskErr } = await admin
    .from('orchestrator_tasks')
    .insert({
      company_id: 'modiwerijo',
      title: TITLE[body.kind],
      task_type: `algorithm_${body.kind}`,
      project: 'media-holding',
      executor: 'content_factory',
      priority: PRIORITY[body.kind],
      payload: taskPayload,
      objective: [`${body.kind} actie vanuit Algorithm Intelligence Center`],
      success_condition: [`content_factory verwerkt ${body.kind} payload zonder errors`],
    })
    .select('id')
    .single()

  if (taskErr) {
    return NextResponse.json({ error: taskErr.message, hint: 'orchestrator_tasks insert failed' }, { status: 500 })
  }

  // 2. Schrijf parallel een executive_recommendation zodat de Boardroom/Overview het ook ziet.
  // target_kind = 'ecosystem' wanneer geen channel_id/content_id; anders specifieker.
  const targetKind = body.content_item_id ? 'content' : body.channel_id ? 'channel' : body.niche ? 'niche' : 'ecosystem'
  const { data: recRow, error: recErr } = await admin
    .from('executive_recommendations')
    .insert({
      action_kind: REC_ACTION_KIND[body.kind],
      target_kind: targetKind,
      target_id: body.content_item_id ?? body.channel_id ?? null,
      priority: PRIORITY[body.kind] <= 2 ? 5 : PRIORITY[body.kind] === 3 ? 4 : 3,
      rationale: body.notes
        ?? `Manual ${body.kind} dispatched via Algorithm Intelligence Center — task ${taskRow.id}`,
      payload: { ...taskPayload, orchestrator_task_id: taskRow.id },
      status: 'approved',
    })
    .select('id')
    .single()

  return NextResponse.json({
    ok: true,
    task_id: taskRow.id,
    recommendation_id: recRow?.id ?? null,
    rec_error: recErr?.message ?? null,
  })
}
