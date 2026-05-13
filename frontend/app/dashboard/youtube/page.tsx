import { Video, Eye, Users, Clock, Upload, ShieldCheck, Play, AlertCircle, TrendingUp, Tv2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { Suspense } from 'react'
import UploadQueue from './UploadQueue'
import VerificationStatus from './VerificationStatus'
import LiveVideos from './LiveVideos'
import RetryMonitor from './RetryMonitor'
import AnalyticsInsights from './AnalyticsInsights'
import ChannelHealth from './ChannelHealth'
import ChannelStatsTable from './ChannelStatsTable'
import SyncButton from './SyncButton'
import PlanningButton from './PlanningButton'
import OAuthBanner from './OAuthBanner'
import TokenAutoRefresh from './TokenAutoRefresh'

function num(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
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
    supabase.from('youtube_upload_queue').select('*', { count: 'exact', head: true })
      .not('scheduled_publish_at', 'is', null)
      .gt('scheduled_publish_at', new Date().toISOString()),
    supabase.from('youtube_upload_queue').select('*', { count: 'exact', head: true })
      .in('status', ['failed', 'manual_review_required']),
  ])

  const totalViews = (channelRows ?? []).reduce((s, c) => s + (c.view_count ?? 0), 0)
  const totalSubs = (channelRows ?? []).reduce((s, c) => s + (c.subscriber_count ?? 0), 0)
  const totalVideos = (channelRows ?? []).reduce((s, c) => s + (c.video_count ?? 0), 0)

  const stats = [
    { label: 'Totaal Views',     value: num(totalViews),          icon: Eye,   color: 'text-sky-400 bg-sky-500/10 border-sky-500/20' },
    { label: 'Totaal Abonnees',  value: num(totalSubs),           icon: Users, color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20' },
    { label: 'Totaal Gepland',   value: scheduledCount ?? 0,      icon: Clock, color: (scheduledCount ?? 0) > 0 ? 'text-violet-400 bg-violet-500/10 border-violet-500/20' : 'text-red-400 bg-red-500/10 border-red-500/20' },
    { label: "Totaal Video's",   value: num(totalVideos),         icon: Video, color: 'text-white/50 bg-white/5 border-white/10' },
  ]

  return (
    <div className="space-y-5">
      <TokenAutoRefresh />
      <Suspense>
        <OAuthBanner />
      </Suspense>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
            <Video size={16} className="text-red-400" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-white">YouTube Upload Engine</h1>
            <p className="text-xs text-white/50">Volledig autonoom — upload, verificatie, herstel en analytics</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <PlanningButton />
          <SyncButton />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {stats.map(s => {
          const Icon = s.icon
          const [textC, bgC, borderC] = s.color.split(' ')
          return (
            <div key={s.label} className={`bg-white/[0.06] border ${borderC} rounded-xl p-4`}>
              <div className={`w-7 h-7 rounded-lg border ${bgC} ${borderC} flex items-center justify-center mb-3`}>
                <Icon size={13} className={textC} />
              </div>
              <p className={`text-xl font-bold ${textC}`}>{s.value}</p>
              <p className="text-[11px] text-white/50 mt-0.5">{s.label}</p>
            </div>
          )
        })}
      </div>

      {/* Channel Health */}
      <div className="bg-white/[0.06] border border-white/5 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <Tv2 size={14} className="text-white/65" /> Channel Health
          </h2>
          <span className="text-[11px] text-white/45">{channelRows?.length ?? 0} kanalen</span>
        </div>
        <ChannelHealth />
      </div>

      {/* Channel Stats Table */}
      <div className="bg-white/[0.06] border border-white/5 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <TrendingUp size={14} className="text-white/65" /> Kanaal Overzicht
          </h2>
          <span className="text-[11px] text-white/45">Totaal · Upload · Upcoming · Live · Verwerking · Fouten</span>
        </div>
        <ChannelStatsTable />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Upload Queue */}
        <div className="bg-white/[0.06] border border-white/5 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <Upload size={14} className="text-white/65" /> Upload Queue
            </h2>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              <span className="text-[11px] text-white/45">Live</span>
            </div>
          </div>
          <UploadQueue />
        </div>

        {/* Verification Status */}
        <div className="bg-white/[0.06] border border-white/5 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <ShieldCheck size={14} className="text-white/65" /> Verificatie Status
            </h2>
            <span className="text-[11px] text-white/45">Realtime voortgang</span>
          </div>
          <VerificationStatus />
        </div>
      </div>

      {/* Live Videos */}
      <div className="bg-white/[0.06] border border-white/5 rounded-xl p-5 space-y-3">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          <Play size={14} className="text-green-400" /> Live Videos
        </h2>
        <LiveVideos />
      </div>

      {/* Retry Monitor */}
      <div className="bg-white/[0.06] border border-red-500/10 rounded-xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <AlertCircle size={14} className="text-red-400/70" /> Retry Monitor
          </h2>
          {(failedCount ?? 0) > 0 && (
            <span className="px-2 py-0.5 bg-red-500/10 text-red-400 text-[10px] font-medium rounded-full">
              {failedCount} fouten
            </span>
          )}
        </div>
        <RetryMonitor />
      </div>

      {/* Analytics */}
      <div className="bg-white/[0.06] border border-white/5 rounded-xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <TrendingUp size={14} className="text-violet-400" /> Analytics Insights
          </h2>
          <span className="text-[11px] text-white/45">24u — CTR, retentie, viral score</span>
        </div>
        <AnalyticsInsights />
      </div>
    </div>
  )
}
