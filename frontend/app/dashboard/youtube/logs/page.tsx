'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ScrollText, CheckCircle, XCircle, RefreshCw, Clock, ShieldCheck, Zap, X, ExternalLink } from 'lucide-react'
import clsx from 'clsx'

type QueueItem = {
  id: string
  title: string | null
  status: string
  retry_count: number
  last_error: string | null
  created_at: string
  updated_at: string
  channel_id: string
  youtube_video_id: string | null
  youtube_url: string | null
  youtube_channels: { naam: string } | null
}

const STATUS_ICON: Record<string, { icon: typeof CheckCircle; color: string }> = {
  verified_live:             { icon: CheckCircle,  color: 'text-green-400' },
  failed:                    { icon: XCircle,      color: 'text-red-400' },
  manual_review_required:    { icon: XCircle,      color: 'text-red-400' },
  retrying:                  { icon: RefreshCw,    color: 'text-amber-400' },
  queued:                    { icon: Clock,        color: 'text-sky-400' },
  uploading:                 { icon: RefreshCw,    color: 'text-indigo-400' },
  processing:                { icon: RefreshCw,    color: 'text-indigo-400' },
  verifying:                 { icon: RefreshCw,    color: 'text-violet-400' },
}

function fmt(iso: string) {
  return new Date(iso).toLocaleString('nl-NL', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}

export default function LogsPage() {
  const [items, setItems]   = useState<QueueItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'failed' | 'live'>('all')
  const [busy, setBusy]     = useState<Record<string, boolean>>({})

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('youtube_upload_queue')
      .select('id, title, status, retry_count, last_error, created_at, updated_at, channel_id, youtube_video_id, youtube_url, youtube_channels(naam)')
      .order('updated_at', { ascending: false })
      .limit(200)
    setItems((data ?? []) as unknown as QueueItem[])
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

  const filtered = items.filter(i => {
    if (filter === 'failed') return i.status === 'failed' || i.status === 'manual_review_required'
    if (filter === 'live')   return i.status === 'verified_live'
    return true
  })

  return (
    <div className="space-y-4">
      <div className="bg-white/[0.06] border border-white/5 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <ScrollText size={14} className="text-white/65" /> Upload Logs
          </h2>
          <div className="flex items-center gap-2">
            {(['all', 'failed', 'live'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={clsx(
                  'px-2.5 py-1 rounded-md text-[10px] font-medium transition-colors',
                  filter === f ? 'bg-indigo-500/20 text-indigo-400' : 'text-white/50 hover:text-white/60'
                )}
              >
                {f === 'all' ? `Alle (${items.length})` : f === 'failed' ? `Fouten (${items.filter(i => i.status === 'failed' || i.status === 'manual_review_required').length})` : `Live (${items.filter(i => i.status === 'verified_live').length})`}
              </button>
            ))}
            <div className="flex items-center gap-1.5 ml-2">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              <span className="text-[11px] text-white/45">15s</span>
            </div>
          </div>
        </div>

        {loading ? (
          <p className="text-xs text-white/50 text-center py-8">Laden...</p>
        ) : filtered.length === 0 ? (
          <p className="text-xs text-white/50 text-center py-8">Geen logs</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left py-2 w-5"></th>
                  <th className="text-left py-2 pr-4 text-white/50 font-medium">Titel</th>
                  <th className="text-left py-2 pr-4 text-white/50 font-medium">Kanaal</th>
                  <th className="text-left py-2 pr-4 text-white/50 font-medium">Status</th>
                  <th className="text-left py-2 pr-4 text-white/50 font-medium">Fout</th>
                  <th className="text-right py-2 pr-4 text-white/50 font-medium">Pogingen</th>
                  <th className="text-right py-2 pr-4 text-white/50 font-medium">Gewijzigd</th>
                  <th className="text-right py-2 text-white/50 font-medium">Acties</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(item => {
                  const si = STATUS_ICON[item.status]
                  const Icon = si?.icon ?? Clock
                  const isFailed = item.status === 'failed' || item.status === 'manual_review_required'
                  const isLive   = item.status === 'verified_live'
                  const isActive = ['uploading', 'processing', 'verifying', 'normalizing', 'preparing', 'uploaded_pending_processing'].includes(item.status)

                  return (
                    <tr key={item.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] group">
                      <td className="py-2.5 w-5">
                        <Icon size={12} className={clsx(si?.color ?? 'text-white/45', (item.status === 'uploading' || item.status === 'verifying') && 'animate-spin')} />
                      </td>
                      <td className="py-2.5 pr-4 text-white/60 max-w-[180px] truncate">
                        {item.title ?? item.id.slice(0, 8) + '...'}
                      </td>
                      <td className="py-2.5 pr-4 text-white/65">
                        {item.youtube_channels?.naam ?? '—'}
                      </td>
                      <td className="py-2.5 pr-4">
                        <span className={clsx('font-mono text-[10px]', si?.color ?? 'text-white/50')}>
                          {item.status}
                        </span>
                      </td>
                      <td className="py-2.5 pr-4 text-red-400/70 max-w-[160px] truncate">
                        {item.last_error ?? '—'}
                      </td>
                      <td className={clsx('py-2.5 pr-4 text-right font-mono', item.retry_count > 0 ? 'text-amber-400' : 'text-white/38')}>
                        {item.retry_count}
                      </td>
                      <td className="py-2.5 pr-4 text-right text-white/45 font-mono text-[10px]">
                        {fmt(item.updated_at)}
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
                              <RefreshCw size={10} className={busy[`${item.id}_retry`] ? 'animate-spin' : ''} />
                            </button>
                          )}
                          {(isFailed || isActive) && (
                            <button
                              onClick={() => act('reverify', item.id)}
                              disabled={busy[`${item.id}_reverify`]}
                              title="Reverify"
                              className="p-1.5 rounded hover:bg-amber-500/20 text-amber-400/70 hover:text-amber-400 transition-colors"
                            >
                              <ShieldCheck size={10} />
                            </button>
                          )}
                          {isFailed && (
                            <button
                              onClick={() => act('upload_now', item.id)}
                              disabled={busy[`${item.id}_upload_now`]}
                              title="Upload nu"
                              className="p-1.5 rounded hover:bg-green-500/20 text-green-400/70 hover:text-green-400 transition-colors"
                            >
                              <Zap size={10} className={busy[`${item.id}_upload_now`] ? 'animate-pulse' : ''} />
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
                          {!isLive && (
                            <button
                              onClick={() => act('cancel', item.id)}
                              disabled={busy[`${item.id}_cancel`]}
                              title="Annuleer"
                              className="p-1.5 rounded hover:bg-red-500/20 text-red-400/50 hover:text-red-400 transition-colors"
                            >
                              <X size={10} />
                            </button>
                          )}
                          {item.youtube_url && (
                            <a
                              href={item.youtube_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Open YouTube"
                              className="p-1.5 rounded hover:bg-white/10 text-white/40 hover:text-white/70 transition-colors"
                            >
                              <ExternalLink size={10} />
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
        )}
      </div>
    </div>
  )
}
