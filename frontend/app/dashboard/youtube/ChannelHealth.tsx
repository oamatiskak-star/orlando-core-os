'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import clsx from 'clsx'
import { CheckCircle, AlertCircle, Pause, Play, Link, ExternalLink, RefreshCw } from 'lucide-react'
import NextLink from 'next/link'

type Channel = {
  id: string
  naam: string
  handle: string | null
  channel_id: string
  status: string
  oauth_status: string
  access_token: string | null
  _scheduled?: number
}

const CHANNEL_COLORS: Record<string, string> = {
  VermogenTv:        '#6366f1',
  VastgoedTv:        '#0ea5e9',
  SpaarTv:           '#10b981',
  CryptoVermogen:    '#f59e0b',
  BeleggingsTv:      '#8b5cf6',
  PropertyInvestorTv:'#ec4899',
}

export default function ChannelHealth() {
  const [channels, setChannels] = useState<Channel[]>([])
  const [dbError, setDbError]   = useState<string | null>(null)
  const [busy, setBusy]         = useState<Record<string, boolean>>({})

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data: chs, error } = await supabase
      .from('youtube_channels')
      .select('id, naam, handle, channel_id, status, oauth_status, access_token')
      .order('naam', { ascending: true })

    if (error) { setDbError(error.message); return }
    if (!chs) return

    const enriched = await Promise.all(chs.map(async (ch) => {
      const { count } = await supabase
        .from('youtube_upload_queue')
        .select('id', { count: 'exact', head: true })
        .eq('channel_id', ch.id)
        .not('scheduled_publish_at', 'is', null)
        .gt('scheduled_publish_at', new Date().toISOString())

      return { ...ch, _scheduled: count ?? 0 }
    }))

    setChannels(enriched)
  }, [])

  useEffect(() => {
    load()
    const timer = setInterval(load, 60_000)
    return () => clearInterval(timer)
  }, [load])

  async function act(action: string, channelId: string) {
    setBusy(b => ({ ...b, [`${channelId}_${action}`]: true }))
    await fetch('/api/youtube/override', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, channel_id: channelId }),
    })
    await load()
    setBusy(b => ({ ...b, [`${channelId}_${action}`]: false }))
  }

  if (dbError) return (
    <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
      Supabase fout: {dbError}
    </div>
  )

  if (channels.length === 0) return (
    <div className="text-xs text-white/45 text-center py-6">Kanalen laden…</div>
  )

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6 gap-3">
      {channels.map(ch => {
        const color = CHANNEL_COLORS[ch.naam] ?? '#6366f1'
        const hasError = ch.status === 'error' || ch.oauth_status === 'expired'
        const isPaused = ch.status === 'paused'
        const isActive = !hasError && !isPaused && ch.oauth_status === 'connected'
        const noPlanning = (ch._scheduled ?? 0) === 0

        return (
          <div key={ch.id} className={clsx('bg-white/[0.06] border rounded-xl p-4 space-y-3', noPlanning ? 'border-red-500/30' : 'border-white/5')}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                <NextLink
                  href={`/dashboard/youtube/channel/${ch.id}`}
                  className="text-xs font-semibold text-white truncate hover:text-indigo-300 transition-colors flex items-center gap-1"
                >
                  {ch.naam}<ExternalLink size={9} className="text-white/38 flex-shrink-0" />
                </NextLink>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {noPlanning && <span className="text-[9px] font-bold text-red-400 bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 rounded-full">0 gepland</span>}
                {isActive ? (
                  <CheckCircle size={13} className="text-green-400" />
                ) : isPaused ? (
                  <Pause size={13} className="text-amber-400" />
                ) : (
                  <AlertCircle size={13} className="text-red-400" />
                )}
              </div>
            </div>

            {ch.handle && (
              <p className="text-[10px] text-white/45 font-mono truncate">{ch.handle}</p>
            )}

            <div className="flex items-center gap-1.5 flex-wrap">
              <span className={clsx('text-[10px] px-2 py-0.5 rounded-full border font-medium',
                (ch._scheduled ?? 0) > 0
                  ? 'bg-violet-500/10 border-violet-500/20 text-violet-400'
                  : 'bg-red-500/10 border-red-500/20 text-red-400'
              )}>
                {ch._scheduled ?? 0} gepland
              </span>
            </div>

            {ch.oauth_status === 'connected' && ch.access_token ? (
              <p className="text-[10px] text-green-400/70 text-center">✓ OAuth verbonden</p>
            ) : (
              <a
                href={`/api/youtube/oauth/connect?channel_uuid=${ch.id}`}
                className={clsx(
                  'flex items-center gap-1.5 w-full justify-center px-2 py-1.5 rounded-lg text-[10px] font-medium transition-colors',
                  ch.oauth_status === 'revoked'
                    ? 'bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20'
                    : 'bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/20'
                )}
              >
                <Link size={10} />
                {ch.oauth_status === 'revoked' ? 'Opnieuw verbinden' : ch.oauth_status === 'expired' ? 'Token verlopen — verbinden' : 'Verbinden via OAuth'}
              </a>
            )}

            {/* Control buttons */}
            <div className="flex items-center gap-1.5 pt-0.5">
              {isPaused ? (
                <button
                  onClick={() => act('resume_channel', ch.id)}
                  disabled={busy[`${ch.id}_resume_channel`]}
                  className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-[10px] font-medium hover:bg-green-500/20 transition-colors disabled:opacity-40"
                >
                  <Play size={9} className={busy[`${ch.id}_resume_channel`] ? 'animate-pulse' : ''} />
                  Hervatten
                </button>
              ) : (
                <button
                  onClick={() => act('pause_channel', ch.id)}
                  disabled={busy[`${ch.id}_pause_channel`]}
                  className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-medium hover:bg-amber-500/20 transition-colors disabled:opacity-40"
                >
                  <Pause size={9} className={busy[`${ch.id}_pause_channel`] ? 'animate-pulse' : ''} />
                  Pauzeren
                </button>
              )}
              <button
                onClick={() => act('sync_channel', ch.id)}
                disabled={busy[`${ch.id}_sync_channel`]}
                title="Token vernieuwen & sync"
                className="flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/50 text-[10px] hover:text-white/70 hover:bg-white/[0.08] transition-colors disabled:opacity-40"
              >
                <RefreshCw size={9} className={busy[`${ch.id}_sync_channel`] ? 'animate-spin' : ''} />
                Sync
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
