import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const revalidate = 0

export async function GET(_req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [streams, metrics, channels] = await Promise.all([
    supabase.from('monetization_streams')
      .select('*, channel:media_holding_channels(id, name, niche)')
      .order('monthly_revenue', { ascending: false }),
    supabase.from('monetization_metrics')
      .select('*, channel:media_holding_channels(id, name)')
      .order('period_end', { ascending: false })
      .limit(50),
    supabase.from('media_holding_channels').select('id, name, niche, status'),
  ])

  if (streams.error) return NextResponse.json({ error: streams.error.message }, { status: 500 })

  return NextResponse.json({
    streams: streams.data ?? [],
    metrics: metrics.data ?? [],
    channels: channels.data ?? [],
    totals: {
      monthly_revenue_active: (streams.data ?? []).filter((s) => s.active).reduce((a, s) => a + Number(s.monthly_revenue ?? 0), 0),
      by_stream_type: (streams.data ?? []).reduce<Record<string, number>>((acc, s) => {
        acc[s.stream_type] = (acc[s.stream_type] ?? 0) + Number(s.monthly_revenue ?? 0)
        return acc
      }, {}),
    },
  })
}
