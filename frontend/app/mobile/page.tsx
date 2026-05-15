import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import StatusPill from '@/components/mobile/StatusPill'
import {
  Play, GitBranch, Bell, Settings, Search, Mail,
  CreditCard, Cpu, Radio, Activity, AlertCircle,
  CheckCircle, Clock, Zap, Users,
} from 'lucide-react'

export const metadata: Metadata = { title: 'Command Center' }
export const dynamic = 'force-dynamic'
export const revalidate = 0

function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return String(n)
}

function timeAgo(iso: string | null): string {
  if (!iso) return 'Nooit'
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 1) return 'Nu'
  if (m < 60) return `${m}m geleden`
  if (m < 1440) return `${Math.floor(m / 60)}u geleden`
  return `${Math.floor(m / 1440)}d geleden`
}

const QUICK_LINKS = [
  { href: '/mobile/youtube',       label: 'YouTube',     icon: Play,        color: 'text-red-400    bg-red-500/10    border-red-500/20' },
  { href: '/mobile/content',       label: 'Content',     icon: Zap,         color: 'text-violet-400 bg-violet-500/10 border-violet-500/20' },
  { href: '/mobile/scrapers',      label: 'Vastgoed',    icon: Search,      color: 'text-sky-400    bg-sky-500/10    border-sky-500/20' },
  { href: '/mobile/workflows',     label: 'Workflows',   icon: GitBranch,   color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  { href: '/mobile/settings',      label: 'Mail Agent',  icon: Mail,        color: 'text-amber-400  bg-amber-500/10  border-amber-500/20' },
  { href: '/mobile/settings',      label: 'Moneybird',   icon: CreditCard,  color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20' },
  { href: '/mobile/settings',      label: 'Workers',     icon: Cpu,         color: 'text-pink-400   bg-pink-500/10   border-pink-500/20' },
  { href: '/mobile/notifications', label: 'Meldingen',   icon: Bell,        color: 'text-orange-400 bg-orange-500/10 border-orange-500/20' },
  { href: '/mobile/settings',      label: 'Instellingen', icon: Settings,   color: 'text-white/55   bg-white/5       border-white/10' },
]

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
  ])

  const workers = workersRes.status === 'fulfilled' ? (workersRes.value.data ?? []) : []
  const ytChannels = ytChannelsRes.status === 'fulfilled' ? (ytChannelsRes.value.data ?? []) : []
  const n = (r: PromiseSettledResult<{ count?: number | null }>) =>
    r.status === 'fulfilled' ? (r.value.count ?? 0) : 0

  const ytActive = n(ytQueueActiveRes as any)
  const ytFailed = n(ytQueueFailedRes as any)
  const wfActive = n(wfActiveRes as any)
  const wfFailed = n(wfRunsFailedRes as any)
  const qRunning = n(qRunningRes as any)
  const qFailed  = n(qFailedRes as any)
  const unread   = n(notifsRes as any)

  const workersOnline = workers.filter((w: any) => w.status === 'online' || w.status === 'busy').length
  const workersOffline = workers.filter((w: any) => w.status === 'offline').length

  const SYSTEMS = [
    {
      label: 'YouTube Engine',
      href: '/mobile/youtube',
      icon: Play,
      iconColor: 'text-red-400',
      status: ytFailed > 0 ? 'error' : ytActive > 0 ? 'running' : 'online',
      stats: [
        { key: 'Kanalen', val: ytChannels.length },
        { key: 'Actief', val: ytActive },
        { key: 'Fouten', val: ytFailed, alert: ytFailed > 0 },
      ],
    },
    {
      label: 'Workflows',
      href: '/mobile/workflows',
      icon: GitBranch,
      iconColor: 'text-emerald-400',
      status: wfFailed > 0 ? 'error' : wfActive > 0 ? 'running' : 'online',
      stats: [
        { key: 'Actief', val: wfActive },
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
        { key: 'Actief', val: qRunning },
        { key: 'Fouten', val: qFailed, alert: qFailed > 0 },
      ],
    },
    {
      label: 'Workers',
      href: '/mobile/settings',
      icon: Cpu,
      iconColor: 'text-pink-400',
      status: workersOffline > 0 ? 'warning' : workersOnline > 0 ? 'online' : 'unknown',
      stats: [
        { key: 'Online', val: workersOnline },
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

      {/* Quick Launch */}
      <section>
        <h2 className="text-[11px] text-white/38 font-semibold uppercase tracking-wider mb-3">Snelkoppelingen</h2>
        <div className="grid grid-cols-3 gap-2.5">
          {QUICK_LINKS.map(link => {
            const [tc, bg, bc] = link.color.split(' ')
            const Icon = link.icon
            return (
              <Link key={link.href + link.label} href={link.href}
                className={`flex flex-col items-center justify-center gap-1.5 rounded-xl border p-3 min-h-[4.5rem] transition-colors hover:bg-white/[0.06] ${bg} ${bc}`}>
                <Icon size={20} className={tc} />
                <span className="text-[11px] text-white/70 font-medium text-center leading-tight">{link.label}</span>
              </Link>
            )
          })}
        </div>
      </section>

      {/* System Status */}
      <section>
        <h2 className="text-[11px] text-white/38 font-semibold uppercase tracking-wider mb-3">Systemen</h2>
        <div className="space-y-2.5">
          {SYSTEMS.map(sys => {
            const Icon = sys.icon
            return (
              <Link key={sys.label} href={sys.href}
                className="flex items-center gap-3 bg-white/[0.04] border border-white/[0.06] rounded-xl px-4 py-3 hover:bg-white/[0.06] transition-colors">
                <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center flex-shrink-0">
                  <Icon size={16} className={sys.iconColor} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-white">{sys.label}</span>
                    <StatusPill status={sys.status} size="xs" />
                  </div>
                  <div className="flex items-center gap-3">
                    {sys.stats.map(st => (
                      <span key={st.key} className={`text-[11px] ${st.alert ? 'text-red-400' : 'text-white/40'}`}>
                        {st.key}: <span className={`font-medium ${st.alert ? 'text-red-400' : 'text-white/65'}`}>{st.val}</span>
                      </span>
                    ))}
                  </div>
                </div>
                <span className="text-white/20 text-sm">›</span>
              </Link>
            )
          })}
        </div>
      </section>

      {/* Workers */}
      {workers.length > 0 && (
        <section>
          <h2 className="text-[11px] text-white/38 font-semibold uppercase tracking-wider mb-3">Workers</h2>
          <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl divide-y divide-white/[0.04]">
            {workers.map((w: any) => (
              <div key={w.id} className="flex items-center gap-3 px-4 py-2.5">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  w.status === 'online'  ? 'bg-emerald-400' :
                  w.status === 'busy'    ? 'bg-amber-400' :
                  w.status === 'offline' ? 'bg-red-400' : 'bg-white/20'
                }`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white/80 font-medium truncate">{w.worker_type ?? w.id}</p>
                  {w.description && <p className="text-[10px] text-white/35 truncate">{w.description}</p>}
                </div>
                <div className="flex flex-col items-end gap-0.5">
                  <StatusPill status={w.status ?? 'unknown'} size="xs" />
                  {w.last_heartbeat && (
                    <span className="text-[10px] text-white/25">{timeAgo(w.last_heartbeat)}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* YouTube channels summary */}
      {ytChannels.length > 0 && (
        <section>
          <h2 className="text-[11px] text-white/38 font-semibold uppercase tracking-wider mb-3">YouTube Kanalen</h2>
          <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl divide-y divide-white/[0.04]">
            {ytChannels.map((ch: any) => (
              <Link key={ch.id} href="/mobile/youtube"
                className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.03] transition-colors">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${ch.oauth_connected ? 'bg-emerald-400' : 'bg-white/20'}`} />
                <span className="flex-1 text-sm text-white/75 font-medium">{ch.naam}</span>
                <div className="flex items-center gap-3 text-right">
                  <span className="text-[11px] text-white/40">
                    <span className="text-white/65 font-medium">{fmt(ch.subscriber_count ?? 0)}</span> subs
                  </span>
                  {!ch.oauth_connected && (
                    <span className="text-[10px] text-amber-400/70 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded-full">
                      Verbinden
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
