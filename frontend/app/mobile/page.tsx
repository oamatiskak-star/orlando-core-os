import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Bell, Mail, AlertTriangle, FileText, Clock } from 'lucide-react'
import { Play, GitBranch, Activity, Cpu } from 'lucide-react'
import CommandCenterClient from '@/components/mobile/CommandCenterClient'

export const metadata: Metadata = { title: 'Command Center' }
export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function CommandCenter() {
  const supabase = await createClient()

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const todayISO = todayStart.toISOString()

  const [
    workersRes,
    ytChannelsRes,
    ytQueueActiveRes,
    ytQueueFailedRes,
    wfActiveRes,
    wfRunsFailedRes,
    qRunningRes,
    qFailedRes,
    notifsRes,
    mailUnreadRes,
    mailUrgentRes,
    mailDraftsRes,
    mailMoneybirdRes,
  ] = await Promise.allSettled([
    supabase.from('worker_registry').select('id,worker_type,status,last_heartbeat,description').order('worker_type'),
    supabase.from('youtube_channels').select('id,naam,oauth_connected,subscriber_count'),
    supabase.from('youtube_upload_queue').select('id', { count: 'exact', head: true }).in('status', ['queued','preparing','normalizing','uploading','uploaded_pending_processing','processing','verifying']),
    supabase.from('youtube_upload_queue').select('id', { count: 'exact', head: true }).in('status', ['failed','manual_review_required']),
    supabase.from('oc_workflows').select('id', { count: 'exact', head: true }).eq('status', 'actief'),
    supabase.from('oc_workflow_runs').select('id', { count: 'exact', head: true }).gte('started_at', todayISO).eq('status', 'failed'),
    supabase.from('oc_queue_jobs').select('id', { count: 'exact', head: true }).eq('status', 'running'),
    supabase.from('oc_queue_jobs').select('id', { count: 'exact', head: true }).eq('status', 'failed'),
    supabase.from('mobile_notifications').select('id', { count: 'exact', head: true }).eq('read', false),
    supabase.from('mail_messages').select('id', { count: 'exact', head: true }).eq('is_read', false).eq('is_archived', false),
    supabase.from('mail_messages').select('id', { count: 'exact', head: true }).eq('priority', 'urgent'),
    supabase.from('mail_drafts').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('mail_messages').select('id', { count: 'exact', head: true }).eq('moneybird_status', 'pending'),
  ])

  const workers    = workersRes.status    === 'fulfilled' ? (workersRes.value.data    ?? []) : []
  const ytChannels = ytChannelsRes.status === 'fulfilled' ? (ytChannelsRes.value.data ?? []) : []
  const n = (r: PromiseSettledResult<{ count?: number | null }>) =>
    r.status === 'fulfilled' ? (r.value.count ?? 0) : 0

  const ytActive       = n(ytQueueActiveRes  as any)
  const ytFailed       = n(ytQueueFailedRes  as any)
  const wfActive       = n(wfActiveRes       as any)
  const wfFailed       = n(wfRunsFailedRes   as any)
  const qRunning       = n(qRunningRes       as any)
  const qFailed        = n(qFailedRes        as any)
  const unread         = n(notifsRes         as any)
  const mailUnread     = n(mailUnreadRes     as any)
  const mailUrgent     = n(mailUrgentRes     as any)
  const mailDrafts     = n(mailDraftsRes     as any)
  const mailMoneybird  = n(mailMoneybirdRes  as any)

  const workersOnline  = workers.filter((w: any) => w.status === 'online' || w.status === 'busy').length
  const workersOffline = workers.filter((w: any) => w.status === 'offline').length

  const systems = [
    {
      label: 'YouTube Engine',
      href: '/mobile/youtube',
      icon: Play,
      iconColor: 'text-red-400',
      status: ytFailed > 0 ? 'error' : ytActive > 0 ? 'running' : 'online',
      stats: [
        { key: 'Kanalen', val: ytChannels.length },
        { key: 'Actief',  val: ytActive },
        { key: 'Fouten',  val: ytFailed, alert: ytFailed > 0 },
      ],
    },
    {
      label: 'Workflows',
      href: '/mobile/workflows',
      icon: GitBranch,
      iconColor: 'text-emerald-400',
      status: wfFailed > 0 ? 'error' : wfActive > 0 ? 'running' : 'online',
      stats: [
        { key: 'Actief',         val: wfActive },
        { key: 'Fouten vandaag', val: wfFailed, alert: wfFailed > 0 },
      ],
    },
    {
      label: 'Queue Jobs',
      href: '/dashboard/operations/queue',
      icon: Activity,
      iconColor: 'text-sky-400',
      status: qFailed > 0 ? 'error' : qRunning > 0 ? 'running' : 'online',
      stats: [
        { key: 'Actief',  val: qRunning },
        { key: 'Fouten',  val: qFailed, alert: qFailed > 0 },
      ],
    },
    {
      label: 'Workers',
      href: '/mobile/settings',
      icon: Cpu,
      iconColor: 'text-pink-400',
      status: workersOffline > 0 ? 'warning' : workersOnline > 0 ? 'online' : 'unknown',
      stats: [
        { key: 'Online',  val: workersOnline },
        { key: 'Offline', val: workersOffline, alert: workersOffline > 0 },
      ],
    },
  ]

  return (
    <div className="max-w-lg mx-auto px-4 py-5 space-y-6"
      style={{ paddingTop: 'calc(1.25rem + env(safe-area-inset-top))' }}>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-white">Orlando Core OS</h1>
          <p className="text-[11px] text-white/40 mt-0.5">Command Center</p>
        </div>
        <Link href="/mobile/notifications" className="relative p-2">
          <Bell size={20} className="text-white/55" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 rounded-full text-[9px] font-bold text-white flex items-center justify-center">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </Link>
      </div>

      {/* Mail OS widget */}
      <Link
        href="/mobile/mail"
        className="block bg-[#0d0d1a] rounded-2xl border border-white/[0.08] p-4 hover:border-white/[0.12] transition-colors"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Mail size={16} className="text-indigo-400" />
            <span className="text-[13px] font-semibold text-white">Mail OS</span>
          </div>
          {mailUnread > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-indigo-500 text-white text-[10px] font-bold">
              {mailUnread > 99 ? '99+' : mailUnread}
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="flex items-center gap-2 p-2 bg-white/[0.03] rounded-xl">
            <Mail size={13} className="text-white/30" />
            <div>
              <p className="text-[11px] text-white/40">Ongelezen</p>
              <p className="text-[14px] font-bold text-white">{mailUnread}</p>
            </div>
          </div>
          <div className={`flex items-center gap-2 p-2 rounded-xl ${mailUrgent > 0 ? 'bg-red-500/10' : 'bg-white/[0.03]'}`}>
            <AlertTriangle size={13} className={mailUrgent > 0 ? 'text-red-400' : 'text-white/30'} />
            <div>
              <p className="text-[11px] text-white/40">Urgent</p>
              <p className={`text-[14px] font-bold ${mailUrgent > 0 ? 'text-red-400' : 'text-white'}`}>{mailUrgent}</p>
            </div>
          </div>
          <div className={`flex items-center gap-2 p-2 rounded-xl ${mailDrafts > 0 ? 'bg-indigo-500/10' : 'bg-white/[0.03]'}`}>
            <Clock size={13} className={mailDrafts > 0 ? 'text-indigo-400' : 'text-white/30'} />
            <div>
              <p className="text-[11px] text-white/40">Concepten</p>
              <p className={`text-[14px] font-bold ${mailDrafts > 0 ? 'text-indigo-400' : 'text-white'}`}>{mailDrafts}</p>
            </div>
          </div>
          <div className={`flex items-center gap-2 p-2 rounded-xl ${mailMoneybird > 0 ? 'bg-yellow-500/10' : 'bg-white/[0.03]'}`}>
            <FileText size={13} className={mailMoneybird > 0 ? 'text-yellow-400' : 'text-white/30'} />
            <div>
              <p className="text-[11px] text-white/40">Facturen</p>
              <p className={`text-[14px] font-bold ${mailMoneybird > 0 ? 'text-yellow-400' : 'text-white'}`}>{mailMoneybird}</p>
            </div>
          </div>
        </div>
      </Link>

      {/* Client component handles sorting + collapsing */}
      <CommandCenterClient
        workers={workers}
        ytChannels={ytChannels}
        systems={systems}
        unread={unread}
      />
    </div>
  )
}
