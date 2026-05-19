'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Clock, Calendar, Tv2, RefreshCw, X, Zap, ShieldCheck, ChevronDown, ChevronUp, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import clsx from 'clsx'

type ScheduledItem = {
  id: string
  title: string | null
  status: string
  scheduled_publish_at: string
  channel_id: string
  retry_count: number
  last_error: string | null
  youtube_url: string | null
  youtube_video_id: string | null
  youtube_videos: { title: string | null } | null
  youtube_channels: { naam: string } | null
}

const STATUS_COLOR: Record<string, string> = {
  planned:                      'text-white/40 bg-white/5',
  queued:                       'text-sky-400 bg-sky-500/10',
  preparing:                    'text-sky-400 bg-sky-500/10',
  normalizing:                  'text-sky-400 bg-sky-500/10',
  uploading:                    'text-indigo-400 bg-indigo-500/10',
  uploaded_pending_processing:  'text-violet-400 bg-violet-500/10',
  processing:                   'text-violet-400 bg-violet-500/10',
  verifying:                    'text-amber-400 bg-amber-500/10',
  verified_live:                'text-green-400 bg-green-500/10',
  failed:                       'text-red-400 bg-red-500/10',
  manual_review_required:       'text-red-400 bg-red-500/10',
  paused:                       'text-amber-400 bg-amber-500/10',
}

const STATUS_LABEL: Record<string, string> = {
  planned: 'Gepland', queued: 'Wachtrij', preparing: 'Bezig', normalizing: 'FFmpeg',
  uploading: 'Uploaden', uploaded_pending_processing: 'YT verwerkt', processing: 'Processing',
  verifying: 'Verificatie', verified_live: '✓ Live', failed: '✗ Mislukt',
  manual_review_required: 'Review', paused: 'Gepauzeerd',
}

function fmt(iso: string) {
  return new Date(iso).toLocaleString('nl-NL', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function timeUntil(iso: string) {
  const diff = new Date(iso).getTime() - Date.now()
  if (diff < 0) return 'Verlopen'
  const h = Math.floor(diff / 3_600_000)
  const m = Math.floor((diff % 3_600_000) / 60_000)
  if (h > 24) return `${Math.floor(h / 24)}d ${h % 24}u`
  return `${h}u ${m}m`
}

export default function ScheduledPage() {
  const [items, setItems]     = useState<ScheduledItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter]   = useState<'all' | 'upcoming' | 'failed'>('upcoming')
  const [busy, setBusy]       = useState<Record<string, boolean>>({})
  const [showAll, setShowAll] = useState(false)

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('youtube_upload_queue')
      .select('id, title, status, scheduled_publish_at, channel_id, retry_count, last_error, youtube_url, youtube_video_id, youtube_videos(title), youtube_channels(naam)')
      .not('status', 'eq', 'planned')
      .order('scheduled_publish_at', { ascending: true })
      .limit(300)
    setItems((data ?? []) as unknown as ScheduledItem[])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    const t = setInterval(load, 15_000)
    return () => clearInterval(t)
  }, [load])

  async function act(action: string, id: string) {
    setBusy(b => ({ ...b, [`${id}_${action}`]: true }))
    await fetch('/api/youtube/override', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, queue_id: id }),
    })
    await load()
    setBusy(b => ({ ...b, [`${id}_${action}`]: false }))
  }

  const now = new Date()
  const upcoming = items.filter(i => new Date(i.scheduled_publish_at) > now)
  const past     = items.filter(i => new Date(i.scheduled_publish_at) <= now)
  const failed   = items.filter(i => i.status === 'failed' || i.status === 'manual_review_required')

  const filtered = filter === 'upcoming' ? upcoming : filter === 'failed' ? failed : items
  const visible  = showAll ? filtered : filtered.slice(0, 50)

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Totaal gepland',  value: items.length,    color: 'text-white/70' },
          { label: 'Upcoming',        value: upcoming.length, color: 'text-indigo-400' },
          { label: 'Verlopen',        value: past.length,     color: 'text-amber-400' },
          { label: 'Failed',          value: failed.length,   color: 'text-red-400' },
        ].map(s => (
          <div key={s.label} className="bg-white/[0.06] border border-white/5 rounded-xl p-4">
            <p className={clsx('text-2xl font-bold', s.color)}>{s.value}</p>
            <p className="text-[11px] text-white/50 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white/[0.06] border border-white/5 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <Clock size={14} className="text-white/65" />
          <h2 className="text-sm font-semibold text-white">Geplande Uploads</h2>
          <div className="flex items-center gap-1 ml-2">
            {([
              { key: 'upcoming', label: `Upcoming (${upcoming.length})` },
              { key: 'failed',   label: `Fouten (${failed.length})` },
              { key: 'all',      label: `Alles (${items.length})` },
            ] as const).map(f => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={clsx(
                  'px-2.5 py-1 rounded text-[10px] font-medium transition-colors',
                  filter === f.key ? 'bg-indigo-500/20 text-indigo-400' : 'text-white/40 hover:text-white/60'
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
            <span className="text-[11px] text-white/45">Live · 15s</span>
          </div>
        </div>

        {loading ? (
          <p className="text-xs text-white/50 text-center py-8">Laden...</p>
        ) : filtered.length === 0 ? (
          <div className="text-center py-10 space-y-3">
            <Calendar size={28} className="text-white/10 mx-auto" />
            {filter === 'failed' ? (
              <p className="text-xs text-green-400">✓ Geen fouten gevonden</p>
            ) : (
              <>
                <p className="text-xs text-white/50">Geen geplande items</p>
                <div className="flex items-center justify-center gap-3 pt-1">
                  <Link
                    href="/dashboard/youtube"
                    className="text-[11px] text-white/40 hover:text-white/70 transition-colors"
                  >
                    ← YouTube Engine
                  </Link>
                  <Link
                    href="/dashboard/youtube/workflow"
                    className="flex items-center gap-1 text-[11px] text-indigo-400 hover:text-indigo-300 transition-colors"
                  >
                    Start pipeline <ArrowRight size={10} />
                  </Link>
                </div>
              </>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-white/5">
                    <th className="text-left py-2 pr-4 text-white/50 font-medium">Titel</th>
                    <th className="text-left py-2 pr-4 text-white/50 font-medium">Kanaal</th>
                    <th className="text-left py-2 pr-4 text-white/50 font-medium">Gepland</th>
                    <th className="text-left py-2 pr-4 text-white/50 font-medium">Over</th>
                    <th className="text-left py-2 pr-4 text-white/50 font-medium">Status</th>
                    <th className="text-right py-2 text-white/50 font-medium">Acties</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map(item => {
                    const title = item.youtube_videos?.title ?? item.title
                    const isFailed = item.status === 'failed' || item.status === 'manual_review_required'
                    const isLive   = item.status === 'verified_live'
                    const isActive = ['preparing','normalizing','uploading','processing','verifying','uploaded_pending_processing'].includes(item.status)
                    const canCancel = !isLive && !isFailed

                    return (
                      <tr key={item.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] group">
                        <td className="py-2.5 pr-4 max-w-[200px]">
                          <p className="text-white/70 truncate">{title ?? '—'}</p>
                          {item.last_error && (
                            <p className="text-[10px] text-red-400/70 truncate mt-0.5">{item.last_error}</p>
                          )}
                        </td>
                        <td className="py-2.5 pr-4">
                          <div className="flex items-center gap-1.5">
                            <Tv2 size={11} className="text-white/45" />
                            <span className="text-white/50">{item.youtube_channels?.naam ?? '—'}</span>
                          </div>
                        </td>
                        <td className="py-2.5 pr-4 text-white/55 font-mono text-[10px]">
                          {fmt(item.scheduled_publish_at)}
                        </td>
                        <td className={clsx('py-2.5 pr-4 font-medium text-[11px]', new Date(item.scheduled_publish_at) > now ? 'text-indigo-400' : 'text-white/40')}>
                          {timeUntil(item.scheduled_publish_at)}
                        </td>
                        <td className="py-2.5 pr-4">
                          <div className="flex items-center gap-1.5">
                            <span className={clsx('px-2 py-0.5 rounded-full text-[10px] font-medium', STATUS_COLOR[item.status] ?? 'text-white/50 bg-white/5')}>
                              {STATUS_LABEL[item.status] ?? item.status}
                            </span>
                            {item.retry_count > 0 && (
                              <span className="text-[10px] text-amber-400/60">{item.retry_count}×</span>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 text-right">
                          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {isFailed && (
                              <button
                                onClick={() => act('retry', item.id)}
                                disabled={busy[`${item.id}_retry`]}
                                title="Retry"
                                className="p-1.5 rounded hover:bg-indigo-500/20 text-indigo-400/70 hover:text-indigo-400 transition-colors"
                              >
                                <RefreshCw size={11} className={busy[`${item.id}_retry`] ? 'animate-spin' : ''} />
                              </button>
                            )}
                            {(isFailed || isActive) && (
                              <button
                                onClick={() => act('reverify', item.id)}
                                disabled={busy[`${item.id}_reverify`]}
                                title="Reverify"
                                className="p-1.5 rounded hover:bg-amber-500/20 text-amber-400/70 hover:text-amber-400 transition-colors"
                              >
                                <ShieldCheck size={11} />
                              </button>
                            )}
                            {!isLive && (
                              <button
                                onClick={() => act('upload_now', item.id)}
                                disabled={busy[`${item.id}_upload_now`]}
                                title="Upload nu"
                                className="p-1.5 rounded hover:bg-green-500/20 text-green-400/70 hover:text-green-400 transition-colors"
                              >
                                <Zap size={11} className={busy[`${item.id}_upload_now`] ? 'animate-pulse' : ''} />
                              </button>
                            )}
                            {isFailed && (
                              <button
                                onClick={() => act('force_publish', item.id)}
                                disabled={busy[`${item.id}_force_publish`]}
                                title="Force Publish"
                                className="p-1.5 rounded hover:bg-violet-500/20 text-violet-400/60 hover:text-violet-400 transition-colors text-[10px] font-medium"
                              >
                                ✓
                              </button>
                            )}
                            {canCancel && (
                              <button
                                onClick={() => act('cancel', item.id)}
                                disabled={busy[`${item.id}_cancel`]}
                                title="Annuleer"
                                className="p-1.5 rounded hover:bg-red-500/20 text-red-400/50 hover:text-red-400 transition-colors"
                              >
                                <X size={11} />
                              </button>
                            )}
                            {item.youtube_url && (
                              <a
                                href={item.youtube_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1.5 rounded hover:bg-white/10 text-white/40 hover:text-white/70 transition-colors text-[10px]"
                              >
                                ↗
                              </a>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {filtered.length > 50 && (
              <button
                onClick={() => setShowAll(s => !s)}
                className="w-full mt-3 py-2 text-[11px] text-white/50 hover:text-white/60 flex items-center justify-center gap-1 border-t border-white/5 transition-colors"
              >
                {showAll
                  ? <><ChevronUp size={11} /> Minder tonen</>
                  : <><ChevronDown size={11} /> Alle {filtered.length} items tonen</>
                }
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
