import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const revalidate = 0

// S4 — Funnel/attributie dashboardbron. Leest v_funnel_performance (per kanaal,
// conversieratio's) + v_attribution_video (per-video funnel). Werkt zodra er
// affiliate-clicks/conversies binnenkomen via /r/<code> en de webhook.
export async function GET(_req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [funnel, videos] = await Promise.all([
    supabase.from('v_funnel_performance').select('*'),
    supabase.from('v_attribution_video').select('*').order('revenue', { ascending: false }).limit(10),
  ])

  if (funnel.error) return NextResponse.json({ error: funnel.error.message }, { status: 500 })

  const f = funnel.data ?? []
  const num = (k: string) => f.reduce((a, c) => a + Number((c as Record<string, unknown>)[k] ?? 0), 0)
  const totals = {
    views:   num('views'),
    clicks:  num('clicks'),
    leads:   num('leads'),
    sales:   num('sales'),
    revenue: num('revenue'),
  }

  return NextResponse.json({
    totals,
    channels: f,
    top_videos: videos.data ?? [],
  })
}
