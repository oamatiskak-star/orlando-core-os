import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const revalidate = 0

// POST /api/media-holding/launches/evaluate
// Body: { top_n?: number, min_score?: number }
// Default: top_n=1, min_score=60
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const topN = typeof body.top_n === 'number' ? body.top_n : 1
  const minScore = typeof body.min_score === 'number' ? body.min_score : 60

  const { data, error } = await supabase.rpc('evaluate_actief_opportunities', {
    p_top_n: topN,
    p_min_score: minScore,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({
    ranked: data ?? [],
    promoted: (data ?? []).filter((r: { promoted: boolean }) => r.promoted),
    params: { top_n: topN, min_score: minScore },
  })
}
