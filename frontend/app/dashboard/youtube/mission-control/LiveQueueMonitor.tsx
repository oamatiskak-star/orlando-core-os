'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Clock, Loader2, CheckCircle, AlertCircle, RefreshCw, X, ExternalLink,
  Zap, ShieldCheck, ArrowUp, ChevronDown, ChevronUp,
} from 'lucide-react'
import clsx from 'clsx'

type QueueItem = {
  id: string
  status: string
  title: string | null
  retry_count: number
  max_retries: number
  last_error: string | null
  youtube_url: string | null
  youtube_video_id: string | null
  upload_started_at: string | null
  scheduled_publish_at: string | null
  priority: number | null
  created_at: string
  updated_at: string
  youtube_videos: { title: string | null; thumbnail_path: string | null } | null
  youtube_channels: { naam: string } | null
}

const STATUS_CFG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  queued:                       { label: 'Wachtrij',    color: 'bg-white/5 text-white/60',         icon: Clock },
  preparing:                    { label: 'Voorbereiden',color: 'bg-sky-500/10 text-sky-400',        icon: Loader2 },
  normalizing:                  { label: 'FFmpeg',      color: 'bg-sky-500/10 text-sky-400',        icon: Loader2 },
  uploading:                    { label: 'Uploaden',    color: 'bg-indigo-500/10 text-indigo-400',  icon: Loader2 },
  uploaded_pending_processing:  { label: 'YT verwerkt', color: 'bg-violet-500/10 text-violet-400', icon: Loader2 },
  processing:                   { label: 'Processing',  color: 'bg-violet-500/10 text-violet-400',  icon: Loader2 },
  verifying:                    { label: 'Verificatie', color: 'bg-amber-500/10 text-amber-400',    icon: Loader2 },
  verified_live:                { label: 'Live ✓',      color: 'bg-green-500/10 text-green-400',    icon: CheckCircle },
  failed:                       { label: 'Mislukt',     color: 'bg-red-500/10 text-red-400',        icon: AlertCircle },
  retrying:                     { label: 'Opnieuw',     color: 'bg-amber-500/10 text-amber-400',    icon: RefreshCw },
  manual_review_required:       { label: 'Review',      color: 'bg-red-500/10 text-red-400',        icon: AlertCircle },
  paused:                       { label: 'Gepauzeerd',  color: 'bg-amber-500/10 text-amber-400',    icon: Clock },
}

const ACTIVE = ['preparing', 'normalizing', 'uploading', 'uploaded_pending_processing', 'processing', 'verifying']

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('nl-NL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export default function LiveQueueMonitor() {
  const [items, setItems]     = useState<QueueItem[]>([])
  const [filter, setFilter]   = useState<'active' | 'all' | 'failed'>('all')
  const [loading, setLoading] = useState<Record<string, boolean>>({})
  const [pushing, setPushing] = useState(false)
  const [showAll, setShowAll] = useState(false)

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('youtube_upload_queue')
      .select('*, youtube_videos(title, thumbnail_path), youtube_channels(naam)')
      .not('status', 'in', '("planned","verified_live")')
      .order('priority', { ascending: false })
      .order('scheduled_publish_at', { ascending: true })
      .limit(200)
    if (data) setItems(data as QueueItem[])
  }, [])

  useEffect(() => {
    load()
    const supabase = createClient()
    const ch = supabase.channel('live_queue_monitor')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'youtube_upload_queue' }, load)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [load])

  async function doAction(action: string, item: QueueItem) {
    const key = `${item.id}_${action}`
    setLoading(prev => ({ ...prev, [key]: true }))
    try {
      await fetch('/api/youtube/override', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, queue_id: item.id }),
      })
      await load()
    } finally {
      setLoading(prev => ({ ...prev, [key]: false }))
    }
  }

  async function pushAll() {
    setPushing(true)
    try {
      await fetch('/api/youtube/override', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'push_all' }),
      })
      await load()
    } finally {
      setPushing(false)
    }
  }

  const activeItems = items.filter(i => ACTIVE.includes(i.status))
  const failedItems = items.filter(i => i.status === 'failed' || i.status === 'manual_review_required')
  const queuedItems = items.filter(i => i.status === 'queued' || i.status === 'retrying' || i.status === 'paused')

  const filtered = filter === 'active' ? [...activeItems, ...items.filter(i => i.status === 'queued')]
                 : filter === 'failed' ? failedItems
                 : items

  const visible = showAll ? filtered : filtered.slice(0, 25)

  return (
    <div className="space-y-3">

      {/* Top bar: filters + bulk push */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-1">
          {([
            { key: 'all',    label: `Alles (${items.length})` },
            { key: 'active', label: `Actief (${activeItems.length})` },
            { key: 'failed', label: `Fouten (${failedItems.length})` },
          ] as const).map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={clsx(
                'px-3 py-1 rounded text-[10px] font-medium transition-colors',
                filter === f.key ? 'bg-white/10 text-white/80' : 'text-white/40 hover:text-white/60'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {activeItems.length > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
              <span className="text-[10px] text-sky-400">{activeItems.length} actief</span>
            </div>
          )}
          {(queuedItems.length > 0 || failedItems.length > 0) && (
            <button
              onClick={pushAll}
              disabled={pushing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500/15 border border-green-500/30 text-green-400 text-[10px] font-semibold hover:bg-green-500/25 transition-all disabled:opacity-50"
            >
              <Zap size={10} className={pushing ? 'animate-pulse' : ''} />
              {pushing ? 'Bezig...' : `Push All (${queuedItems.length + failedItems.length})`}
            </button>
          )}
        </div>
      </div>

      {/* Queue table */}
      {filtered.length === 0 ? (
        <p className="text-center py-6 text-xs text-white/30">
          {filter === 'active' ? 'Geen actieve uploads' : filter === 'failed' ? 'Geen fouten' : 'Queue leeg'}
        </p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left py-2 pr-3 text-white/40 font-medium text-[10px]">Status</th>
                  <th className="text-left py-2 pr-3 text-white/40 font-medium text-[10px]">Titel</th>
                  <th className="text-left py-2 pr-3 text-white/40 font-medium text-[10px] hidden sm:table-cell">Kanaal</th>
                  <th className="text-left py-2 pr-3 text-white/40 font-medium text-[10px] hidden md:table-cell">Gepland</th>
                  <th className="text-left py-2 pr-3 text-white/40 font-medium text-[10px]">Pogingen</th>
                  <th className="text-right py-2 text-white/40 font-medium text-[10px]">Acties</th>
                </tr>
              </thead>
              <tbody>
                {visible.map(item => {
                  const cfg    = STATUS_CFG[item.status] ?? { label: item.status, color: 'bg-white/5 text-white/50', icon: Clock }
                  const Icon   = cfg.icon
                  const isActive  = ACTIVE.includes(item.status)
                  const isFailed  = item.status === 'failed' || item.status === 'manual_review_required'
                  const isLive    = item.status === 'verified_live'
                  const isQueued  = item.status === 'queued' || item.status === 'paused' || item.status === 'retrying'
                  const title  = item.youtube_videos?.title ?? item.title

                  return (
                    <tr key={item.id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                      <td className="py-2.5 pr-3">
                        <span className={clsx('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-medium', cfg.color)}>
                          <Icon size={9} className={isActive ? 'animate-spin' : ''} />
                          {cfg.label}
                        </span>
                      </td>
                      <td className="py-2.5 pr-3 max-w-[180px]">
                        <p className="text-white/70 truncate text-[11px]">
                          {(item.priority ?? 0) >= 8 && <ArrowUp size={9} className="text-amber-400 inline mr-0.5" />}
                          {title ?? <span className="text-white/30 italic">geen titel</span>}
                        </p>
                        {item.last_error && (
                          <p className="text-[9px] text-red-400/70 truncate mt-0.5">{item.last_error}</p>
                        )}
                      </td>
                      <td className="py-2.5 pr-3 text-white/45 text-[10px] hidden sm:table-cell">
                        {item.youtube_channels?.naam ?? '—'}
                      </td>
                      <td className="py-2.5 pr-3 text-white/35 font-mono text-[10px] hidden md:table-cell">
                        {item.scheduled_publish_at ? fmtDate(item.scheduled_publish_at) : '—'}
                      </td>
                      <td className="py-2.5 pr-3">
                        {(item.retry_count ?? 0) > 0 ? (
                          <span className="text-[10px] text-amber-400/70">{item.retry_count}/{item.max_retries}</span>
                        ) : (
                          <span className="text-[10px] text-white/25">—</span>
                        )}
                      </td>
                      <td className="py-2.5">
                        <div className="flex items-center justify-end gap-1">
                          {/* Upload Now — for queued / failed / paused */}
                          {!isLive && !isActive && (
                            <button
                              onClick={() => doAction('upload_now', item)}
                              disabled={loading[`${item.id}_upload_now`]}
                              title="Upload nu naar kanaal"
                              className="flex items-center gap-1 px-2 py-1 rounded bg-green-500/15 border border-green-500/25 text-green-400 text-[9px] font-semibold hover:bg-green-500/25 transition-colors disabled:opacity-40"
                            >
                              <Zap size={9} className={loading[`${item.id}_upload_now`] ? 'animate-pulse' : ''} />
                              Push
                            </button>
                          )}
                          {/* Retry — for failed */}
                          {isFailed && (
                            <button
                              onClick={() => doAction('retry', item)}
                              disabled={loading[`${item.id}_retry`]}
                              title="Opnieuw proberen"
                              className="p-1.5 rounded hover:bg-indigo-500/20 text-indigo-400/70 hover:text-indigo-400 transition-colors disabled:opacity-40"
                            >
                              <RefreshCw size={10} className={loading[`${item.id}_retry`] ? 'animate-spin' : ''} />
                            </button>
                          )}
                          {/* Reverify — for active/failed */}
                          {(isFailed || isActive) && (
                            <button
                              onClick={() => doAction('reverify', item)}
                              disabled={loading[`${item.id}_reverify`]}
                              title="Verificatie opnieuw uitvoeren"
                              className="p-1.5 rounded hover:bg-amber-500/20 text-amber-400/70 hover:text-amber-400 transition-colors disabled:opacity-40"
                            >
                              <ShieldCheck size={10} />
                            </button>
                          )}
                          {/* YouTube link */}
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
                          {/* Cancel */}
                          {!isLive && (
                            <button
                              onClick={() => doAction('cancel', item)}
                              disabled={loading[`${item.id}_cancel`]}
                              title="Annuleren"
                              className="p-1.5 rounded hover:bg-red-500/20 text-red-400/40 hover:text-red-400 transition-colors disabled:opacity-40"
                            >
                              <X size={10} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {filtered.length > 25 && (
            <button
              onClick={() => setShowAll(s => !s)}
              className="w-full mt-2 py-2 text-[11px] text-white/50 hover:text-white/60 flex items-center justify-center gap-1 border-t border-white/5 transition-colors"
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
  )
}
