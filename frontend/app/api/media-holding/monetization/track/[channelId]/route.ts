import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const revalidate = 0

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ channelId: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { channelId } = await ctx.params
  const body = await req.json().catch(() => ({}))
  const periodDays = typeof body.period_days === 'number' ? body.period_days : 30

  const { data, error } = await supabase
    .from('orchestrator_tasks')
    .insert({
      company_id: 'modiwerijo',
      title: `Monetization track — ${channelId.slice(0, 8)} (${periodDays}d)`,
      task_type: 'monetization_track',
      executor: 'monetization_tracker',
      allowed_actions: ['*'],
      priority: 5,
      status: 'open',
      objective: [`Fetch YT Analytics monetary metrics over ${periodDays} dagen.`],
      payload: { channel_id: channelId, period_days: periodDays, persona: 'Victoria' },
    })
    .select('id')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ task_id: data.id }, { status: 202 })
}
