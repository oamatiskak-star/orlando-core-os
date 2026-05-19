'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Search, ChevronLeft, RefreshCw, ExternalLink, TrendingUp } from 'lucide-react'
import clsx from 'clsx'

type Signal = {
  id: string
  source: string
  keyword: string
  momentum: number
  region: string | null
  raw_payload: Record<string, unknown> | null
  captured_at: string
}

const SOURCE_COLORS: Record<string, string> = {
  reddit:        'bg-orange-500/10 text-orange-300',
  google_trends: 'bg-blue-500/10 text-blue-300',
  news:          'bg-amber-500/10 text-amber-300',
  x:             'bg-white/[0.08] text-white/65',
  tiktok_discover:'bg-pink-500/10 text-pink-300',
  youtube_trending: 'bg-red-500/10 text-red-300',
}

function fmtAge(iso: string): string {
  const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (sec < 60) return `${sec}s`
  if (sec < 3600) return `${Math.floor(sec / 60)}m`
  if (sec < 86400) return `${Math.floor(sec / 3600)}u`
  return `${Math.floor(sec / 86400)}d`
}

export default function TrendScannerPage() {
  const [signals, setSignals] = useState<Signal[]>([])
  const [loading, setLoading] = useState(true)
  const [scanning, setScanning] = useState(false)
  const [scanMsg, setScanMsg] = useState('')
  const [sourceFilter, setSourceFilter] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const url = `/api/media-holding/trend-scanner/signals?limit=200${sourceFilter ? `&source=${sourceFilter}` : ''}`
      const r = await fetch(url)
      if (r.ok) {
        const j = await r.json()
        setSignals(j.signals ?? [])
      }
    } finally { setLoading(false) }
  }, [sourceFilter])

  useEffect(() => { load() }, [load])

  async function startScan(sources: string[]) {
    setScanning(true); setScanMsg('')
    try {
      const r = await fetch('/api/media-holding/trend-scanner/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sources }),
      })
      if (r.ok) {
        const j = await r.json()
        setScanMsg(`Trend scan dispatched — task ${j.task_id?.slice(0, 8)}… (poll na ~30s)`)
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
            <Search size={16} className="text-indigo-400" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-white">Trend Scanner</h1>
            <p className="text-xs text-white/50">Reddit + Google Trends signalen — Vortex breidt zijn radar uit naar bredere viral indicators.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2 text-xs text-white"
          >
            <option value="">Alle bronnen</option>
            <option value="reddit">Reddit</option>
            <option value="google_trends">Google Trends</option>
          </select>
          <button
            onClick={() => startScan(['reddit','google_trends'])}
            disabled={scanning}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-medium px-4 py-2 rounded-lg"
          >
            <RefreshCw size={13} className={scanning ? 'animate-spin' : ''} />
            {scanning ? 'Dispatchen…' : 'Scan alle bronnen'}
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
      ) : signals.length === 0 ? (
        <div className="p-10 text-center bg-white/[0.04] border border-white/5 rounded-xl">
          <TrendingUp size={32} className="mx-auto text-white/30 mb-3" />
          <p className="text-sm text-white/65">Nog geen trend signalen.</p>
          <p className="text-[11px] text-white/40 mt-1">Klik &quot;Scan alle bronnen&quot; om Reddit + Google Trends te scannen.</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {signals.map((s) => {
            const payload = s.raw_payload as Record<string, unknown> | null
            const permalink = payload?.permalink as string | undefined
            const url = payload?.url as string | undefined
            const subreddit = payload?.subreddit as string | undefined

            return (
              <div key={s.id} className="bg-white/[0.06] border border-white/5 rounded-lg px-4 py-3 flex items-start gap-3">
                <span className={clsx('px-2 py-0.5 rounded text-[10px] font-semibold shrink-0', SOURCE_COLORS[s.source] ?? 'bg-white/[0.06] text-white/55')}>
                  {s.source.replace('_', ' ')}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-white/90 line-clamp-2">{s.keyword}</p>
                  <div className="flex items-center gap-3 mt-1 text-[10px] text-white/45">
                    {s.region && <span>{s.region}</span>}
                    {subreddit && <span>r/{subreddit}</span>}
                    <span>momentum: <span className="text-indigo-300 font-semibold">{Number(s.momentum).toLocaleString('nl-NL')}</span></span>
                    <span>{fmtAge(s.captured_at)} geleden</span>
                  </div>
                </div>
                {(permalink || url) && (
                  <a
                    href={permalink ? `https://reddit.com${permalink}` : url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-white/40 hover:text-indigo-300 shrink-0"
                  >
                    <ExternalLink size={13} />
                  </a>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
