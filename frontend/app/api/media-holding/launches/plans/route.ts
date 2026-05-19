import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const revalidate = 0

export async function GET(_req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: plans, error } = await supabase
    .from('channel_launch_plans')
    .select('*, channel:media_holding_channels(id, name, niche, status), osil:osil_opportunities(id, title, ai_score, potential_value)')
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: steps } = await supabase
    .from('channel_launch_steps')
    .select('*')
    .in('plan_id', (plans ?? []).map((p) => p.id))
    .order('step_order')

  const stepsByPlan = (steps ?? []).reduce<Record<string, typeof steps>>((acc, s) => {
    if (!acc[s!.plan_id]) acc[s!.plan_id] = []
    acc[s!.plan_id]!.push(s)
    return acc
  }, {})

  return NextResponse.json({
    plans: (plans ?? []).map((p) => {
      const ps = stepsByPlan[p.id] ?? []
      return {
        ...p,
        steps: ps,
        progress: {
          total: ps.length,
          completed: ps.filter((s) => s!.status === 'completed').length,
          in_progress: ps.filter((s) => s!.status === 'in_progress').length,
          blocked: ps.filter((s) => s!.status === 'blocked').length,
        },
      }
    }),
  })
}
