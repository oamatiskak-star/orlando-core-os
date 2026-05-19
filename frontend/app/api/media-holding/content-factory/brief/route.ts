import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const revalidate = 0

// POST /api/media-holding/content-factory/brief
// Body: { viral_opportunity_id?, channel_id?, brief?, language?, scheduled_at? }
//
// Maakt een orchestrator_task aan met executor='content_factory' zodat
// Forge een content brief genereert via Anthropic. Resultaat verschijnt
// als media_holding_content_items row met content_brief jsonb gevuld.
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))

  if (!body.viral_opportunity_id && !body.channel_id && !body.brief) {
    return NextResponse.json({
      error: 'Minstens één van viral_opportunity_id, channel_id of brief is vereist',
    }, { status: 400 })
  }

  const titleParts: string[] = ['Forge brief']
  if (body.viral_opportunity_id) titleParts.push('viral')
  if (body.channel_id) titleParts.push('channel')

  const { data, error } = await supabase
    .from('orchestrator_tasks')
    .insert({
      company_id: 'modiwerijo',
      title: titleParts.join(' · '),
      task_type: 'content_factory_brief',
      executor: 'content_factory',
      allowed_actions: ['*'],
      priority: 4,
      status: 'open',
      objective: ['Genereer een content brief voor de Media Holding Content Factory.'],
      payload: {
        viral_opportunity_id: body.viral_opportunity_id ?? null,
        channel_id:           body.channel_id ?? null,
        brief:                body.brief ?? null,
        language:             body.language ?? null,
        scheduled_at:         body.scheduled_at ?? null,
        persona:              'Forge',
      },
    })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ task_id: data.id }, { status: 202 })
}
