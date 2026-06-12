import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const revalidate = 0

// S2 — Learning-loop dashboardbron. Leest de live pattern-views + de
// persistente aanbevelingen (migratie 194). Werkt zodra analytics CTR/views heeft.
export async function GET(_req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [recs, winners, losers, replication] = await Promise.all([
    supabase.from('v_content_recommendations_current').select('*').limit(40),
    supabase.from('v_winner_patterns').select('*').order('avg_score', { ascending: false }).limit(10),
    supabase.from('v_loser_patterns').select('*').order('n', { ascending: false }).limit(10),
    supabase.from('v_replication_queue').select('*').limit(20),
  ])

  if (recs.error) return NextResponse.json({ error: recs.error.message }, { status: 500 })

  const r = recs.data ?? []
  const byAction = r.reduce<Record<string, number>>((acc, x) => {
    const a = String((x as { action?: string }).action ?? 'test')
    acc[a] = (acc[a] ?? 0) + 1
    return acc
  }, {})

  const repl = replication.data ?? []
  return NextResponse.json({
    recommendations: r,
    by_action: byAction,
    winners: winners.data ?? [],
    losers:  losers.data ?? [],
    replication: {
      total: repl.length,
      planned: repl.filter((x) => String((x as { status?: string }).status) === 'planned').length,
      items: repl.slice(0, 6),
    },
  })
}
