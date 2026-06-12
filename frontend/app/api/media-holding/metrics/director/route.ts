import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const revalidate = 0

// S5 — Director dashboardbron. Leest de meest recente per-kanaal beslissingen
// (v_director_decisions_current) + niche-ranking (v_niche_ranking).
export async function GET(_req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [decisions, niches] = await Promise.all([
    supabase.from('v_director_decisions_current').select('*').order('rank', { ascending: true }),
    supabase.from('v_niche_ranking').select('*').order('rank', { ascending: true }).limit(8),
  ])

  if (decisions.error) return NextResponse.json({ error: decisions.error.message }, { status: 500 })

  const d = decisions.data ?? []
  const byAction = d.reduce<Record<string, number>>((acc, x) => {
    const a = String((x as { action?: string }).action ?? 'maintain')
    acc[a] = (acc[a] ?? 0) + 1
    return acc
  }, {})

  return NextResponse.json({
    decisions: d,
    by_action: byAction,
    niches: niches.data ?? [],
  })
}
