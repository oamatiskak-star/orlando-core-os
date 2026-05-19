'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Music, ChevronLeft, RefreshCw, ExternalLink } from 'lucide-react'
import clsx from 'clsx'

type Track = {
  id: string
  platform: string
  external_audio_id: string
  name: string | null
  artist: string | null
  trend_velocity: number
  use_count: number
  captured_at: string
}

function fmtNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toString()
}

export default function AudioLibraryPage() {
  const [tracks, setTracks] = useState<Track[]>([])
  const [loading, setLoading] = useState(true)
  const [scanning, setScanning] = useState(false)
  const [scanMsg, setScanMsg] = useState('')
  const [minVelocity, setMinVelocity] = useState(0)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch(`/api/media-holding/audio-library?min_velocity=${minVelocity}&limit=200`)
      if (r.ok) {
        const j = await r.json()
        setTracks(j.tracks ?? [])
      }
    } finally { setLoading(false) }
  }, [minVelocity])

  useEffect(() => { load() }, [load])

  async function startScan() {
    setScanning(true); setScanMsg('')
    try {
      const r = await fetch('/api/media-holding/audio-library/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ regions: ['NL','US','GB'], max_per_region: 50 }),
      })
      if (r.ok) {
        const j = await r.json()
        setScanMsg(`Audio scan dispatched — task ${j.task_id?.slice(0, 8)}… (refresh in ~30s)`)
        setTimeout(load, 30_000)
      } else {
        const j = await r.json().catch(() => ({}))
        setScanMsg(`Fout: ${j.error ?? r.status}`)
      }
    } finally { setScanning(false) }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/media-holding" className="text-white/40 hover:text-white">
            <ChevronLeft size={16} />
          </Link>
          <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
            <Music size={16} className="text-indigo-400" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-white">Audio Library</h1>
            <p className="text-xs text-white/50">Trending music op YouTube (categoryId 10) — bron voor Forge audio_prompt suggesties.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={minVelocity}
            onChange={(e) => setMinVelocity(parseInt(e.target.value, 10))}
            className="bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2 text-xs text-white"
          >
            <option value="0">Alle velocities</option>
            <option value="1000">≥ 1K/u</option>
            <option value="10000">≥ 10K/u</option>
            <option value="50000">≥ 50K/u (top tier)</option>
          </select>
          <button
            onClick={startScan}
            disabled={scanning}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-medium px-4 py-2 rounded-lg"
          >
            <RefreshCw size={13} className={scanning ? 'animate-spin' : ''} />
            {scanning ? 'Dispatchen…' : 'Scan YT Music'}
          </button>
        </div>
      </div>

      {scanMsg && (
        <div className="bg-white/[0.04] border border-white/10 rounded-lg px-4 py-2.5 text-[11px] text-white/70">
          {scanMsg}
        </div>
      )}

      {loading ? (
        <div className="p-10 text-center text-xs text-white/40">Laden…</div>
      ) : tracks.length === 0 ? (
        <div className="p-10 text-center bg-white/[0.04] border border-white/5 rounded-xl">
          <Music size={32} className="mx-auto text-white/30 mb-3" />
          <p className="text-sm text-white/65">Audio library is leeg.</p>
          <p className="text-[11px] text-white/40 mt-1">Klik &quot;Scan YT Music&quot; om YouTube Music chart te scannen.</p>
        </div>
      ) : (
        <div className="bg-white/[0.06] border border-white/5 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                <th className="px-4 py-2.5 text-left text-[10px] font-medium text-white/50 uppercase tracking-wider">Velocity</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-medium text-white/50 uppercase tracking-wider">Track</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-medium text-white/50 uppercase tracking-wider">Artist</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-medium text-white/50 uppercase tracking-wider">Views</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-medium text-white/50 uppercase tracking-wider">Platform</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {tracks.map((t) => (
                <tr key={t.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                  <td className="px-4 py-3">
                    <span className={clsx(
                      'px-2 py-0.5 rounded text-[10px] font-semibold',
                      t.trend_velocity >= 50_000 ? 'bg-red-500/10 text-red-300' :
                      t.trend_velocity >= 10_000 ? 'bg-orange-500/10 text-orange-300' :
                      t.trend_velocity >= 1_000 ? 'bg-amber-500/10 text-amber-300' :
                                                  'bg-white/[0.06] text-white/55',
                    )}>
                      {fmtNumber(t.trend_velocity)}/u
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-white/85 max-w-[280px] truncate">{t.name ?? '—'}</td>
                  <td className="px-4 py-3 text-xs text-white/65">{t.artist ?? '—'}</td>
                  <td className="px-4 py-3 text-xs text-white/65">{fmtNumber(Number(t.use_count))}</td>
                  <td className="px-4 py-3 text-[10px] text-white/45 uppercase">{t.platform}</td>
                  <td className="px-4 py-3">
                    {t.platform === 'youtube' && (
                      <a
                        href={`https://www.youtube.com/watch?v=${t.external_audio_id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-indigo-400 hover:text-indigo-300"
                      >
                        <ExternalLink size={13} />
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
