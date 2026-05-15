import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import StatusPill from '@/components/mobile/StatusPill'
import {
  Play, Users, Eye, Video, Upload, AlertCircle,
  CheckCircle, Clock, Loader2, RefreshCw,
} from 'lucide-react'

export const metadata: Metadata = { title: 'YouTube Engine' }
export const dynamic = 'force-dynamic'
export const revalidate = 0

function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return String(n)
}

function timeAgo(iso: string | null): string {
  if (!iso) return '—'
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 1) return 'Nu'
  if (m < 60) return `${m}m geleden`
  if (m < 1440) return `${Math.floor(m / 60)}u geleden`
  return `${Math.floor(m / 1440)}d geleden`
}

const STATUS_META: Record<string, { label: string; color: string }> = {
  queued:                       { label: 'In wachtrij',   color: 'text-sky-400' },
  preparing:                    { label: 'Voorbereiden',  color: 'text-sky-400' },
  normalizing:                  { label: 'Normaliseren',  color: 'text-sky-400' },
  uploading:                    { label: 'Uploaden',      color: 'text-indigo-400' },
  uploaded_pending_processing:  { label: 'Verwerking',    color: 'text-indigo-400' },
  processing:                   { label: 'Verwerking',    color: 'text-indigo-400' },
  verifying:                    { label: 'Verificatie',   color: 'text-violet-400' },
  verified_live:                { label: 'Live',          color: 'text-emerald-400' },
  failed:                       { label: 'Mislukt',       color: 'text-red-400' },
  retrying:                     { label: 'Herpoging',     color: 'text-amber-400' },
  manual_review_required:       { label: 'Review nodig',  color: 'text-amber-400' },
}

export default async function MobileYouTubePage() {
  const supabase = await createClient()

  const [
    channelsRes,
    queueActiveRes,
    queueFailedRes,
    queueLiveRes,
    recentQueueRes,
  ] = await Promise.allSettled([
    supabase.from('youtube_channels').select('id,naam,subscriber_count,view_count,video_count,oauth_connected').order('subscriber_count', { ascending: false }),
    supabase.from('youtube_upload_queue').select('id', { count: 'exact', head: true }).in('status', ['queued','preparing','normalizing','uploading','uploaded_pending_processing','processing','verifying','retrying']),
    supabase.from('youtube_upload_queue').select('id', { count: 'exact', head: true }).in('status', ['failed','manual_review_required']),
    supabase.from('youtube_upload_queue').select('id', { count: 'exact', head: true }).eq('status', 'verified_live'),
    supabase.from('youtube_upload_queue').select('id,title,channel_name,status,updated_at').order('updated_at', { ascending: false }).limit(10),
  ])

  const channels = channelsRes.status === 'fulfilled' ? (channelsRes.value.data ?? []) : []
  const active   = queueActiveRes.status === 'fulfilled' ? (queueActiveRes.value.count ?? 0) : 0
  const failed   = queueFailedRes.status === 'fulfilled' ? (queueFailedRes.value.count ?? 0) : 0
  const live     = queueLiveRes.status === 'fulfilled'   ? (queueLiveRes.value.count   ?? 0) : 0
  const recent   = recentQueueRes.status === 'fulfilled' ? (recentQueueRes.value.data ?? []) : []

  const totalSubs  = channels.reduce((s, c: any) => s + (c.subscriber_count ?? 0), 0)
  const totalViews = channels.reduce((s, c: any) => s + (c.view_count      ?? 0), 0)
  const totalVids  = channels.reduce((s, c: any) => s + (c.video_count     ?? 0), 0)

  return (
    <div className="max-w-lg mx-auto px-4 py-5 space-y-6"
      style={{ paddingTop: 'calc(1.25rem + env(safe-area-inset-top))' }}>

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center flex-shrink-0">
          <Play size={16} className="text-red-400" />
        </div>
        <div>
          <h1 className="text-base font-bold text-white">YouTube Engine</h1>
          <p className="text-[11px] text-white/40">Upload pipeline & kanalen</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2.5">
        {[
          { label: 'Abonnees', val: fmt(totalSubs),  color: 'text-indigo-400' },
          { label: 'Views',    val: fmt(totalViews), color: 'text-sky-400' },
          { label: "Video's",  val: fmt(totalVids),  color: 'text-white/65' },
        ].map(s => (
          <div key={s.label} className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-3 text-center">
            <p className={`text-lg font-bold ${s.color}`}>{s.val}</p>
            <p className="text-[10px] text-white/40 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Queue status */}
      <section>
        <h2 className="text-[11px] text-white/38 font-semibold uppercase tracking-wider mb-3">Queue Status</h2>
        <div className="grid grid-cols-3 gap-2.5">
          {[
            { label: 'Actief',  val: active, icon: Loader2,   color: active > 0  ? 'text-indigo-400' : 'text-white/30' },
            { label: 'Live',    val: live,   icon: CheckCircle, color: 'text-emerald-400' },
            { label: 'Fouten',  val: failed, icon: AlertCircle, color: failed > 0 ? 'text-red-400'    : 'text-white/30' },
          ].map(s => {
            const Icon = s.icon
            return (
              <div key={s.label} className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-3">
                <Icon size={14} className={`${s.color} mb-2`} />
                <p className={`text-lg font-bold ${s.color}`}>{s.val}</p>
                <p className="text-[10px] text-white/40 mt-0.5">{s.label}</p>
              </div>
            )
          })}
        </div>
        {failed > 0 && (
          <Link href="/dashboard/youtube/queue"
            className="mt-2 flex items-center gap-2 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-xl">
            <AlertCircle size={12} className="text-red-400" />
            <span className="text-[11px] text-red-400">{failed} upload{failed !== 1 ? 's' : ''} mislukt — tik om te beheren</span>
          </Link>
        )}
      </section>

      {/* Channels */}
      {channels.length > 0 && (
        <section>
          <h2 className="text-[11px] text-white/38 font-semibold uppercase tracking-wider mb-3">Kanalen</h2>
          <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl divide-y divide-white/[0.04]">
            {channels.map((ch: any) => (
              <div key={ch.id} className="flex items-center gap-3 px-4 py-3">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${ch.oauth_connected ? 'bg-emerald-400' : 'bg-white/20'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white/80 font-medium truncate">{ch.naam}</p>
                  <p className="text-[10px] text-white/35">{fmt(ch.video_count ?? 0)} video&apos;s</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-white/70">{fmt(ch.subscriber_count ?? 0)}</p>
                  <p className="text-[10px] text-white/30">subs</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Recent queue items */}
      {recent.length > 0 && (
        <section>
          <h2 className="text-[11px] text-white/38 font-semibold uppercase tracking-wider mb-3">Recente uploads</h2>
          <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl divide-y divide-white/[0.04]">
            {recent.map((item: any) => {
              const meta = STATUS_META[item.status] ?? { label: item.status, color: 'text-white/40' }
              return (
                <div key={item.id} className="flex items-start gap-3 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] text-white/75 font-medium truncate">{item.title ?? 'Geen titel'}</p>
                    <p className="text-[10px] text-white/35 truncate">{item.channel_name ?? '—'} · {timeAgo(item.updated_at)}</p>
                  </div>
                  <span className={`text-[10px] font-medium ${meta.color} shrink-0 mt-0.5`}>{meta.label}</span>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {channels.length === 0 && recent.length === 0 && (
        <div className="text-center py-12">
          <Play size={32} className="text-white/15 mx-auto mb-3" />
          <p className="text-sm text-white/30">Geen kanaaldata beschikbaar</p>
        </div>
      )}
    </div>
  )
}
