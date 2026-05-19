'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { TrendingUp, ChevronLeft } from 'lucide-react'
import clsx from 'clsx'

type Channel = {
  id: string
  name: string
  niche: string
  language: string
  persona_owner: string | null
  status: string
  target_views_10d: number
  current_views_10d: number
  launched_at: string | null
}

const STATUSES = ['idea', 'incubating', 'live', 'scaling', 'killed', 'paused'] as const
const STATUS_COLORS: Record<string, string> = {
  idea:        'bg-white/[0.08] text-white/55',
  incubating:  'bg-amber-500/10 text-amber-300',
  live:        'bg-emerald-500/10 text-emerald-300',
  scaling:     'bg-indigo-500/10 text-indigo-300',
  killed:      'bg-red-500/10 text-red-400',
  paused:      'bg-white/[0.06] text-white/40',
}

export default function ChannelIncubatorPage() {
  const [channels, setChannels] = useState<Channel[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/media-holding/channels')
      .then((r) => (r.ok ? r.json() : { channels: [] }))
      .then((j) => { setChannels(j.channels ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/media-holding" className="text-white/40 hover:text-white">
          <ChevronLeft size={16} />
        </Link>
        <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
          <TrendingUp size={16} className="text-indigo-400" />
        </div>
        <div>
          <h1 className="text-base font-semibold text-white">Channel Incubator</h1>
          <p className="text-xs text-white/50">Persona: <span className="text-emerald-300">Nova</span> (supervisor). Niche → channel launch.</p>
        </div>
      </div>

      {loading ? (
        <div className="p-10 text-center text-xs text-white/40">Laden…</div>
      ) : channels.length === 0 ? (
        <div className="p-10 text-center bg-white/[0.04] border border-white/5 rounded-xl">
          <TrendingUp size={32} className="mx-auto text-white/30 mb-3" />
          <p className="text-sm text-white/65">Nog geen kanalen geïncubateerd.</p>
          <p className="text-[11px] text-white/40 mt-1">Channel Incubator agent komt online in Phase 3 — kanalen worden auto-gegenereerd uit hoog-scorende viral_opportunities.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {STATUSES.map((status) => {
            const chs = channels.filter((c) => c.status === status)
            return (
              <div key={status} className="bg-white/[0.04] border border-white/5 rounded-xl p-3 min-h-[200px]">
                <div className="flex items-center justify-between mb-2">
                  <span className={clsx('px-2 py-0.5 rounded-full text-[10px] font-medium', STATUS_COLORS[status])}>
                    {status}
                  </span>
                  <span className="text-[10px] text-white/40">{chs.length}</span>
                </div>
                <div className="space-y-1.5">
                  {chs.map((c) => (
                    <div key={c.id} className="bg-white/[0.06] border border-white/5 rounded-lg p-2">
                      <p className="text-xs text-white/85 font-medium">{c.name}</p>
                      <p className="text-[10px] text-white/45">{c.niche} · {c.language}</p>
                      <p className="text-[10px] text-white/55 mt-1">{c.current_views_10d.toLocaleString('nl-NL')} / {c.target_views_10d.toLocaleString('nl-NL')}</p>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
