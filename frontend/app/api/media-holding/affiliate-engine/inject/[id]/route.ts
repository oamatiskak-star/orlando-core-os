import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const revalidate = 0

// POST /api/media-holding/affiliate-engine/inject/[id]
// [id] = media_holding_content_items.id
// Body: { prefer_link_id? }
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: contentItemId } = await ctx.params
  const body = await req.json().catch(() => ({}))

  const { data, error } = await supabase
    .from('orchestrator_tasks')
    .insert({
      company_id: 'modiwerijo',
      title: '[affiliate] inject link in brief',
      task_type: 'affiliate_inject',
      executor: 'affiliate_injector',
      allowed_actions: ['*'],
      priority: 4,
      status: 'open',
      objective: ['Affiliate-CTA injecteren in content_brief.beschrijving.'],
      payload: {
        content_item_id: contentItemId,
        prefer_link_id: body.prefer_link_id ?? null,
      },
    })
    .select('id')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ task_id: data.id, content_item_id: contentItemId }, { status: 202 })
}
