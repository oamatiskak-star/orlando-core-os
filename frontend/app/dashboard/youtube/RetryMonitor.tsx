'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { retryQueueItem, deleteQueueItem } from './actions'
import { RefreshCw, Trash2, ExternalLink } from 'lucide-react'
import clsx from 'clsx'

type FailedItem = {
  id: string
  status: string
  retry_count: number
  max_retries: number
  last_error: string | null
  youtube_url: string | null
  youtube_video_id: string | null
  updated_at: string
  youtube_videos: { title: string } | null
  youtube_channels: { naam: string } | null
  youtube_upload_failures: Array<{
    id: string
    failure_type: string
    failure_detail: string | null
    recovery_attempted: boolean
    recovery_success: boolean | null
    copyright_status: string | null
  }>
}

const FAILURE_TYPE_LABELS: Record<string, string> = {
  upload_stuck: 'Upload vastgelopen',
  processing_failed: 'Processing mislukt',
  thumbnail_missing: 'Thumbnail ontbreekt',
  scheduled_publish_failed: 'Geplande publicatie mislukt',
  copyright_detected: 'Copyright gedetecteerd',
  browser_check_failed: 'Browser check mislukt',
  ffmpeg_failed: 'ffmpeg mislukt',
  quota_exceeded: 'Quota overschreden',
}

export default function RetryMonitor() {
  const [items, setItems] = useState<FailedItem[]>([])
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()

    async function fetch() {
      const { data } = await supabase
        .from('youtube_upload_queue')
        .select(`
          *,
          youtube_videos(title),
          youtube_channels(naam),
          youtube_upload_failures(id, failure_type, failure_detail, recovery_attempted, recovery_success, copyright_status)
        `)
        .in('status', ['failed', 'manual_review_required'])
        .order('updated_at', { ascending: false })
        .limit(30)
      setItems((data as FailedItem[]) ?? [])
    }

    fetch()
    const ch = supabase.channel('yt_failures_live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'youtube_upload_queue' }, fetch)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [])

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10">
        <p className="text-xs text-white/45">Geen mislukte uploads</p>
        <p className="text-[11px] text-white/50 mt-1">Alles loopt correct</p>
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      {items.map(item => (
        <div key={item.id} className="border border-red-500/10 rounded-lg overflow-hidden">
          <div
            className="flex items-center gap-3 px-4 py-2.5 hover:bg-red-500/[0.02] cursor-pointer transition-colors"
            onClick={() => setExpanded(expanded === item.id ? null : item.id)}
          >
            <span className={clsx(
              'px-2 py-0.5 rounded-full text-[10px] font-medium flex-shrink-0',
              item.status === 'manual_review_required' ? 'bg-amber-500/10 text-amber-400' : 'bg-red-500/10 text-red-400'
            )}>
              {item.status === 'manual_review_required' ? 'Review vereist' : 'Mislukt'}
            </span>
            <span className="text-xs text-white/70 flex-1 truncate">
              {item.youtube_videos?.title ?? 'Onbekend'}
            </span>
            <span className="text-[11px] text-white/38 flex-shrink-0 hidden sm:block">
              {item.youtube_channels?.naam}
            </span>
            <span className="text-[10px] text-amber-400/60">
              {item.retry_count}/{item.max_retries} retries
            </span>
          </div>

          {expanded === item.id && (
            <div className="px-4 pb-3 pt-2 border-t border-white/5 bg-[#07070f] space-y-3">
              {item.last_error && (
                <div className="bg-red-500/10 border border-red-500/20 rounded px-3 py-2">
                  <p className="text-[11px] text-red-400">✗ {item.last_error}</p>
                </div>
              )}

              {item.youtube_upload_failures?.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[10px] text-white/45 uppercase tracking-wider">Failure history</p>
                  {item.youtube_upload_failures.map(f => (
                    <div key={f.id} className="flex items-center gap-2 text-[11px]">
                      <span className="text-white/65">{FAILURE_TYPE_LABELS[f.failure_type] ?? f.failure_type}</span>
                      {f.recovery_attempted && (
                        <span className={clsx('px-1.5 py-0.5 rounded text-[10px]',
                          f.recovery_success ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                        )}>
                          {f.recovery_success ? 'Hersteld' : 'Recovery mislukt'}
                        </span>
                      )}
                      {f.copyright_status && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-red-500/10 text-red-400">
                          {f.copyright_status}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-3 pt-1">
                <button
                  onClick={() => retryQueueItem(item.id)}
                  className="flex items-center gap-1.5 text-[11px] bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg transition-colors"
                >
                  <RefreshCw size={10} /> Opnieuw
                </button>
                {item.youtube_url && (
                  <a href={item.youtube_url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 text-[11px] text-indigo-400/70 hover:text-indigo-400">
                    <ExternalLink size={10} /> YouTube
                  </a>
                )}
                <button
                  onClick={() => deleteQueueItem(item.id)}
                  className="flex items-center gap-1.5 text-[11px] text-red-400/50 hover:text-red-400 transition-colors ml-auto"
                >
                  <Trash2 size={10} /> Verwijder
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
