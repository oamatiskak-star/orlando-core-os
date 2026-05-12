'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import clsx from 'clsx'
import { Tv2, CheckCircle, AlertCircle, Pause, Link, Loader2 } from 'lucide-react'

type Channel = {
  id: string
  naam: string
  handle: string | null
  channel_id: string
  status: string
  upload_quota_used: number
  upload_quota_reset_at: string | null
  access_token: string | null
  _stats?: {
    live: number
    queued: number
    failed: number
  }
}

const CHANNEL_COLORS: Record<string, string> = {
  VermogenTv: '#6366f1',
  VastgoedTv: '#0ea5e9',
  SpaarTv: '#10b981',
  CryptoVermogen: '#f59e0b',
  BeleggingsTv: '#8b5cf6',
}

export default function ChannelHealth() {
  const [channels, setChannels] = useState<Channel[]>([])

  useEffect(() => {
    const supabase = createClient()

    async function fetch() {
      const { data: chs } = await supabase
        .from('youtube_channels')
        .select('*')
        .order('naam', { ascending: true })

      if (!chs) return

      const enriched = await Promise.all(chs.map(async (ch) => {
        const [live, queued, failed] = await Promise.all([
          supabase.from('youtube_upload_queue').select('id', { count: 'exact', head: true })
            .eq('channel_id', ch.id).eq('status', 'verified_live'),
          supabase.from('youtube_upload_queue').select('id', { count: 'exact', head: true })
            .eq('channel_id', ch.id).in('status', ['queued', 'uploading', 'processing', 'verifying']),
          supabase.from('youtube_upload_queue').select('id', { count: 'exact', head: true })
            .eq('channel_id', ch.id).in('status', ['failed', 'manual_review_required']),
        ])
        return {
          ...ch,
          _stats: {
            live: live.count ?? 0,
            queued: queued.count ?? 0,
            failed: failed.count ?? 0,
          },
        }
      }))

      setChannels(enriched)
    }

    fetch()
    const timer = setInterval(fetch, 60_000)
    return () => clearInterval(timer)
  }, [])

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
      {channels.map(ch => {
        const color = CHANNEL_COLORS[ch.naam] ?? '#6366f1'
        const quotaPct = Math.round((ch.upload_quota_used / 6) * 100)
        const hasError = (ch._stats?.failed ?? 0) > 0 || ch.status === 'error'
        const isPaused = ch.status === 'paused'
        const isActive = !hasError && !isPaused

        return (
          <div key={ch.id} className="bg-white/[0.03] border border-white/5 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                <span className="text-xs font-semibold text-white truncate">{ch.naam}</span>
              </div>
              {isActive ? (
                <CheckCircle size={13} className="text-green-400 flex-shrink-0" />
              ) : isPaused ? (
                <Pause size={13} className="text-amber-400 flex-shrink-0" />
              ) : (
                <AlertCircle size={13} className="text-red-400 flex-shrink-0" />
              )}
            </div>

            {ch.handle && (
              <p className="text-[10px] text-white/25 font-mono">{ch.handle}</p>
            )}

            <div className="grid grid-cols-3 gap-1.5 text-center">
              {[
                { label: 'Live', value: ch._stats?.live ?? 0, color: 'text-green-400' },
                { label: 'Queue', value: ch._stats?.queued ?? 0, color: 'text-sky-400' },
                { label: 'Fouten', value: ch._stats?.failed ?? 0, color: (ch._stats?.failed ?? 0) > 0 ? 'text-red-400' : 'text-white/20' },
              ].map(s => (
                <div key={s.label} className="bg-white/[0.03] rounded-lg py-1.5">
                  <p className={clsx('text-sm font-bold', s.color)}>{s.value}</p>
                  <p className="text-[9px] text-white/25">{s.label}</p>
                </div>
              ))}
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between text-[10px] text-white/30">
                <span>Quota ({ch.upload_quota_used}/6)</span>
                <span>{quotaPct}%</span>
              </div>
              <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                <div
                  className={clsx('h-full rounded-full transition-all', quotaPct > 80 ? 'bg-red-500' : quotaPct > 50 ? 'bg-amber-500' : 'bg-green-500')}
                  style={{ width: `${quotaPct}%` }}
                />
              </div>
            </div>

            {!ch.access_token ? (
              <a
                href={`/api/youtube/oauth/connect?channel_uuid=${ch.id}`}
                className="flex items-center gap-1.5 w-full justify-center px-2 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-medium hover:bg-amber-500/20 transition-colors"
              >
                <Link size={10} />
                Verbinden via OAuth
              </a>
            ) : (
              <p className="text-[10px] text-green-400/70 text-center">✓ OAuth verbonden</p>
            )}
          </div>
        )
      })}
    </div>
  )
}
