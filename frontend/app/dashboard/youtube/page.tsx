import { Video, Eye, Users, Clock, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { Suspense } from 'react'
import OAuthBanner    from './OAuthBanner'
import TokenAutoRefresh from './TokenAutoRefresh'
import WorkerStatusBar  from './WorkerStatusBar'
import SyncButton       from './SyncButton'
import PlanningButton   from './PlanningButton'
import NieuweUploadModal from './NieuweUploadModal'
import DashboardGrid    from './DashboardGrid'

function num(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'K'
  return String(n)
}

export default async function YouTubePage() {
  const supabase = await createClient()

  const [
    { data: channelRows },
    { count: scheduledCount },
    { count: failedCount },
  ] = await Promise.all([
    supabase.from('youtube_channels').select('id, naam, view_count, subscriber_count, video_count'),
    supabase.from('youtube_upload_queue')
      .select('*', { count: 'exact', head: true })
      .not('scheduled_publish_at', 'is', null)
      .gt('scheduled_publish_at', new Date().toISOString()),
    supabase.from('youtube_upload_queue')
      .select('*', { count: 'exact', head: true })
      .in('status', ['failed', 'manual_review_required']),
  ])

  const totalViews = (channelRows ?? []).reduce((s, c) => s + (c.view_count ?? 0), 0)
  const totalSubs  = (channelRows ?? []).reduce((s, c) => s + (c.subscriber_count ?? 0), 0)
  const totalVids  = (channelRows ?? []).reduce((s, c) => s + (c.video_count ?? 0), 0)

  const stats = [
    { label: 'Views',     value: num(totalViews),     icon: Eye,          color: 'text-sky-400    bg-sky-500/10    border-sky-500/20' },
    { label: 'Abonnees',  value: num(totalSubs),      icon: Users,        color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20' },
    { label: 'Gepland',   value: scheduledCount ?? 0, icon: Clock,        color: (scheduledCount ?? 0) > 0 ? 'text-violet-400 bg-violet-500/10 border-violet-500/20' : 'text-white/40 bg-white/5 border-white/10' },
    { label: "Video's",   value: num(totalVids),      icon: Video,        color: 'text-white/50   bg-white/5       border-white/10' },
    { label: 'Fouten',    value: failedCount ?? 0,    icon: AlertCircle,  color: (failedCount ?? 0) > 0 ? 'text-red-400 bg-red-500/10 border-red-500/20' : 'text-white/30 bg-white/5 border-white/10' },
  ]

  const channels = (channelRows ?? []).map(c => ({ id: c.id, naam: c.naam }))

  return (
    <div className="space-y-5">
      <TokenAutoRefresh />
      <Suspense><OAuthBanner /></Suspense>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
            <Video size={16} className="text-red-400" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-white">YouTube Engine</h1>
            <p className="text-xs text-white/45">Upload · Verificatie · Analytics · Herstel</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <NieuweUploadModal channels={channels} />
          <PlanningButton />
          <SyncButton />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
        {stats.map(s => {
          const Icon = s.icon
          const [tc, bg, bc] = s.color.split(' ')
          return (
            <div key={s.label} className={`bg-white/[0.05] border ${bc} rounded-xl p-4`}>
              <div className={`w-7 h-7 rounded-lg border ${bg} ${bc} flex items-center justify-center mb-3`}>
                <Icon size={13} className={tc} />
              </div>
              <p className={`text-xl font-bold tabular-nums ${tc}`}>{s.value}</p>
              <p className="text-[11px] text-white/40 mt-0.5">{s.label}</p>
            </div>
          )
        })}
      </div>

      {/* Worker Status */}
      <WorkerStatusBar />

      {/* Draggable boards */}
      <DashboardGrid />
    </div>
  )
}
