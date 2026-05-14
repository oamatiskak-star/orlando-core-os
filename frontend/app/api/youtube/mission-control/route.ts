import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const revalidate = 0

export async function GET() {
  const supabase = await createClient()
  const today = new Date().toISOString().split('T')[0]
  const todayStart = `${today}T00:00:00Z`
  const todayEnd   = `${today}T23:59:59Z`

  const [
    { data: workers },
    { data: aiStatus },
    { data: todayQueue },
    { data: failedToday },
    { data: verifiedToday },
    { data: activeMedia },
    { data: auditLogs },
    { data: channels },
    { data: quotaData },
  ] = await Promise.all([
    supabase.from('worker_registry').select('*').order('worker_type'),
    supabase.from('ai_worker_status').select('*'),
    supabase.from('youtube_upload_queue')
      .select('id, status, channel_id, scheduled_publish_at, youtube_channels(naam)')
      .gte('scheduled_publish_at', todayStart)
      .lte('scheduled_publish_at', todayEnd)
      .order('scheduled_publish_at'),
    supabase.from('youtube_upload_queue')
      .select('id, status, updated_at', { count: 'exact' })
      .in('status', ['failed', 'manual_review_required'])
      .gte('updated_at', todayStart),
    supabase.from('youtube_upload_queue')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'verified_live')
      .gte('updated_at', todayStart),
    supabase.from('generated_media')
      .select('*')
      .not('render_status', 'eq', 'complete')
      .order('created_at', { ascending: false })
      .limit(20),
    supabase.from('media_audit_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50),
    supabase.from('youtube_channels')
      .select('id, naam, subscriber_count, view_count, quota_used, quota_limit, oauth_connected'),
    supabase.from('youtube_channels')
      .select('id, naam, quota_used, quota_limit'),
  ])

  // Compute pipeline stats
  const statusCounts = (todayQueue ?? []).reduce((acc: Record<string, number>, item) => {
    acc[item.status] = (acc[item.status] ?? 0) + 1
    return acc
  }, {})

  const activeWorkers  = (workers ?? []).filter(w => w.status === 'busy' || w.status === 'online').length
  const offlineWorkers = (workers ?? []).filter(w => w.status === 'offline').length

  const lmStudio = (aiStatus ?? []).find(a => a.engine === 'lmstudio')
  const ollama   = (aiStatus ?? []).find(a => a.engine === 'ollama')

  return NextResponse.json({
    stats: {
      active_workers:   activeWorkers,
      offline_workers:  offlineWorkers,
      failed_today:     failedToday?.length ?? 0,
      verified_today:   verifiedToday ?? 0,
      total_today:      todayQueue?.length ?? 0,
      pipeline_counts:  statusCounts,
    },
    workers:        workers ?? [],
    ai_engines:     { lm_studio: lmStudio, ollama },
    today_queue:    todayQueue ?? [],
    active_media:   activeMedia ?? [],
    audit_logs:     auditLogs ?? [],
    channels:       channels ?? [],
    quota:          quotaData ?? [],
  })
}
