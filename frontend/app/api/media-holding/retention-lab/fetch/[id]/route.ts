import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const revalidate = 0

// POST /api/media-holding/retention-lab/fetch/[id]
// Dispatcht een retention_lab task voor het content_item.
export async function POST(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: contentItemId } = await ctx.params

  // Verifieer dat er een verified_live YouTube upload is
  const { data: upload } = await supabase
    .from('media_holding_uploads')
    .select('platform_video_id')
    .eq('content_item_id', contentItemId)
    .eq('platform', 'youtube')
    .eq('status', 'verified_live')
    .maybeSingle()

  if (!upload?.platform_video_id) {
    return NextResponse.json({ error: 'geen verified_live YouTube upload voor dit content_item' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('orchestrator_tasks')
    .insert({
      company_id: 'modiwerijo',
      title: `Retention Lab fetch — ${contentItemId.slice(0, 8)}`,
      task_type: 'retention_fetch',
      executor: 'retention_lab',
      allowed_actions: ['*'],
      priority: 5,
      status: 'open',
      objective: ['Fetch audience retention curve van YouTube Analytics + AI analyse.'],
      payload: { content_item_id: contentItemId, persona: 'Echo' },
    })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ task_id: data.id }, { status: 202 })
}
