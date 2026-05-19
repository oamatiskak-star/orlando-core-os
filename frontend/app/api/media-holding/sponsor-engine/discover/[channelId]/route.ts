import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const revalidate = 0

// POST /api/media-holding/sponsor-engine/discover/[channelId]
// Body: { n?: number, region?: string }
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ channelId: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { channelId } = await ctx.params
  const body = await req.json().catch(() => ({}))
  const n = Math.max(1, Math.min(20, body.n ?? 10))
  const region = body.region ?? 'NL'

  const { data: channel } = await supabase
    .from('media_holding_channels')
    .select('id, name')
    .eq('id', channelId)
    .single()
  if (!channel) return NextResponse.json({ error: 'channel niet gevonden' }, { status: 404 })

  const { data, error } = await supabase
    .from('orchestrator_tasks')
    .insert({
      company_id: 'modiwerijo',
      title: `Sponsor discovery — ${channel.name}`,
      task_type: 'sponsor_discover',
      executor: 'sponsor_engine',
      allowed_actions: ['*'],
      priority: 5,
      status: 'open',
      objective: [`Vind ${n} brand sponsors voor ${channel.name} in regio ${region}.`],
      payload: { channel_id: channelId, n, region, persona: 'Eve' },
    })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ task_id: data.id, n }, { status: 202 })
}
