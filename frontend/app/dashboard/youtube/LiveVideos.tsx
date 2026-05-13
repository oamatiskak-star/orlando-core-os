'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ExternalLink, TrendingUp } from 'lucide-react'
import clsx from 'clsx'

type LiveVideo = {
  id: string
  youtube_video_id: string | null
  title: string
  privacy_status: string
  scheduled_publish_at: string | null
  viral_score: number | null
  youtube_url: string | null
  updated_at: string
  youtube_channels: { naam: string; handle: string | null } | null
}

function ViralBadge({ score }: { score: number | null }) {
  if (!score) return null
  const cls = score >= 70 ? 'bg-green-500/10 text-green-400' :
               score >= 40 ? 'bg-amber-500/10 text-amber-400' :
               'bg-white/5 text-white/50'
  return (
    <span className={clsx('px-2 py-0.5 rounded-full text-[10px] font-medium flex items-center gap-1', cls)}>
      <TrendingUp size={9} />{score}
    </span>
  )
}

export default function LiveVideos() {
  const [videos, setVideos] = useState<LiveVideo[]>([])

  useEffect(() => {
    const supabase = createClient()

    async function fetch() {
      const { data: queueItems } = await supabase
        .from('youtube_upload_queue')
        .select(`
          youtube_video_id,
          youtube_url,
          verification_finished_at,
          youtube_videos!inner(id, title, privacy_status, scheduled_publish_at, viral_score, updated_at),
          youtube_channels(naam, handle)
        `)
        .eq('status', 'verified_live')
        .order('verification_finished_at', { ascending: false })
        .limit(20)

      if (!queueItems) return

      const mapped = queueItems.map((item) => {
        const vid = item.youtube_videos as unknown as LiveVideo
        return {
          ...vid,
          youtube_video_id: item.youtube_video_id,
          youtube_url: item.youtube_url,
          youtube_channels: item.youtube_channels as unknown as LiveVideo['youtube_channels'],
        }
      })

      setVideos(mapped)
    }

    fetch()
    const interval = setInterval(fetch, 30_000)
    return () => clearInterval(interval)
  }, [])

  if (videos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10">
        <p className="text-xs text-white/45">Nog geen verified live videos</p>
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      {videos.map((video, i) => (
        <div key={`${video.id}-${i}`} className="flex items-center gap-3 px-4 py-2.5 border border-white/5 rounded-lg hover:bg-white/[0.02] transition-colors">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-white/80 truncate">{video.title}</p>
            <p className="text-[10px] text-white/45">{video.youtube_channels?.naam ?? '—'}</p>
          </div>
          <ViralBadge score={video.viral_score} />
          <span className={clsx('px-2 py-0.5 rounded-full text-[10px] font-medium',
            video.privacy_status === 'public' ? 'bg-green-500/10 text-green-400' :
            video.scheduled_publish_at ? 'bg-sky-500/10 text-sky-400' :
            'bg-white/5 text-white/50'
          )}>
            {video.privacy_status === 'public' ? 'Publiek' :
             video.scheduled_publish_at ? 'Gepland' : video.privacy_status}
          </span>
          {video.youtube_url && (
            <a href={video.youtube_url} target="_blank" rel="noopener noreferrer"
              className="text-indigo-400/50 hover:text-indigo-400 transition-colors flex-shrink-0">
              <ExternalLink size={12} />
            </a>
          )}
        </div>
      ))}
    </div>
  )
}
