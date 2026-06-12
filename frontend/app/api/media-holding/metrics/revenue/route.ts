import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const revalidate = 0

// S1 — Revenue/CTR-dashboardbron. Leest de live-berekende views uit migratie 193.
// Omzet is 0 zolang kanalen niet in YPP zitten; CTR vult zich zodra de
// sync-video-analytics cron met de gefixte ingestie heeft gedraaid.
export async function GET(_req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [channels, topVideos] = await Promise.all([
    supabase.from('v_channel_revenue').select('*').order('revenue_30d', { ascending: false }),
    supabase.from('v_top_videos_revenue').select('*').limit(20),
  ])

  if (channels.error) return NextResponse.json({ error: channels.error.message }, { status: 500 })

  const ch = channels.data ?? []
  const sum = (k: string) => ch.reduce((a, c) => a + Number((c as Record<string, unknown>)[k] ?? 0), 0)

  return NextResponse.json({
    totals: {
      revenue_today: sum('revenue_today'),
      revenue_7d:    sum('revenue_7d'),
      revenue_30d:   sum('revenue_30d'),
      views_30d:     sum('views_30d'),
    },
    channels:  ch,
    topVideos: topVideos.data ?? [],
  })
}
