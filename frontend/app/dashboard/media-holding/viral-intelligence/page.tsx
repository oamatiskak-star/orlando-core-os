'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Radar, RefreshCw, ExternalLink, ChevronLeft } from 'lucide-react'
import clsx from 'clsx'

type Opportunity = {
  id: string
  source_platform: string
  external_id: string
  title: string
  url: string | null
  thumbnail_url: string | null
  channel_name: string | null
  views: number
  view_velocity: number
  virality_score: number
  automation_score: number
  saturation_score: number
  revenue_potential: number
  captured_at: string
}

export default function ViralIntelligencePage() {
  const [items, setItems] = useState<Opportunity[]>([])
  const [loading, setLoading] = useState(true)
  const [scanning, setScanning] = useState(false)
  const [minScore, setMinScore] = useState(0)
  const [scanMsg, setScanMsg] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch(`/api/media-holding/viral-opportunities?min_score=${minScore}&limit=100`)
      if (r.ok) {
        const j = await r.json()
        setItems(j.opportunities ?? [])
      }
    } finally { setLoading(false) }
  }, [minScore])

  useEffect(() => { load() }, [load])

  async function startScan() {
    setScanning(true); setScanMsg('')
    try {
      const r = await fetch('/api/media-holding/viral-opportunities/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ regions: ['NL', 'US', 'GB'], max_per_region: 50 }),
      })
      if (r.ok) {
        const j = await r.json()
        setScanMsg(`Scan dispatched — task ${j.task_id?.slice(0, 8)}…`)
        // Poll na 90s om refresh te doen
        setTimeout(load, 90_000)
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
            <Radar size={16} className="text-indigo-400" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-white">Viral Intelligence Engine</h1>
            <p className="text-xs text-white/50">Persona: <span className="text-indigo-300">Vortex</span> — scant continu YouTube / TikTok / Reels / Reddit / Trends.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={minScore}
            onChange={(e) => setMinScore(parseInt(e.target.value, 10))}
            className="bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2 text-xs text-white"
          >
            <option value="0">Alle scores</option>
            <option value="50">≥ 50</option>
            <option value="70">≥ 70 (kansenradar threshold)</option>
            <option value="85">≥ 85 (top tier)</option>
          </select>
          <button
            onClick={startScan}
            disabled={scanning}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <RefreshCw size={13} className={scanning ? 'animate-spin' : ''} />
            {scanning ? 'Dispatchen…' : 'Start scan'}
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
      ) : items.length === 0 ? (
        <div className="p-10 text-center bg-white/[0.04] border border-white/5 rounded-xl">
          <Radar size={32} className="mx-auto text-white/30 mb-3" />
          <p className="text-sm text-white/65">Geen viral opportunities (nog).</p>
          <p className="text-[11px] text-white/40 mt-1">Klik &apos;Start scan&apos; om de Viral Intelligence Engine te activeren.</p>
        </div>
      ) : (
        <div className="bg-white/[0.06] border border-white/5 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                <th className="px-4 py-2.5 text-left text-[10px] font-medium text-white/50 uppercase tracking-wider">Score</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-medium text-white/50 uppercase tracking-wider">Titel</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-medium text-white/50 uppercase tracking-wider">Kanaal</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-medium text-white/50 uppercase tracking-wider">Views</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-medium text-white/50 uppercase tracking-wider">Velocity</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-medium text-white/50 uppercase tracking-wider">Automation</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-medium text-white/50 uppercase tracking-wider">Revenue / dag</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {items.map((o) => (
                <tr key={o.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                  <td className="px-4 py-3">
                    <span className={clsx(
                      'px-2 py-0.5 rounded-full text-[10px] font-semibold',
                      o.virality_score >= 85 ? 'bg-red-500/10 text-red-400' :
                      o.virality_score >= 70 ? 'bg-orange-500/10 text-orange-400' :
                      o.virality_score >= 50 ? 'bg-amber-500/10 text-amber-400' :
                                                'bg-white/[0.06] text-white/55',
                    )}>
                      {o.virality_score}
                    </span>
                  </td>
                  <td className="px-4 py-3 max-w-[320px]">
                    <span className="text-xs text-white/85">{o.title}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-white/65">{o.channel_name ?? '—'}</td>
                  <td className="px-4 py-3 text-xs text-white/65">{Number(o.views).toLocaleString('nl-NL')}</td>
                  <td className="px-4 py-3 text-xs text-white/65">{Math.round(Number(o.view_velocity)).toLocaleString('nl-NL')}/u</td>
                  <td className="px-4 py-3 text-xs text-white/65">{o.automation_score}</td>
                  <td className="px-4 py-3 text-xs text-white/65">€ {Number(o.revenue_potential).toFixed(2)}</td>
                  <td className="px-4 py-3">
                    {o.url && (
                      <a href={o.url} target="_blank" rel="noreferrer" className="text-indigo-400 hover:text-indigo-300">
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
