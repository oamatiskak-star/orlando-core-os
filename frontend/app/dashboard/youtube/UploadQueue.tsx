'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { retryQueueItem, cancelQueueItem } from './actions'
import clsx from 'clsx'
import { RefreshCw, X, Clock, CheckCircle, AlertCircle, Loader2, Play, Eye } from 'lucide-react'

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
  upload_finished_at: string | null
  verification_finished_at: string | null
  scheduled_publish_at: string | null
  created_at: string
  updated_at: string
  youtube_videos: { title: string; thumbnail_path: string | null } | null
  youtube_channels: { naam: string } | null
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  queued:                       { label: 'Wachtrij',          color: 'bg-white/5 text-white/65',           icon: Clock },
  preparing:                    { label: 'Voorbereiden',       color: 'bg-sky-500/10 text-sky-400',          icon: Loader2 },
  normalizing:                  { label: 'ffmpeg',             color: 'bg-sky-500/10 text-sky-400',          icon: Loader2 },
  uploading:                    { label: 'Uploaden',           color: 'bg-indigo-500/10 text-indigo-400',    icon: Loader2 },
  uploaded_pending_processing:  { label: 'Verwerkt door YT',  color: 'bg-violet-500/10 text-violet-400',    icon: Loader2 },
  processing:                   { label: 'Processing',         color: 'bg-violet-500/10 text-violet-400',    icon: Loader2 },
  verifying:                    { label: 'Verificatie',        color: 'bg-amber-500/10 text-amber-400',      icon: Loader2 },
  verified_live:                { label: 'Live ✓',             color: 'bg-green-500/10 text-green-400',      icon: CheckCircle },
  failed:                       { label: 'Mislukt',            color: 'bg-red-500/10 text-red-400',          icon: AlertCircle },
  retrying:                     { label: 'Opnieuw',            color: 'bg-amber-500/10 text-amber-400',      icon: RefreshCw },
  manual_review_required:       { label: 'Handmatig review',  color: 'bg-red-500/10 text-red-400',          icon: AlertCircle },
}

const ACTIVE_STATUSES = ['preparing', 'normalizing', 'uploading', 'uploaded_pending_processing', 'processing', 'verifying']

export default function UploadQueue() {
  const [items, setItems] = useState<QueueItem[]>([])
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()

    async function fetch() {
      const { data } = await supabase
        .from('youtube_upload_queue')
        .select('*, youtube_videos(title, thumbnail_path), youtube_channels(naam)')
        .not('video_id', 'is', null)
        .not('status', 'in', '("planned","verified_live","failed","manual_review_required")')
        .order('scheduled_publish_at', { ascending: true })
        .limit(50)
      setItems((data as QueueItem[]) ?? [])
    }

    fetch()

    const channel = supabase.channel('yt_queue_live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'youtube_upload_queue' }, fetch)
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Play size={20} className="text-white/50 mb-2" />
        <p className="text-xs text-white/45">Geen actieve uploads</p>
        <p className="text-[11px] text-white/50 mt-1">Voeg een video toe om te starten</p>
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      {items.map(item => {
        const cfg = STATUS_CONFIG[item.status] ?? { label: item.status, color: 'bg-white/5 text-white/50', icon: Clock }
        const Icon = cfg.icon
        const isActive = ACTIVE_STATUSES.includes(item.status)

        return (
          <div key={item.id} className="border border-white/5 rounded-lg overflow-hidden">
            <div
              className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.02] cursor-pointer transition-colors"
              onClick={() => setExpanded(expanded === item.id ? null : item.id)}
            >
              <Icon size={12} className={clsx('flex-shrink-0', isActive && 'animate-spin', cfg.color.split(' ')[1])} />
              <span className={clsx('px-2 py-0.5 rounded-full text-[10px] font-medium flex-shrink-0', cfg.color)}>
                {cfg.label}
              </span>
              <span className="text-xs text-white/70 flex-1 truncate">
                {item.youtube_videos?.title ?? item.title ?? <span className="text-white/30 italic">geen titel</span>}
              </span>
              <span className="text-[11px] text-white/38 flex-shrink-0 hidden sm:block">
                {item.youtube_channels?.naam}
              </span>
              {(item.retry_count ?? 0) > 0 && (
                <span className="text-[10px] text-amber-400/60 flex-shrink-0">
                  {item.retry_count}/{item.max_retries}
                </span>
              )}
              <span className="text-[10px] text-white/38 flex-shrink-0 font-mono">
                {new Date(item.updated_at).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>

            {expanded === item.id && (
              <div className="px-4 pb-3 pt-2 border-t border-white/5 bg-[#07070f] space-y-3">
                <div className="grid grid-cols-2 gap-3 text-[11px]">
                  {item.scheduled_publish_at && (
                    <div>
                      <p className="text-white/45">Gepland</p>
                      <p className="text-white/70">{new Date(item.scheduled_publish_at).toLocaleString('nl-NL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-white/45">Queue ID</p>
                    <p className="text-white/35 font-mono text-[10px]">{item.id.slice(0, 16)}…</p>
                  </div>
                  {item.upload_started_at && (
                    <div>
                      <p className="text-white/45">Upload gestart</p>
                      <p className="text-white/50">{new Date(item.upload_started_at).toLocaleString('nl-NL')}</p>
                    </div>
                  )}
                  {item.youtube_url && (
                    <div className="col-span-2">
                      <p className="text-white/45">YouTube URL</p>
                      <a href={item.youtube_url} target="_blank" rel="noopener noreferrer"
                        className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1 text-[11px]">
                        <Eye size={10} />{item.youtube_url}
                      </a>
                    </div>
                  )}
                  {item.last_error && (
                    <div className="col-span-2 bg-red-500/10 border border-red-500/20 rounded px-3 py-2">
                      <p className="text-red-400 text-[11px]">✗ {item.last_error}</p>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {(item.status === 'failed' || item.status === 'manual_review_required') && (
                    <button
                      onClick={() => retryQueueItem(item.id)}
                      className="flex items-center gap-1 text-[11px] text-indigo-400 hover:text-indigo-300 transition-colors"
                    >
                      <RefreshCw size={10} /> Opnieuw proberen
                    </button>
                  )}
                  {['queued', 'preparing', 'normalizing'].includes(item.status) && (
                    <button
                      onClick={() => cancelQueueItem(item.id)}
                      className="flex items-center gap-1 text-[11px] text-red-400/70 hover:text-red-400 transition-colors"
                    >
                      <X size={10} /> Annuleer
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
