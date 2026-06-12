import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const revalidate = 0

// S6 — Autonomous growth dashboardbron. Capaciteitsallocatie per kanaal +
// niche-scoring (expand/terminate) + groei-forecast.
export async function GET(_req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [plan, niches, forecast] = await Promise.all([
    supabase.from('v_growth_plan_current').select('*').order('priority_rank', { ascending: true }),
    supabase.from('v_niche_scoring').select('*').order('rank', { ascending: true }).limit(12),
    supabase.from('v_growth_forecast').select('*').order('projected_views_30d', { ascending: false }).limit(10),
  ])

  if (plan.error) return NextResponse.json({ error: plan.error.message }, { status: 500 })

  const n = niches.data ?? []
  return NextResponse.json({
    allocations: plan.data ?? [],
    priority_channel: (plan.data ?? [])[0] ?? null,
    niches: {
      expand:    n.filter((x) => String((x as { niche_action?: string }).niche_action) === 'expand'),
      terminate: n.filter((x) => String((x as { niche_action?: string }).niche_action) === 'terminate'),
      all: n,
    },
    forecast: forecast.data ?? [],
  })
}
