'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Zap, ChevronLeft, RefreshCw, ExternalLink } from 'lucide-react'
import clsx from 'clsx'

type GravityEvent = {
  id: string
  event_type: string
  magnitude: number
  notes: string | null
  detected_at: string
}

function parseNotes(notes: string | null): Record<string, string> {
  if (!notes) return {}
  const out: Record<string, string> = {}
  for (const part of notes.split(';')) {
    const eq = part.indexOf('=')
    if (eq > 0) out[part.slice(0, eq).trim()] = part.slice(eq + 1).trim()
  }
  return out
}

function fmtAge(iso: string): string {
  const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (sec < 60) return `${sec}s`
  if (sec < 3600) return `${Math.floor(sec / 60)}m`
  if (sec < 86400) return `${Math.floor(sec / 3600)}u`
  return `${Math.floor(sec / 86400)}d`
}

export default function AlgorithmGravityPage() {
  const [events, setEvents] = useState<GravityEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [scanning, setScanning] = useState(false)
  const [scanMsg, setScanMsg] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/media-holding/algorithm-gravity/events?limit=100')
      if (r.ok) {
        const j = await r.json()
        setEvents(j.events ?? [])
      }
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  async function startScan() {
    setScanning(true); setScanMsg('')
    try {
      const r = await fetch('/api/media-holding/algorithm-gravity/scan', { method: 'POST' })
      if (r.ok) {
        const j = await r.json()
        setScanMsg(`Gravity scan dispatched — task ${j.task_id?.slice(0, 8)}… (refresh in ~30s)`)
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
            <Zap size={16} className="text-indigo-400" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-white">Algorithm Gravity Engine</h1>
            <p className="text-xs text-white/50">Detecteert breakouts in viral_opportunities. Per breakout dispatcht Forge 5 variants (remix / loop / compilation / slowed / multilingual).</p>
          </div>
        </div>
        <button
          onClick={startScan}
          disabled={scanning}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <RefreshCw size={13} className={scanning ? 'animate-spin' : ''} />
          {scanning ? 'Dispatchen…' : 'Start gravity scan'}
        </button>
      </div>

      {scanMsg && (
        <div className="bg-white/[0.04] border border-white/10 rounded-lg px-4 py-2.5 text-[11px] text-white/70">
          {scanMsg}
        </div>
      )}

      {loading ? (
        <div className="p-10 text-center text-xs text-white/40">Laden…</div>
      ) : events.length === 0 ? (
        <div className="p-10 text-center bg-white/[0.04] border border-white/5 rounded-xl">
          <Zap size={32} className="mx-auto text-white/30 mb-3" />
          <p className="text-sm text-white/65">Nog geen breakouts gedetecteerd.</p>
          <p className="text-[11px] text-white/40 mt-1">Gravity heeft minimaal 2 viral-scan snapshots nodig om delta te berekenen. Run viral scan twee keer met &gt;5 min interval, daarna gravity scan.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {events.map((e) => {
            const meta = parseNotes(e.notes)
            const isBreakout = e.event_type === 'breakout'
            return (
              <div
                key={e.id}
                className={clsx(
                  'bg-white/[0.06] border rounded-xl p-4',
                  isBreakout ? 'border-red-500/30' : 'border-white/5'
                )}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={clsx(
                      'px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase',
                      isBreakout ? 'bg-red-500/10 text-red-400' : 'bg-amber-500/10 text-amber-300',
                    )}>{e.event_type}</span>
                    <span className="text-xs text-white/85 font-semibold">+{e.magnitude}% velocity</span>
                    <span className="text-[10px] text-white/40">{fmtAge(e.detected_at)} geleden</span>
                  </div>
                  <span className="text-[10px] text-white/40">{meta.platform ?? '—'}</span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                  <div>
                    <p className="text-[10px] text-white/40 uppercase tracking-wider">Velocity nu</p>
                    <p className="text-white/85">{meta.velocity_now ?? '—'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-white/40 uppercase tracking-wider">Velocity ervoor</p>
                    <p className="text-white/65">{meta.velocity_prev ?? '—'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-white/40 uppercase tracking-wider">Delta</p>
                    <p className="text-red-400 font-semibold">+{meta.delta_pct ?? '—'}%</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-white/40 uppercase tracking-wider">Variants dispatched</p>
                    <p className="text-indigo-300 font-semibold">{meta.variants_dispatched ?? '0'}</p>
                  </div>
                </div>

                {meta.external_id && (
                  <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between">
                    <span className="text-[10px] text-white/40">YouTube ID: <code className="text-white/65">{meta.external_id}</code></span>
                    <a
                      href={`https://www.youtube.com/watch?v=${meta.external_id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 text-[11px] text-indigo-300 hover:text-indigo-200"
                    >
                      Bekijk <ExternalLink size={11} />
                    </a>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
