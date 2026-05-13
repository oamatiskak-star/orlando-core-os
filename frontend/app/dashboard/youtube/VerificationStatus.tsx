'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import clsx from 'clsx'
import { ShieldCheck, ExternalLink, Clock } from 'lucide-react'

type VerifyItem = {
  id: string
  status: string
  youtube_video_id: string | null
  youtube_url: string | null
  verification_started_at: string | null
  verification_finished_at: string | null
  updated_at: string
  youtube_videos: { title: string } | null
  youtube_channels: { naam: string } | null
}

const STATUS_STEPS = [
  { key: 'queued', label: 'Wachtrij' },
  { key: 'normalizing', label: 'ffmpeg' },
  { key: 'uploading', label: 'Upload' },
  { key: 'uploaded_pending_processing', label: 'Ontvangen' },
  { key: 'processing', label: 'Processing' },
  { key: 'verifying', label: 'Verificatie' },
  { key: 'verified_live', label: 'Live' },
]

const STATUS_INDEX: Record<string, number> = Object.fromEntries(STATUS_STEPS.map((s, i) => [s.key, i]))

function ProgressBar({ status }: { status: string }) {
  const currentIdx = STATUS_INDEX[status] ?? 0
  const totalSteps = STATUS_STEPS.length - 1

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-0.5">
        {STATUS_STEPS.map((step, i) => {
          const done = i < currentIdx
          const active = i === currentIdx
          const failed = status === 'failed' || status === 'manual_review_required'

          return (
            <div key={step.key} className="flex-1 flex flex-col items-center gap-1">
              <div className={clsx('h-1 rounded-full w-full transition-all', {
                'bg-green-500': done,
                'bg-indigo-500 animate-pulse': active && !failed,
                'bg-red-500': active && failed,
                'bg-white/10': !done && !active,
              })} />
            </div>
          )
        })}
      </div>
      <div className="flex items-center justify-between text-[9px] text-white/38">
        <span>{STATUS_STEPS[0].label}</span>
        <span className={clsx(
          status === 'verified_live' ? 'text-green-400' :
          (status === 'failed' || status === 'manual_review_required') ? 'text-red-400' :
          'text-indigo-400'
        )}>
          {STATUS_STEPS[currentIdx]?.label ?? status}
        </span>
        <span>{STATUS_STEPS[STATUS_STEPS.length - 1].label}</span>
      </div>
    </div>
  )
}

export default function VerificationStatus() {
  const [items, setItems] = useState<VerifyItem[]>([])

  useEffect(() => {
    const supabase = createClient()

    async function fetch() {
      const { data } = await supabase
        .from('youtube_upload_queue')
        .select('*, youtube_videos(title), youtube_channels(naam)')
        .not('status', 'in', '("failed","manual_review_required")')
        .order('updated_at', { ascending: false })
        .limit(20)
      setItems((data as VerifyItem[]) ?? [])
    }

    fetch()
    const ch = supabase.channel('yt_verify_live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'youtube_upload_queue' }, fetch)
      .subscribe()

    return () => { supabase.removeChannel(ch) }
  }, [])

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10">
        <ShieldCheck size={20} className="text-white/10 mb-2" />
        <p className="text-xs text-white/45">Geen verificaties actief</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {items.map(item => (
        <div key={item.id} className="bg-white/[0.02] border border-white/5 rounded-lg p-3 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-white/80 truncate font-medium">
                {item.youtube_videos?.title ?? 'Onbekend'}
              </p>
              <p className="text-[10px] text-white/50 mt-0.5">{item.youtube_channels?.naam}</p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0 ml-3">
              <Clock size={10} className="text-white/38" />
              <span className="text-[10px] text-white/38 font-mono">
                {new Date(item.updated_at).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}
              </span>
              {item.youtube_url && (
                <a href={item.youtube_url} target="_blank" rel="noopener noreferrer"
                  className="text-indigo-400/60 hover:text-indigo-400">
                  <ExternalLink size={11} />
                </a>
              )}
            </div>
          </div>
          <ProgressBar status={item.status} />
        </div>
      ))}
    </div>
  )
}
