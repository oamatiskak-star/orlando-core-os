'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Clock, Loader2, CheckCircle, AlertCircle, RefreshCw, X, ExternalLink,
  ArrowUp, ArrowDown,
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
  queued:                       { label: 'Wachtrij',    color: 'bg-white/5 text-white/60',          icon: Clock },
  preparing:                    { label: 'Voorbereiden',color: 'bg-sky-500/10 text-sky-400',         icon: Loader2 },
  normalizing:                  { label: 'FFmpeg',      color: 'bg-sky-500/10 text-sky-400',         icon: Loader2 },
  uploading:                    { label: 'Uploaden',    color: 'bg-indigo-500/10 text-indigo-400',   icon: Loader2 },
  uploaded_pending_processing:  { label: 'YT verwerkt', color: 'bg-violet-500/10 text-violet-400',  icon: Loader2 },
  processing:                   { label: 'Processing',  color: 'bg-violet-500/10 text-violet-400',   icon: Loader2 },
  verifying:                    { label: 'Verificatie', color: 'bg-amber-500/10 text-amber-400',     icon: Loader2 },
  verified_live:                { label: 'Live ✓',      color: 'bg-green-500/10 text-green-400',     icon: CheckCircle },
  failed:                       { label: 'Mislukt',     color: 'bg-red-500/10 text-red-400',         icon: AlertCircle },
  retrying:                     { label: 'Opnieuw',     color: 'bg-amber-500/10 text-amber-400',     icon: RefreshCw },
  manual_review_required:       { label: 'Handmatig',   color: 'bg-red-500/10 text-red-400',         icon: AlertCircle },
  paused:                       { label: 'Gepauzeerd',  color: 'bg-amber-500/10 text-amber-400',     icon: Clock },
}

const ACTIVE = ['preparing', 'normalizing', 'uploading', 'uploaded_pending_processing', 'processing', 'verifying']

export default function LiveQueueMonitor() {
  const [items, setItems]   = useState<QueueItem[]>([])
  const [filter, setFilter] = useState<'active' | 'all' | 'failed'>('active')
  const [loading, setLoading] = useState<Record<string, boolean>>({})

  useEffect(() => {
    const supabase = createClient()

    const fetch = async () => {
      const { data } = await supabase
        .from('youtube_upload_queue')
        .select('*, youtube_videos(title, thumbnail_path), youtube_channels(naam)')
        .not('video_id', 'is', null)
        .not('status', 'in', '("planned","verified_live")')
        .order('priority', { ascending: false })
        .order('scheduled_publish_at', { ascending: true })
        .limit(80)
      if (data) setItems(data as QueueItem[])
    }

    fetch()

    const channel = supabase.channel('live_queue_monitor')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'youtube_upload_queue' }, fetch)
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  async function doAction(action: string, item: QueueItem) {
    setLoading(prev => ({ ...prev, [`${item.id}_${action}`]: true }))
    try {
      await fetch('/api/youtube/override', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, queue_id: item.id }),
      })
    } finally {
      setLoading(prev => ({ ...prev, [`${item.id}_${action}`]: false }))
    }
  }

  const filtered = items.filter(i => {
    if (filter === 'active') return ACTIVE.includes(i.status) || i.status === 'queued'
    if (filter === 'failed') return i.status === 'failed' || i.status === 'manual_review_required'
    return true
  })

  const activeCount = items.filter(i => ACTIVE.includes(i.status)).length
  const failedCount = items.filter(i => i.status === 'failed' || i.status === 'manual_review_required').length

  return (
    <div className="space-y-3">
      {/* Filter + summary */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          {([
            { key: 'active', label: `Actief (${activeCount})` },
            { key: 'all',    label: `Alles (${items.length})` },
            { key: 'failed', label: `Fouten (${failedCount})` },
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
        {activeCount > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
            <span className="text-[10px] text-sky-400">{activeCount} uploading</span>
          </div>
        )}
      </div>

      {filtered.length === 0 ? (
        <p className="text-center py-6 text-xs text-white/30">
          {filter === 'active' ? 'Geen actieve uploads' : filter === 'failed' ? 'Geen fouten' : 'Queue leeg'}
        </p>
      ) : (
        <div className="space-y-1">
          {filtered.map(item => {
            const cfg  = STATUS_CFG[item.status] ?? { label: item.status, color: 'bg-white/5 text-white/50', icon: Clock }
            const Icon = cfg.icon
            const isActive = ACTIVE.includes(item.status)

            return (
              <div key={item.id} className="flex items-center gap-3 px-4 py-2 border border-white/5 rounded-lg hover:bg-white/[0.02] group transition-colors">

                <Icon size={11} className={clsx('flex-shrink-0', isActive && 'animate-spin', cfg.color.split(' ')[1])} />

                <span className={clsx('px-2 py-0.5 rounded-full text-[9px] font-medium flex-shrink-0', cfg.color)}>
                  {cfg.label}
                </span>

                {/* Priority indicator */}
                {(item.priority ?? 0) >= 8 && (
                  <ArrowUp size={10} className="text-amber-400 flex-shrink-0" aria-label="Hoge prioriteit" />
                )}

                {/* Title */}
                <span className="text-xs text-white/70 flex-1 truncate">
                  {item.youtube_videos?.title ?? item.title ?? <span className="text-white/30 italic">geen titel</span>}
                </span>

                {/* Channel */}
                <span className="text-[10px] text-white/40 hidden sm:block flex-shrink-0">{item.youtube_channels?.naam}</span>

                {/* Retry count */}
                {(item.retry_count ?? 0) > 0 && (
                  <span className="text-[10px] text-amber-400/60 flex-shrink-0">{item.retry_count}/{item.max_retries}</span>
                )}

                {/* Time */}
                <span className="text-[10px] text-white/35 font-mono flex-shrink-0">
                  {item.scheduled_publish_at
                    ? new Date(item.scheduled_publish_at).toLocaleString('nl-NL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
                    : new Date(item.updated_at).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })
                  }
                </span>

                {/* Action buttons — visible on hover */}
                <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  {(item.status === 'failed' || item.status === 'manual_review_required') && (
                    <button
                      onClick={() => doAction('retry', item)}
                      disabled={loading[`${item.id}_retry`]}
                      title="Retry"
                      className="p-1 rounded hover:bg-indigo-500/20 text-indigo-400/70 hover:text-indigo-400 transition-colors"
                    >
                      <RefreshCw size={10} className={loading[`${item.id}_retry`] ? 'animate-spin' : ''} />
                    </button>
                  )}
                  {item.status === 'uploading' && (
                    <button
                      onClick={() => doAction('reverify', item)}
                      disabled={loading[`${item.id}_reverify`]}
                      title="Reverify"
                      className="p-1 rounded hover:bg-amber-500/20 text-amber-400/70 hover:text-amber-400 transition-colors"
                    >
                      <RefreshCw size={10} />
                    </button>
                  )}
                  {item.youtube_url && (
                    <a
                      href={item.youtube_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1 rounded hover:bg-white/10 text-white/40 hover:text-white/70 transition-colors"
                    >
                      <ExternalLink size={10} />
                    </a>
                  )}
                  <button
                    onClick={() => doAction('cancel', item)}
                    disabled={loading[`${item.id}_cancel`]}
                    title="Annuleer"
                    className="p-1 rounded hover:bg-red-500/20 text-red-400/50 hover:text-red-400 transition-colors"
                  >
                    <X size={10} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
