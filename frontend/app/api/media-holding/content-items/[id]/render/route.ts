import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const revalidate = 0

const ALLOWED_MODELS = ['minimax/video-01', 'google/veo-3-fast', 'wan-2.2-i2v-fast'] as const

// POST /api/media-holding/content-items/[id]/render
// Body: { model?: 'minimax/video-01' | 'google/veo-3-fast' | 'wan-2.2-i2v-fast', image_url? }
//
// Dispatcht een orchestrator_task met executor='renderer'. De ao-executor
// pakt deze op en draait de Replicate render flow (zie renderer handler).
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: contentItemId } = await ctx.params
  const body = await req.json().catch(() => ({}))
  const model = (ALLOWED_MODELS as readonly string[]).includes(body.model) ? body.model : 'minimax/video-01'

  // Verifieer item bestaat en heeft brief
  const { data: item, error: itemErr } = await supabase
    .from('media_holding_content_items')
    .select('id, content_brief, status')
    .eq('id', contentItemId)
    .single()
  if (itemErr || !item) return NextResponse.json({ error: 'content_item niet gevonden' }, { status: 404 })
  if (!item.content_brief) return NextResponse.json({ error: 'content_brief leeg — genereer brief via Forge eerst' }, { status: 400 })

  const { data, error } = await supabase
    .from('orchestrator_tasks')
    .insert({
      company_id: 'modiwerijo',
      title: `Render content_item ${contentItemId.slice(0, 8)} (${model})`,
      task_type: 'content_render',
      executor: 'renderer',
      allowed_actions: ['*'],
      priority: 4,
      status: 'open',
      objective: [`Render video voor content_item via Replicate model ${model}.`],
      payload: {
        content_item_id: contentItemId,
        model,
        image_url: body.image_url ?? null,
        persona: 'Forge',
      },
    })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ task_id: data.id, model }, { status: 202 })
}
