import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import {
  Tv2, Users, Eye, Video, TrendingUp, CheckCircle, AlertCircle,
  Clock, ExternalLink, Play, BarChart2, Zap, Upload, Calendar,
  ShieldCheck, ShieldAlert, RefreshCw,
} from 'lucide-react'
import Link from 'next/link'
import ChannelDetailStats from './ChannelDetailStats'

type Props = { params: Promise<{ id: string }> }

function num(n: number | null | undefined) {
  if (!n) return '0'
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'K'
  return String(n)
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('nl-NL', {
    weekday: 'short', day: '2-digit', month: 'short',
    hour: '2-digit', minute: '2-digit',
  })
}

function dayLabel(iso: string) {
  const d = new Date(iso)
  const today = new Date()
  const diff = Math.floor((d.setHours(0,0,0,0) - today.setHours(0,0,0,0)) / 86_400_000)
  if (diff === 0) return 'Vandaag'
  if (diff === 1) return 'Morgen'
  return new Date(iso).toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'short' })
}

const CHANNEL_COLORS: Record<string, string> = {
  VermogenTv:         '#6366f1',
  VastgoedTv:         '#0ea5e9',
  SpaarTv:            '#10b981',
  CryptoVermogen:     '#f59e0b',
  BeleggingsTv:       '#8b5cf6',
  PropertyInvestorTv: '#ec4899',
}

export default async function ChannelDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const admin    = createAdminClient()

  const { data: ch, error: chError } = await supabase
    .from('youtube_channels')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (chError || !ch) notFound()

  const now = new Date().toISOString()
  const in7d = new Date(Date.now() + 7 * 86_400_000).toISOString()

  const [
    { count: productieKlaar },
    { count: publishedCount },
    { count: failedCount },
    { count: activeQueue },
    { count: totalSlots },
    { data: upcomingSlots },
    { data: topVideos },
    { data: recentVideos },
    { data: health },
    { data: dailyStats },
  ] = await Promise.all([
    // Videos with file ready, not yet uploaded
    supabase.from('youtube_videos').select('*', { count: 'exact', head: true })
      .eq('channel_id', id).eq('status', 'queued').not('file_path', 'is', null),
    // Published / live on YouTube
    supabase.from('youtube_videos').select('*', { count: 'exact', head: true })
      .eq('channel_id', id).eq('status', 'published'),
    // Failed uploads
    supabase.from('youtube_videos').select('*', { count: 'exact', head: true })
      .eq('channel_id', id).eq('status', 'failed'),
    // Active in upload engine
    supabase.from('youtube_upload_queue').select('*', { count: 'exact', head: true })
      .eq('channel_id', id).in('status', ['queued', 'retrying', 'uploading']),
    // Planned future slots total
    supabase.from('youtube_upload_queue').select('*', { count: 'exact', head: true })
      .eq('channel_id', id).eq('status', 'planned').gt('scheduled_publish_at', now),
    // Next 7 days schedule
    supabase.from('youtube_upload_queue')
      .select('id, title, status, scheduled_publish_at, privacy_status')
      .eq('channel_id', id).eq('status', 'planned')
      .gt('scheduled_publish_at', now)
      .lte('scheduled_publish_at', in7d)
      .order('scheduled_publish_at', { ascending: true })
      .limit(40),
    // Top videos by views
    supabase.from('youtube_videos')
      .select('id, title, views, likes, youtube_video_id, published_at, duration_seconds')
      .eq('channel_id', id).eq('status', 'published')
      .order('views', { ascending: false })
      .limit(5),
    // Most recent video entries
    supabase.from('youtube_videos')
      .select('id, title, status, upload_status, created_at, published_at, youtube_video_id, views, file_path')
      .eq('channel_id', id)
      .order('created_at', { ascending: false })
      .limit(8),
    // Channel health
    admin.from('youtube_channel_health')
      .select('*')
      .eq('channel_id', id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    // Daily stats last 14 days
    admin.from('youtube_daily_stats')
      .select('date, views, estimated_revenue')
      .eq('channel_id', id)
      .order('date', { ascending: false })
      .limit(14),
  ])

  const color    = CHANNEL_COLORS[ch.naam] ?? '#6366f1'
  const tokenExp = ch.token_expires ? new Date(ch.token_expires) : null
  const tokenOk  = tokenExp && tokenExp > new Date(Date.now() + 5 * 60_000)
  const isConnected = ch.oauth_status === 'connected'

  // Group upcoming slots by day
  const byDay = new Map<string, typeof upcomingSlots>()
  for (const slot of upcomingSlots ?? []) {
    const day = slot.scheduled_publish_at!.slice(0, 10)
    if (!byDay.has(day)) byDay.set(day, [])
    byDay.get(day)!.push(slot)
  }

  const totalViewsAllTime = ch.view_count ?? 0
  const maxDailyViews = Math.max(...(dailyStats ?? []).map(d => d.views ?? 0), 1)

  return (
    <div className="space-y-5">

      {/* ── Header ────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl border border-white/10 flex items-center justify-center shrink-0"
            style={{ backgroundColor: color + '22' }}>
            <Tv2 size={20} style={{ color }} />
          </div>
          <div>
            <h1 className="text-base font-semibold text-white">{ch.naam}</h1>
            {ch.handle && <p className="text-xs text-white/40 font-mono">{ch.handle}</p>}
            {ch.channel_id && (
              <a href={`https://youtube.com/channel/${ch.channel_id}`} target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] text-white/30 hover:text-white/60 flex items-center gap-1 mt-0.5 font-mono">
                {ch.channel_id} <ExternalLink size={8} />
              </a>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isConnected && tokenOk ? (
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 text-[10px]">
              <ShieldCheck size={10} /> Verbonden — token geldig
            </span>
          ) : isConnected && !tokenOk ? (
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px]">
              <RefreshCw size={10} /> Token verloopt binnenkort
            </span>
          ) : (
            <Link href={`/api/youtube/oauth/connect?channel_uuid=${ch.id}`}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] font-medium hover:bg-red-500/20 transition-colors">
              <ShieldAlert size={10} /> OAuth verlopen — herverbinden
            </Link>
          )}
        </div>
      </div>

      {/* ── 8 Stat cards ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
        {[
          { label: 'Subscribers',     value: num(ch.subscriber_count), icon: Users,     color: 'text-indigo-400' },
          { label: 'Views totaal',    value: num(totalViewsAllTime),   icon: Eye,       color: 'text-sky-400'    },
          { label: 'Views vandaag',   value: num(ch.today_views),      icon: TrendingUp,color: 'text-emerald-400'},
          { label: 'Views 7 dagen',   value: num(ch.weekly_views),     icon: BarChart2, color: 'text-teal-400'   },
          { label: 'Views 30 dagen',  value: num(ch.monthly_views),    icon: BarChart2, color: 'text-cyan-400'   },
          { label: 'In productie',    value: productieKlaar ?? 0,      icon: Zap,       color: 'text-violet-400' },
          { label: 'Live op YT',      value: publishedCount ?? 0,      icon: Play,      color: 'text-green-400'  },
          { label: 'Geplande slots',  value: totalSlots ?? 0,          icon: Calendar,  color: 'text-amber-400'  },
        ].map(s => {
          const Icon = s.icon
          return (
            <div key={s.label} className="bg-white/[0.05] border border-white/5 rounded-xl p-3">
              <Icon size={12} className={`${s.color} mb-1.5`} />
              <p className={`text-lg font-bold leading-none ${s.color}`}>{s.value}</p>
              <p className="text-[10px] text-white/40 mt-1 leading-tight">{s.label}</p>
            </div>
          )
        })}
      </div>

      {/* ── 3-column layout ───────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">

        {/* Col 1: Channel info ──────────────────────────────── */}
        <div className="lg:col-span-3 space-y-3">
          <div className="bg-white/[0.05] border border-white/5 rounded-xl p-4 space-y-2.5">
            <h3 className="text-[11px] font-semibold text-white/40 uppercase tracking-wide">Kanaal info</h3>
            {[
              { label: 'Status',        value: ch.status },
              { label: 'OAuth',         value: ch.oauth_status },
              { label: 'Token verloopt',value: tokenExp ? tokenExp.toLocaleString('nl-NL', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' }) : '—' },
              { label: 'Queue actief',  value: `${activeQueue ?? 0} in upload` },
              { label: 'Fouten',        value: failedCount ?? 0,    warn: (failedCount ?? 0) > 0 },
              { label: "Video's live",  value: ch.video_count ?? 0 },
              { label: 'Quota gebruikt',value: `${ch.upload_quota_used ?? 0} / 6` },
              { label: 'Revenue (est.)',value: `€ ${(ch.estimated_revenue ?? 0).toFixed(2)}` },
              { label: 'Laatste sync',  value: ch.last_sync ? new Date(ch.last_sync).toLocaleString('nl-NL', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' }) : 'Nooit' },
            ].map(r => (
              <div key={r.label} className="flex items-start justify-between gap-2">
                <span className="text-[11px] text-white/40 shrink-0">{r.label}</span>
                <span className={`text-[11px] font-mono text-right truncate max-w-[120px] ${(r as any).warn ? 'text-red-400' : 'text-white/60'}`}>
                  {String(r.value ?? '—')}
                </span>
              </div>
            ))}
          </div>

          {/* Health */}
          {health && (
            <div className="bg-white/[0.05] border border-white/5 rounded-xl p-4 space-y-2">
              <h3 className="text-[11px] font-semibold text-white/40 uppercase tracking-wide">Health</h3>
              {[
                { label: 'Status',    value: health.health_status },
                { label: 'Strikes',   value: health.strikes ?? 0, warn: (health.strikes ?? 0) > 0 },
                { label: 'API errors',value: health.api_errors ?? 0, warn: (health.api_errors ?? 0) > 0 },
                { label: 'Token OK',  value: health.token_valid ? 'Ja' : 'Nee', warn: !health.token_valid },
                { label: 'Quota',     value: `${health.quota_used ?? 0} / ${health.quota_limit ?? 10000}` },
              ].map(r => (
                <div key={r.label} className="flex items-center justify-between">
                  <span className="text-[11px] text-white/40">{r.label}</span>
                  <span className={`text-[11px] font-mono ${(r as any).warn ? 'text-red-400' : 'text-white/60'}`}>
                    {String(r.value)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* OAuth reconnect */}
          {!isConnected && (
            <div className="bg-red-500/5 border border-red-500/15 rounded-xl p-4 space-y-2">
              <p className="text-[11px] text-red-400/80 leading-relaxed">
                OAuth verlopen. Herverbind om automatische uploads te hervatten.
              </p>
              <Link href={`/api/youtube/oauth/connect?channel_uuid=${ch.id}`}
                className="block text-center w-full px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium hover:bg-red-500/20 transition-colors">
                Verbinden via OAuth
              </Link>
            </div>
          )}
        </div>

        {/* Col 2: Upcoming schedule ─────────────────────────── */}
        <div className="lg:col-span-5 bg-white/[0.05] border border-white/5 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[11px] font-semibold text-white/40 uppercase tracking-wide">
              Aankomende uploads — 7 dagen ({totalSlots ?? 0} slots totaal)
            </h3>
          </div>

          {byDay.size === 0 ? (
            <p className="text-xs text-white/30 text-center py-8">Geen geplande slots de komende 7 dagen</p>
          ) : (
            <div className="space-y-4 max-h-[420px] overflow-y-auto pr-1">
              {Array.from(byDay.entries()).map(([day, slots]) => (
                <div key={day}>
                  <p className="text-[10px] font-semibold text-white/30 uppercase tracking-wider mb-1.5 sticky top-0 bg-[#0d0d1a] py-0.5">
                    {dayLabel(day + 'T00:00:00')}
                    <span className="ml-2 text-white/20 normal-case font-normal">({slots!.length} uploads)</span>
                  </p>
                  <div className="space-y-1">
                    {slots!.map(slot => {
                      const isShort = slot.title?.includes('[Short]')
                      const time = new Date(slot.scheduled_publish_at!).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })
                      return (
                        <div key={slot.id} className="flex items-center gap-2.5 py-1 px-2 rounded-lg hover:bg-white/[0.04] transition-colors">
                          <span className="text-[11px] font-mono text-white/30 w-10 shrink-0">{time}</span>
                          {isShort ? (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-violet-500/15 text-violet-400 font-medium shrink-0">SHORT</span>
                          ) : (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-400 font-medium shrink-0">LONG</span>
                          )}
                          <span className="text-xs text-white/55 truncate">
                            {slot.title?.replace(/\[Short\]\s*/, '').replace(/— .+$/, '').trim() || 'Slot zonder titel'}
                          </span>
                          <span className={`ml-auto text-[9px] shrink-0 font-mono ${slot.status === 'queued' ? 'text-emerald-400' : 'text-white/20'}`}>
                            {slot.status === 'queued' ? '● klaar' : '○ gepland'}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Col 3: Top + recent videos ───────────────────────── */}
        <div className="lg:col-span-4 space-y-3">

          {/* Top videos */}
          <div className="bg-white/[0.05] border border-white/5 rounded-xl p-4">
            <h3 className="text-[11px] font-semibold text-white/40 uppercase tracking-wide mb-3">Top video's</h3>
            {!topVideos?.length ? (
              <p className="text-xs text-white/30 text-center py-4">Geen gepubliceerde video's</p>
            ) : (
              <div className="space-y-2">
                {topVideos.map((v, i) => (
                  <div key={v.id} className="flex items-start gap-2">
                    <span className="text-[10px] text-white/20 font-mono w-4 shrink-0 mt-0.5">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      {v.youtube_video_id ? (
                        <a href={`https://youtube.com/watch?v=${v.youtube_video_id}`}
                          target="_blank" rel="noopener noreferrer"
                          className="text-xs text-white/65 hover:text-white truncate block">
                          {v.title}
                        </a>
                      ) : (
                        <p className="text-xs text-white/65 truncate">{v.title}</p>
                      )}
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-[10px] text-sky-400 font-mono">{num(v.views)} views</span>
                        {v.likes ? <span className="text-[10px] text-white/30 font-mono">{num(v.likes)} likes</span> : null}
                      </div>
                    </div>
                    {v.youtube_video_id && (
                      <a href={`https://youtube.com/watch?v=${v.youtube_video_id}`}
                        target="_blank" rel="noopener noreferrer"
                        className="text-white/20 hover:text-white/60 shrink-0 mt-0.5">
                        <ExternalLink size={10} />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent videos */}
          <div className="bg-white/[0.05] border border-white/5 rounded-xl p-4">
            <h3 className="text-[11px] font-semibold text-white/40 uppercase tracking-wide mb-3">Recente uploads</h3>
            {!recentVideos?.length ? (
              <p className="text-xs text-white/30 text-center py-4">Geen video's</p>
            ) : (
              <div className="space-y-1.5">
                {recentVideos.map(v => {
                  const SC: Record<string, string> = {
                    published: 'text-green-400', failed: 'text-red-400',
                    queued: 'text-sky-400', uploading: 'text-indigo-400',
                  }
                  const statusColor = SC[v.status ?? ''] ?? 'text-white/30'

                  return (
                    <div key={v.id} className="flex items-center gap-2 py-1 border-b border-white/[0.04] last:border-0">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-white/60 truncate">{v.title ?? 'Zonder titel'}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={`text-[9px] font-mono ${statusColor}`}>{v.upload_status ?? v.status}</span>
                          <span className="text-[9px] text-white/25 font-mono">
                            {new Date(v.published_at ?? v.created_at).toLocaleDateString('nl-NL', { day:'2-digit', month:'short' })}
                          </span>
                          {v.views ? <span className="text-[9px] text-sky-400/70 font-mono">{num(v.views)}</span> : null}
                        </div>
                      </div>
                      {v.youtube_video_id ? (
                        <a href={`https://youtube.com/watch?v=${v.youtube_video_id}`}
                          target="_blank" rel="noopener noreferrer"
                          className="text-white/20 hover:text-white/60 shrink-0">
                          <ExternalLink size={9} />
                        </a>
                      ) : v.file_path ? (
                        <span className="text-[9px] text-violet-400/60 font-mono shrink-0">bestand✓</span>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Daily stats bar chart ─────────────────────────────── */}
      <div className="bg-white/[0.05] border border-white/5 rounded-xl p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[11px] font-semibold text-white/40 uppercase tracking-wide">Views per dag — laatste 14 dagen</h3>
          <span className="text-[10px] text-white/25">Snapshot dagelijks 23:55</span>
        </div>
        {!dailyStats?.length ? (
          <p className="text-xs text-white/25 text-center py-6">
            Nog geen dagelijkse data. Eerste snapshot volgt om 23:55 vanavond.
          </p>
        ) : (
          <div className="flex items-end gap-1.5 h-20">
            {[...dailyStats].reverse().map(d => {
              const pct = maxDailyViews > 0 ? ((d.views ?? 0) / maxDailyViews) * 100 : 0
              const label = new Date(d.date).toLocaleDateString('nl-NL', { day: '2-digit', month: 'short' })
              return (
                <div key={d.date} className="flex-1 flex flex-col items-center gap-1 group relative">
                  <div
                    className="w-full rounded-sm transition-all"
                    style={{ height: `${Math.max(pct, 2)}%`, backgroundColor: color + 'cc' }}
                  />
                  <span className="text-[8px] text-white/20 font-mono group-hover:text-white/50 transition-colors truncate">
                    {label}
                  </span>
                  <div className="absolute -top-7 left-1/2 -translate-x-1/2 hidden group-hover:flex bg-black/80 text-white text-[10px] font-mono px-2 py-0.5 rounded whitespace-nowrap z-10">
                    {num(d.views)} views
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Live sync */}
      <ChannelDetailStats channelId={id} />
    </div>
  )
}
