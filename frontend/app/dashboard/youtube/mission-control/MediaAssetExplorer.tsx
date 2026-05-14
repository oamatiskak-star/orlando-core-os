'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  FileVideo, Download, RefreshCw, ShieldCheck, ScrollText, ExternalLink,
  Image, Subtitles, CheckCircle, AlertCircle, Clock, Loader2, ChevronDown, ChevronRight,
} from 'lucide-react'
import clsx from 'clsx'

type MediaAsset = {
  id: string
  channel_name: string | null
  title: string | null
  topic: string | null
  video_type: string | null
  audio_path: string | null
  video_path: string | null
  thumbnail_path: string | null
  subtitle_path: string | null
  storage_url: string | null
  storage_path: string | null
  local_worker: string | null
  render_status: string
  upload_status: string
  verification_status: string
  file_size_bytes: number | null
  duration_seconds: number | null
  codec: string | null
  render_logs: string[]
  upload_logs: string[]
  youtube_url: string | null
  youtube_video_id: string | null
  queue_id: string | null
  publish_date: string | null
  created_at: string
  updated_at: string
}

const STATUS_ICON: Record<string, React.ElementType> = {
  pending:    Clock,
  rendering:  Loader2,
  uploading:  Loader2,
  verifying:  Loader2,
  complete:   CheckCircle,
  uploaded:   CheckCircle,
  verified:   CheckCircle,
  failed:     AlertCircle,
}

function StatusBadge({ label, status }: { label: string; status: string }) {
  const Icon = STATUS_ICON[status] ?? Clock
  const color = status === 'complete' || status === 'uploaded' || status === 'verified'
    ? 'text-green-400'
    : status === 'failed'
    ? 'text-red-400'
    : status === 'pending'
    ? 'text-white/30'
    : 'text-sky-400'

  return (
    <div className="flex flex-col items-center gap-0.5">
      <Icon size={11} className={clsx(color, (status === 'rendering' || status === 'uploading' || status === 'verifying') && 'animate-spin')} />
      <span className={clsx('text-[9px]', color)}>{label}</span>
    </div>
  )
}

function fmtBytes(b: number | null) {
  if (!b) return '—'
  if (b >= 1e9) return (b / 1e9).toFixed(1) + 'GB'
  if (b >= 1e6) return (b / 1e6).toFixed(1) + 'MB'
  return (b / 1e3).toFixed(0) + 'KB'
}

function fmtDur(s: number | null) {
  if (!s) return '—'
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${String(sec).padStart(2, '0')}`
}

export default function MediaAssetExplorer() {
  const [assets, setAssets]     = useState<MediaAsset[]>([])
  const [expanded, setExpanded] = useState<string | null>(null)
  const [filter, setFilter]     = useState<'all' | 'pending' | 'failed' | 'complete'>('all')

  useEffect(() => {
    const supabase = createClient()

    const fetch = async () => {
      const { data } = await supabase
        .from('generated_media')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100)
      if (data) setAssets(data as MediaAsset[])
    }

    fetch()

    const channel = supabase.channel('generated_media_live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'generated_media' }, fetch)
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  const filtered = assets.filter(a => {
    if (filter === 'all') return true
    if (filter === 'pending') return a.render_status === 'pending' || a.render_status === 'rendering'
    if (filter === 'failed') return a.render_status === 'failed' || a.upload_status === 'failed' || a.verification_status === 'failed'
    if (filter === 'complete') return a.render_status === 'complete' && a.upload_status === 'uploaded' && a.verification_status === 'verified'
    return true
  })

  async function override(action: string, asset: MediaAsset) {
    await fetch('/api/youtube/override', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, video_id: asset.youtube_video_id, queue_id: asset.queue_id }),
    })
  }

  if (!assets.length) {
    return (
      <div className="text-center py-8 text-white/30 text-xs">
        Geen media assets gevonden. Videos verschijnen hier zodra ze gegenereerd worden.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Filter tabs */}
      <div className="flex gap-1">
        {(['all', 'pending', 'failed', 'complete'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={clsx(
              'px-3 py-1 rounded text-[10px] font-medium transition-colors',
              filter === f ? 'bg-white/10 text-white/80' : 'text-white/40 hover:text-white/60'
            )}
          >
            {f === 'all' ? `Alles (${assets.length})` : f === 'pending' ? 'Bezig' : f === 'failed' ? 'Mislukt' : 'Klaar'}
          </button>
        ))}
      </div>

      {/* Asset rows */}
      <div className="space-y-1.5">
        {filtered.map(asset => {
          const isExp = expanded === asset.id

          return (
            <div key={asset.id} className="border border-white/5 rounded-lg overflow-hidden">
              {/* Main row */}
              <div
                className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.02] cursor-pointer transition-colors"
                onClick={() => setExpanded(isExp ? null : asset.id)}
              >
                {isExp
                  ? <ChevronDown size={11} className="text-white/30 flex-shrink-0" />
                  : <ChevronRight size={11} className="text-white/30 flex-shrink-0" />
                }

                {/* Video type badge */}
                <span className={clsx(
                  'text-[9px] px-1.5 py-0.5 rounded font-medium flex-shrink-0',
                  asset.video_type === 'short' ? 'bg-violet-500/15 text-violet-400' : 'bg-sky-500/15 text-sky-400'
                )}>
                  {asset.video_type === 'short' ? 'SHORT' : 'LONG'}
                </span>

                {/* Title */}
                <span className="text-xs text-white/75 flex-1 truncate">
                  {asset.title ?? asset.topic ?? <span className="text-white/30 italic">geen titel</span>}
                </span>

                {/* Channel */}
                <span className="text-[10px] text-white/40 hidden md:block flex-shrink-0">{asset.channel_name}</span>

                {/* Worker */}
                {asset.local_worker && (
                  <span className="text-[10px] text-violet-400/60 flex-shrink-0">{asset.local_worker}</span>
                )}

                {/* Size / duration */}
                <span className="text-[10px] text-white/35 flex-shrink-0 font-mono hidden sm:block">
                  {fmtBytes(asset.file_size_bytes)} · {fmtDur(asset.duration_seconds)}
                </span>

                {/* Pipeline status icons */}
                <div className="flex items-center gap-3 flex-shrink-0">
                  <StatusBadge label="Render"  status={asset.render_status} />
                  <StatusBadge label="Upload"  status={asset.upload_status} />
                  <StatusBadge label="Verify"  status={asset.verification_status} />
                </div>
              </div>

              {/* Expanded detail */}
              {isExp && (
                <div className="px-4 pb-3 pt-2 border-t border-white/5 bg-[#07070f] space-y-3">
                  {/* File paths */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px]">
                    {[
                      { label: 'Video',     path: asset.video_path,     icon: FileVideo },
                      { label: 'Audio',     path: asset.audio_path,     icon: FileVideo },
                      { label: 'Thumbnail', path: asset.thumbnail_path, icon: Image },
                      { label: 'Subtitle',  path: asset.subtitle_path,  icon: Subtitles },
                    ].filter(f => f.path).map(({ label, path, icon: Icon }) => (
                      <div key={label}>
                        <p className="text-white/40 flex items-center gap-1"><Icon size={9} />{label}</p>
                        <p className="text-white/50 font-mono text-[10px] truncate" title={path!}>{path}</p>
                      </div>
                    ))}
                    {asset.storage_url && (
                      <div className="md:col-span-2">
                        <p className="text-white/40">Storage URL</p>
                        <p className="text-white/50 font-mono text-[10px] truncate">{asset.storage_url}</p>
                      </div>
                    )}
                    {asset.codec && (
                      <div>
                        <p className="text-white/40">Codec</p>
                        <p className="text-white/60">{asset.codec}</p>
                      </div>
                    )}
                  </div>

                  {/* Logs */}
                  {(asset.render_logs?.length > 0 || asset.upload_logs?.length > 0) && (
                    <div className="bg-black/30 rounded p-2 space-y-1 max-h-24 overflow-y-auto">
                      {[...(asset.render_logs ?? []), ...(asset.upload_logs ?? [])].slice(-8).map((log, i) => (
                        <p key={i} className="text-[10px] text-white/40 font-mono">{log}</p>
                      ))}
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="flex flex-wrap gap-2">
                    {asset.youtube_url && (
                      <a
                        href={asset.youtube_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-[10px] text-red-400 hover:text-red-300 px-2 py-1 rounded border border-red-500/20 transition-colors"
                      >
                        <ExternalLink size={9} /> Open YouTube
                      </a>
                    )}
                    {asset.youtube_video_id && (
                      <a
                        href={`https://studio.youtube.com/video/${asset.youtube_video_id}/edit`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-[10px] text-sky-400 hover:text-sky-300 px-2 py-1 rounded border border-sky-500/20 transition-colors"
                      >
                        <ExternalLink size={9} /> Studio
                      </a>
                    )}
                    {asset.storage_url && (
                      <a
                        href={asset.storage_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-[10px] text-white/50 hover:text-white/70 px-2 py-1 rounded border border-white/10 transition-colors"
                      >
                        <Download size={9} /> Download MP4
                      </a>
                    )}
                    {asset.upload_status !== 'uploaded' && (
                      <button
                        onClick={() => override('retry', asset)}
                        className="flex items-center gap-1 text-[10px] text-indigo-400 hover:text-indigo-300 px-2 py-1 rounded border border-indigo-500/20 transition-colors"
                      >
                        <RefreshCw size={9} /> Retry Upload
                      </button>
                    )}
                    {asset.upload_status === 'uploaded' && asset.verification_status !== 'verified' && (
                      <button
                        onClick={() => override('reverify', asset)}
                        className="flex items-center gap-1 text-[10px] text-amber-400 hover:text-amber-300 px-2 py-1 rounded border border-amber-500/20 transition-colors"
                      >
                        <ShieldCheck size={9} /> Reverify
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
