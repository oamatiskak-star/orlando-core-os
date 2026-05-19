import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const revalidate = 0

export async function GET(_req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [perf, recentConversions] = await Promise.all([
    supabase.from('affiliate_performance')
      .select('*, link:affiliate_links!link_id(id, product, network, niche, url, active), channel:media_holding_channels(id, name, naam)')
      .order('confirmed_commission_eur', { ascending: false }),
    supabase.from('affiliate_conversions')
      .select('*, link:affiliate_links(id, product, network)')
      .order('occurred_at', { ascending: false })
      .limit(50),
  ])
  if (perf.error) return NextResponse.json({ error: perf.error.message }, { status: 500 })

  const rows = perf.data ?? []
  const totals = {
    total_links:               rows.length,
    total_clicks:              rows.reduce((a, r) => a + Number(r.click_count ?? 0), 0),
    total_confirmed:           rows.reduce((a, r) => a + Number(r.confirmed_count ?? 0), 0),
    total_confirmed_commission:rows.reduce((a, r) => a + Number(r.confirmed_commission_eur ?? 0), 0),
    total_pending_commission:  rows.reduce((a, r) => a + Number(r.pending_commission_eur ?? 0), 0),
  }
  return NextResponse.json({
    performance: rows,
    recent_conversions: recentConversions.data ?? [],
    totals,
  })
}
