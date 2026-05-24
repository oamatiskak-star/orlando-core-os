import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { reportHeartbeat } from '@/lib/watchdog/heartbeat'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const today = new Date().toISOString().slice(0, 10)

  const { data: channels } = await admin
    .from('youtube_channels')
    .select('id, naam, today_views, subscriber_count, estimated_revenue')
    .eq('status', 'active')

  if (!channels?.length) {
    return NextResponse.json({ message: 'No active channels', snapshotted: 0 })
  }

  const upserts = channels.map(ch => ({
    channel_id: ch.id,
    date: today,
    views: ch.today_views ?? 0,
    estimated_revenue: ch.estimated_revenue ?? 0,
    updated_at: new Date().toISOString(),
  }))

  const { error } = await admin
    .from('youtube_daily_stats')
    .upsert(upserts, { onConflict: 'channel_id,date' })

  if (error) {
    console.error('Daily stats snapshot failed:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  console.log(`Daily stats snapshot: ${channels.length} channels for ${today}`)
  await reportHeartbeat('cron.vercel.snapshot-daily-stats').catch(() => {}) /* watchdog-heartbeat */
  return NextResponse.json({ snapshotted: channels.length, date: today })
}
