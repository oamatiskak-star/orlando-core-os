import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { Tv2, Users, Eye, Video, TrendingUp, CheckCircle, AlertCircle, Clock, RefreshCw, ExternalLink } from 'lucide-react'
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
    { count: totalVideos },
    { count: publishedCount },
    { count: failedCount },
    { count: scheduledSlots },
    { count: activeQueueCount },
    { data: recentVideos },
  ] = await Promise.all([
    // All videos ever registered for this channel
    supabase.from('youtube_videos').select('*', { count: 'exact', head: true }).eq('channel_id', id),
    // Successfully published
    supabase.from('youtube_videos').select('*', { count: 'exact', head: true }).eq('channel_id', id).eq('status', 'published'),
    // Failed uploads
    supabase.from('youtube_videos').select('*', { count: 'exact', head: true }).eq('channel_id', id).eq('status', 'failed'),
    // Planned time slots (not yet queued for upload)
    supabase.from('youtube_upload_queue').select('*', { count: 'exact', head: true }).eq('channel_id', id).eq('status', 'planned'),
    // Active in upload queue
    supabase.from('youtube_upload_queue').select('*', { count: 'exact', head: true }).eq('channel_id', id).in('status', ['queued', 'retrying', 'uploading']),
    // Most recent video entries
    supabase.from('youtube_videos')
      .select('id, title, status, upload_status, created_at, published_at, youtube_video_id, views')
      .eq('channel_id', id)
      .order('created_at', { ascending: false })
      .limit(10),
  ])

  const COLORS: Record<string, string> = {
    VermogenTv:         '#6366f1',
    VastgoedTv:         '#0ea5e9',
    SpaarTv:            '#10b981',
    CryptoVermogen:     '#f59e0b',
    BeleggingsTv:       '#8b5cf6',
    PropertyInvestorTv: '#ec4899',
  }
  const color = COLORS[ch.naam] ?? '#6366f1'

  const STATUS_COLOR: Record<string, string> = {
    published:   'text-green-400',
    failed:      'text-red-400',
    queued:      'text-sky-400',
    uploading:   'text-indigo-400',
    processing:  'text-amber-400',
    draft:       'text-white/50',
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
              <AlertCircle size={10} /> Verbinden via OAuth
            </Link>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {[
          { label: 'Subscribers',   value: num(ch.subscriber_count),   icon: Users,       color: 'text-indigo-400' },
          { label: 'Total Views',   value: num(ch.view_count),          icon: Eye,         color: 'text-sky-400' },
          { label: "Video's",       value: ch.video_count ?? 0,         icon: Video,       color: 'text-white/60' },
          { label: 'Gepubliceerd',  value: publishedCount ?? 0,         icon: TrendingUp,  color: 'text-green-400' },
          { label: 'Slots gepland', value: scheduledSlots ?? 0,         icon: Clock,       color: 'text-violet-400' },
          { label: 'Fouten',        value: failedCount ?? 0,            icon: AlertCircle, color: (failedCount ?? 0) > 0 ? 'text-red-400' : 'text-white/38' },
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
            { label: 'Channel ID',      value: ch.channel_id },
            { label: 'Status',          value: ch.status },
            { label: 'OAuth status',    value: ch.oauth_status },
            { label: 'Queue actief',    value: `${activeQueueCount ?? 0} in wachtrij` },
            { label: 'Vandaag',         value: num(ch.today_views ?? 0) + ' views' },
            { label: '7 dagen',         value: num(ch.weekly_views ?? 0) + ' views' },
            { label: '30 dagen',        value: num(ch.monthly_views ?? 0) + ' views' },
            { label: 'Est. revenue',    value: `€${(ch.estimated_revenue ?? 0).toFixed(2)}` },
            { label: 'Quota',           value: `${ch.upload_quota_used ?? 0}/6` },
            { label: 'Laatste sync',    value: ch.last_sync ? new Date(ch.last_sync).toLocaleString('nl-NL') : '—' },
          ].map(r => (
            <div key={r.label} className="flex items-center justify-between">
              <span className="text-xs text-white/50">{r.label}</span>
              <span className="text-xs text-white/60 font-mono truncate max-w-[140px]">{r.value ?? '—'}</span>
            </div>
          ))}

          {ch.oauth_status !== 'connected' && (
            <div className="mt-3 pt-3 border-t border-white/5">
              <p className="text-[10px] text-amber-400/80 mb-2">OAuth verlopen — herverbinden om uploads te hervatten</p>
              <Link href={`/api/youtube/oauth/connect?channel_uuid=${ch.id}`}
                className="block text-center w-full px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[11px] hover:bg-amber-500/20 transition-colors">
                Verbinden via OAuth
              </Link>
            </div>
          )}
        </div>

        {/* Recent uploads from youtube_videos */}
        <div className="lg:col-span-2 bg-white/[0.06] border border-white/5 rounded-xl p-5">
          <h3 className="text-xs font-semibold text-white/50 mb-3">
            Recente uploads ({totalVideos ?? 0} totaal geregistreerd)
          </h3>
          {!recentVideos?.length ? (
            <p className="text-xs text-white/38 text-center py-6">Geen uploads geregistreerd</p>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left py-1.5 pr-3 text-white/45 font-medium">Titel</th>
                  <th className="text-left py-1.5 pr-3 text-white/45 font-medium">Status</th>
                  <th className="text-right py-1.5 pr-3 text-white/45 font-medium">Views</th>
                  <th className="text-right py-1.5 text-white/45 font-medium">Datum</th>
                </tr>
              </thead>
              <tbody>
                {recentVideos.map(v => (
                  <tr key={v.id} className="border-b border-white/[0.03]">
                    <td className="py-2 pr-3 text-white/60 max-w-[160px] truncate">
                      {v.youtube_video_id ? (
                        <a
                          href={`https://youtube.com/watch?v=${v.youtube_video_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-white flex items-center gap-1"
                        >
                          {v.title ?? v.id.slice(0, 8) + '…'}
                          <ExternalLink size={9} className="opacity-50 shrink-0" />
                        </a>
                      ) : (
                        v.title ?? v.id.slice(0, 8) + '…'
                      )}
                    </td>
                    <td className={`py-2 pr-3 font-mono text-[10px] ${STATUS_COLOR[v.status ?? ''] ?? 'text-white/50'}`}>
                      {v.upload_status ?? v.status ?? '—'}
                    </td>
                    <td className="py-2 pr-3 text-right font-mono text-white/38">
                      {num(v.views)}
                    </td>
                    <td className="py-2 text-right text-white/38 font-mono text-[10px]">
                      {new Date(v.published_at ?? v.created_at).toLocaleString('nl-NL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
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
