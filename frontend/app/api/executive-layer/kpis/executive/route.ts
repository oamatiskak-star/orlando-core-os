import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const revalidate = 0

export async function GET() {
  const admin = createAdminClient()
  const { data, error } = await admin.from('v_executive_kpis').select('*').single()
  if (error || !data) {
    return NextResponse.json({
      channels_active: 0, views_24h: 0, views_7d: 0,
      retention_avg_7d: 0, critical_alerts_open: 0, alerts_open_total: 0,
      recs_pending: 0, revenue_30d: 0, spend_30d: 0,
    })
  }

  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const { count: viralAlerts7d } = await admin
    .from('executive_alerts')
    .select('id', { count: 'exact', head: true })
    .eq('alert_kind', 'breakout')
    .gte('detected_at', since7d)

  const since1d = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { data: topVideos } = await admin
    .from('media_holding_metrics')
    .select('views,content_item_id')
    .gte('snapshot_at', since1d)
    .order('views', { ascending: false })
    .limit(5)

  return NextResponse.json({
    ...data,
    viral_alerts_7d: viralAlerts7d ?? 0,
    top_videos_24h: topVideos ?? [],
  })
}
