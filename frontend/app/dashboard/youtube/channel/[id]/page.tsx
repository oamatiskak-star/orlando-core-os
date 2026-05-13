import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { Tv2, Users, Eye, Video, TrendingUp, CheckCircle, AlertCircle, Clock, RefreshCw } from 'lucide-react'
import Link from 'next/link'
import ChannelDetailStats from './ChannelDetailStats'

type Props = { params: Promise<{ id: string }> }

function num(n: number | null) {
  if (!n) return '0'
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'K'
  return String(n)
}

export default async function ChannelDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const { data: ch, error: chError } = await supabase
    .from('youtube_channels')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (chError || !ch) notFound()

  const [
    { count: totalUploads },
    { count: liveCount },
    { count: failedCount },
    { count: scheduledCount },
    { data: recentJobs },
  ] = await Promise.all([
    supabase.from('youtube_upload_queue').select('*', { count: 'exact', head: true }).eq('channel_id', id),
    supabase.from('youtube_upload_queue').select('*', { count: 'exact', head: true }).eq('channel_id', id).eq('status', 'verified_live'),
    supabase.from('youtube_upload_queue').select('*', { count: 'exact', head: true }).eq('channel_id', id).in('status', ['failed', 'manual_review_required']),
    supabase.from('youtube_upload_queue').select('*', { count: 'exact', head: true }).eq('channel_id', id).not('scheduled_publish_at', 'is', null).gt('scheduled_publish_at', new Date().toISOString()),
    supabase.from('youtube_upload_queue').select('id, title, status, created_at, updated_at, retry_count, last_error').eq('channel_id', id).order('updated_at', { ascending: false }).limit(10),
  ])

  const COLORS: Record<string, string> = {
    VermogenTv:        '#6366f1',
    VastgoedTv:        '#0ea5e9',
    SpaarTv:           '#10b981',
    CryptoVermogen:    '#f59e0b',
    BeleggingsTv:      '#8b5cf6',
    PropertyInvestorTv:'#ec4899',
  }
  const color = COLORS[ch.naam] ?? '#6366f1'

  const STATUS_COLOR: Record<string, string> = {
    verified_live: 'text-green-400', failed: 'text-red-400', manual_review_required: 'text-red-400',
    queued: 'text-sky-400', uploading: 'text-indigo-400', processing: 'text-amber-400', verifying: 'text-violet-400',
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl border border-white/10 flex items-center justify-center" style={{ backgroundColor: color + '20' }}>
            <Tv2 size={18} style={{ color }} />
          </div>
          <div>
            <h1 className="text-base font-semibold text-white">{ch.naam}</h1>
            {ch.handle && <p className="text-xs text-white/50 font-mono">{ch.handle}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {ch.oauth_status === 'connected' ? (
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 text-[10px]">
              <CheckCircle size={10} /> Connected
            </span>
          ) : (
            <Link href={`/api/youtube/oauth/connect?channel_uuid=${ch.id}`}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] hover:bg-amber-500/20 transition-colors">
              <AlertCircle size={10} /> Verbinden
            </Link>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {[
          { label: 'Subscribers',  value: num(ch.subscriber_count),  icon: Users,       color: 'text-indigo-400' },
          { label: 'Total Views',  value: num(ch.view_count),         icon: Eye,         color: 'text-sky-400' },
          { label: "Video's",      value: ch.video_count ?? 0,        icon: Video,       color: 'text-white/60' },
          { label: 'Live',         value: liveCount ?? 0,             icon: TrendingUp,  color: 'text-green-400' },
          { label: 'Scheduled',    value: scheduledCount ?? 0,        icon: Clock,       color: 'text-violet-400' },
          { label: 'Fouten',       value: failedCount ?? 0,           icon: AlertCircle, color: (failedCount ?? 0) > 0 ? 'text-red-400' : 'text-white/38' },
        ].map(s => {
          const Icon = s.icon
          return (
            <div key={s.label} className="bg-white/[0.06] border border-white/5 rounded-xl p-4">
              <Icon size={13} className={`${s.color} mb-2`} />
              <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-[11px] text-white/50 mt-0.5">{s.label}</p>
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Channel info */}
        <div className="bg-white/[0.06] border border-white/5 rounded-xl p-5 space-y-3">
          <h3 className="text-xs font-semibold text-white/50">Kanaal Info</h3>
          {[
            { label: 'Channel ID',    value: ch.channel_id },
            { label: 'Status',        value: ch.status },
            { label: 'OAuth status',  value: ch.oauth_status },
            { label: 'Vandaag',       value: num(ch.today_views ?? 0) + ' views' },
            { label: '7 dagen',       value: num(ch.weekly_views ?? 0) + ' views' },
            { label: '30 dagen',      value: num(ch.monthly_views ?? 0) + ' views' },
            { label: 'Est. revenue',  value: `€${(ch.estimated_revenue ?? 0).toFixed(2)}` },
            { label: 'Quota',         value: `${ch.upload_quota_used ?? 0}/6` },
            { label: 'Laatste sync',  value: ch.last_sync ? new Date(ch.last_sync).toLocaleString('nl-NL') : '—' },
          ].map(r => (
            <div key={r.label} className="flex items-center justify-between">
              <span className="text-xs text-white/50">{r.label}</span>
              <span className="text-xs text-white/60 font-mono truncate max-w-[140px]">{r.value ?? '—'}</span>
            </div>
          ))}
        </div>

        {/* Recent uploads */}
        <div className="lg:col-span-2 bg-white/[0.06] border border-white/5 rounded-xl p-5">
          <h3 className="text-xs font-semibold text-white/50 mb-3">Recente uploads ({totalUploads ?? 0} totaal)</h3>
          {!recentJobs?.length ? (
            <p className="text-xs text-white/38 text-center py-6">Geen uploads</p>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left py-1.5 pr-3 text-white/45 font-medium">Titel</th>
                  <th className="text-left py-1.5 pr-3 text-white/45 font-medium">Status</th>
                  <th className="text-right py-1.5 pr-3 text-white/45 font-medium">Pogingen</th>
                  <th className="text-right py-1.5 text-white/45 font-medium">Gewijzigd</th>
                </tr>
              </thead>
              <tbody>
                {recentJobs.map(j => (
                  <tr key={j.id} className="border-b border-white/[0.03]">
                    <td className="py-2 pr-3 text-white/60 max-w-[160px] truncate">{j.title ?? j.id.slice(0,8)+'...'}</td>
                    <td className={`py-2 pr-3 font-mono text-[10px] ${STATUS_COLOR[j.status] ?? 'text-white/50'}`}>{j.status}</td>
                    <td className={`py-2 pr-3 text-right font-mono ${j.retry_count > 0 ? 'text-amber-400' : 'text-white/38'}`}>{j.retry_count}</td>
                    <td className="py-2 text-right text-white/38 font-mono text-[10px]">
                      {new Date(j.updated_at).toLocaleString('nl-NL', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Live sync button */}
      <ChannelDetailStats channelId={id} />
    </div>
  )
}
