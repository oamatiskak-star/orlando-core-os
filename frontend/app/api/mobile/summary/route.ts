import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const revalidate = 0

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const todayISO = todayStart.toISOString()

  const [
    workersRes,
    ytChannelsRes,
    ytQueueActiveRes,
    ytQueueFailedRes,
    wfTotalRes,
    wfActiveRes,
    wfRunsTodayRes,
    wfRunsFailedRes,
    qPendingRes,
    qRunningRes,
    qFailedRes,
    notifsRes,
  ] = await Promise.allSettled([
    supabase
      .from('worker_registry')
      .select('id,worker_type,status,last_heartbeat,description')
      .order('worker_type'),
    supabase
      .from('youtube_channels')
      .select('id,naam,oauth_connected,subscriber_count,view_count,video_count'),
    supabase
      .from('youtube_upload_queue')
      .select('id', { count: 'exact', head: true })
      .in('status', ['queued','preparing','normalizing','uploading','uploaded_pending_processing','processing','verifying']),
    supabase
      .from('youtube_upload_queue')
      .select('id', { count: 'exact', head: true })
      .in('status', ['failed','manual_review_required']),
    supabase.from('oc_workflows').select('id', { count: 'exact', head: true }),
    supabase.from('oc_workflows').select('id', { count: 'exact', head: true }).eq('status', 'actief'),
    supabase.from('oc_workflow_runs').select('id', { count: 'exact', head: true }).gte('started_at', todayISO),
    supabase.from('oc_workflow_runs').select('id', { count: 'exact', head: true }).gte('started_at', todayISO).eq('status', 'failed'),
    supabase.from('oc_queue_jobs').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('oc_queue_jobs').select('id', { count: 'exact', head: true }).eq('status', 'running'),
    supabase.from('oc_queue_jobs').select('id', { count: 'exact', head: true }).eq('status', 'failed'),
    supabase.from('mobile_notifications').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('read', false),
  ])

  const workers = workersRes.status === 'fulfilled' ? (workersRes.value.data ?? []) : []
  const ytChannels = ytChannelsRes.status === 'fulfilled' ? (ytChannelsRes.value.data ?? []) : []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ytConnected = ytChannels.filter((c: any) => c.oauth_connected).length

  const n = <T extends { status: string; value: { count?: number | null } }>(r: T): number =>
    r.status === 'fulfilled' ? (r.value.count ?? 0) : 0

  return NextResponse.json({
    workers,
    youtube: {
      channels: ytChannels.length,
      connected: ytConnected,
      queue_active: n(ytQueueActiveRes as any),
      queue_failed: n(ytQueueFailedRes as any),
    },
    workflows: {
      total:        n(wfTotalRes as any),
      active:       n(wfActiveRes as any),
      runs_today:   n(wfRunsTodayRes as any),
      failed_today: n(wfRunsFailedRes as any),
    },
    queue: {
      pending: n(qPendingRes as any),
      running: n(qRunningRes as any),
      failed:  n(qFailedRes as any),
    },
    notifications_unread: n(notifsRes as any),
  })
}
