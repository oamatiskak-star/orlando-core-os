'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Users, ChevronLeft, Timer, Activity, BrainCircuit, Radar, RefreshCw } from 'lucide-react'
import clsx from 'clsx'

type Worker = {
  id: string
  name: string
  kind: string
  status: string
  last_seen: string | null
  queue_depth: number
  last_error: string | null
  config: { sweep_interval_min?: number } | null
}

type Cron = { slug: string; last_seen_at: string | null; status: string | null }

// Vercel-cron pipeline: friendly label + rol + max verwachte leeftijd (uur) voor versheid.
const CRON_META: Record<string, { label: string; role: string; icon: 'analyse' | 'scraper' | 'sync'; maxAgeH: number }> = {
  'cron.vercel.run-analyst':          { label: 'Analyse-agent',        role: 'analyse', icon: 'analyse', maxAgeH: 26 },
  'cron.vercel.sync-video-analytics': { label: 'Per-video analytics',  role: 'analyse', icon: 'sync',    maxAgeH: 26 },
  'cron.vercel.sync-stats':           { label: 'Channel-totalen sync', role: 'sync',    icon: 'sync',    maxAgeH: 26 },
  'cron.vercel.viral-scan':           { label: 'Algoritme-scraper',    role: 'scraper', icon: 'scraper', maxAgeH: 7 },
  'cron.vercel.trend-scan':           { label: 'Trend-scanner',        role: 'scraper', icon: 'scraper', maxAgeH: 7 },
}

const STATUS_COLORS: Record<string, string> = {
  idle:    'bg-emerald-500/10 text-emerald-300',
  running: 'bg-amber-500/10 text-amber-300',
  paused:  'bg-white/[0.06] text-white/55',
  offline: 'bg-white/[0.06] text-white/40',
  error:   'bg-red-500/10 text-red-400',
}

function fmtAge(iso: string | null): string {
  if (!iso) return '—'
  const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (sec < 60) return `${sec}s geleden`
  if (sec < 3600) return `${Math.floor(sec / 60)}m geleden`
  return `${Math.floor(sec / 3600)}u geleden`
}

function nextSweepSeconds(w: Worker): number | null {
  const interval = Number(w.config?.sweep_interval_min ?? 0)
  if (!interval || !w.last_seen) return null
  const nextAt = new Date(w.last_seen).getTime() + interval * 60_000
  return Math.max(0, Math.floor((nextAt - Date.now()) / 1000))
}

function fmtCountdown(seconds: number): string {
  if (seconds <= 0) return 'nu'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  if (m === 0) return `${s}s`
  return `${m}m ${s.toString().padStart(2, '0')}s`
}

function CronIcon({ icon }: { icon: 'analyse' | 'scraper' | 'sync' }) {
  if (icon === 'analyse') return <BrainCircuit size={14} className="text-violet-400" />
  if (icon === 'scraper') return <Radar size={14} className="text-sky-400" />
  return <RefreshCw size={14} className="text-emerald-400" />
}

export default function WorkersPage() {
  const [workers, setWorkers] = useState<Worker[]>([])
  const [crons, setCrons] = useState<Cron[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [, setTick] = useState(0)

  function load() {
    return fetch('/api/media-holding/workers')
      .then((r) => (r.ok ? r.json() : { workers: [], crons: [] }))
      .then((j) => { setWorkers(j.workers ?? []); setCrons(j.crons ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  async function act(id: string, action: 'reset' | 'pause' | 'resume') {
    setBusyId(id)
    try {
      await fetch('/api/media-holding/workers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action }),
      })
      await load()
    } finally {
      setBusyId(null)
    }
  }

  // Tick elke seconde voor live countdown
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/media-holding" className="text-white/40 hover:text-white">
          <ChevronLeft size={16} />
        </Link>
        <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
          <Users size={16} className="text-indigo-400" />
        </div>
        <div>
          <h1 className="text-base font-semibold text-white">Workers</h1>
          <p className="text-xs text-white/50">Health en queue depth per Media Holding worker.</p>
        </div>
      </div>

      {/* Cron-pipeline: de echte analyse / scraper / sync jobs met laatste-uitvoering */}
      {!loading && (
        <div className="bg-white/[0.04] border border-white/8 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Activity size={14} className="text-white/50" />
            <h2 className="text-sm font-semibold text-white">Pipeline (Vercel-crons)</h2>
            <span className="text-[11px] text-white/35">analyse · scraper · sync — laatste uitvoering</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {Object.entries(CRON_META).map(([slug, meta]) => {
              const hb = crons.find((c) => c.slug === slug)
              const ageMs = hb?.last_seen_at ? Date.now() - new Date(hb.last_seen_at).getTime() : null
              const fresh = ageMs !== null && ageMs <= meta.maxAgeH * 3_600_000
              const everRan = ageMs !== null
              return (
                <div key={slug} className="flex items-center gap-3 bg-white/[0.03] border border-white/5 rounded-lg px-3 py-2.5">
                  <CronIcon icon={meta.icon} />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-white/85 truncate">{meta.label}</p>
                    <p className="text-[11px] text-white/45">{everRan ? fmtAge(hb!.last_seen_at) : 'nog nooit gedraaid'}</p>
                  </div>
                  <span
                    className={clsx(
                      'shrink-0 w-2 h-2 rounded-full',
                      !everRan ? 'bg-white/25' : fresh ? 'bg-emerald-400' : 'bg-amber-400',
                    )}
                    title={!everRan ? 'nog geen run' : fresh ? 'recent gedraaid' : `>${meta.maxAgeH}u geleden — controleer`}
                  />
                </div>
              )
            })}
          </div>
        </div>
      )}

      {loading ? (
        <div className="p-10 text-center text-xs text-white/40">Laden…</div>
      ) : workers.length === 0 ? (
        <div className="p-10 text-center bg-white/[0.04] border border-white/5 rounded-xl">
          <Users size={32} className="mx-auto text-white/30 mb-3" />
          <p className="text-sm text-white/65">Geen workers geregistreerd.</p>
        </div>
      ) : (
        <div className="bg-white/[0.06] border border-white/5 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                <th className="px-4 py-2.5 text-left text-[10px] font-medium text-white/50 uppercase tracking-wider">Naam</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-medium text-white/50 uppercase tracking-wider">Type</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-medium text-white/50 uppercase tracking-wider">Status</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-medium text-white/50 uppercase tracking-wider">Queue</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-medium text-white/50 uppercase tracking-wider">Laatste activiteit</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-medium text-white/50 uppercase tracking-wider">Laatste fout</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-medium text-white/50 uppercase tracking-wider">Actie</th>
              </tr>
            </thead>
            <tbody>
              {workers.map((w) => {
                const remaining = w.status === 'paused' ? nextSweepSeconds(w) : null
                const showCountdown = remaining !== null
                return (
                  <tr key={w.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                    <td className="px-4 py-3 text-xs text-white/85">{w.name}</td>
                    <td className="px-4 py-3 text-xs text-white/55">{w.kind}</td>
                    <td className="px-4 py-3">
                      {showCountdown ? (
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-indigo-500/10 text-indigo-300 tabular-nums"
                          title={`Sweep elke ${w.config?.sweep_interval_min ?? '?'} min — paused, telt door`}
                        >
                          <Timer size={10} /> {fmtCountdown(remaining ?? 0)}
                        </span>
                      ) : (
                        <span className={clsx('px-2 py-0.5 rounded-full text-[10px] font-medium', STATUS_COLORS[w.status] ?? STATUS_COLORS.offline)}>
                          {w.status}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-white/65">{w.queue_depth}</td>
                    <td className="px-4 py-3 text-xs text-white/55">{fmtAge(w.last_seen)}</td>
                    <td className="px-4 py-3 text-xs text-red-400/80 max-w-[300px] truncate" title={w.last_error ?? ''}>{w.last_error ?? '—'}</td>
                    <td className="px-4 py-3">
                      {w.status === 'error' ? (
                        <button onClick={() => act(w.id, 'reset')} disabled={busyId === w.id}
                          className="text-[11px] px-2 py-1 rounded-md border border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20 disabled:opacity-50 transition-colors">
                          {busyId === w.id ? '…' : 'Reset'}
                        </button>
                      ) : w.status === 'paused' ? (
                        <button onClick={() => act(w.id, 'resume')} disabled={busyId === w.id}
                          className="text-[11px] px-2 py-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-50 transition-colors">
                          {busyId === w.id ? '…' : 'Hervat'}
                        </button>
                      ) : w.status === 'offline' ? (
                        <span className="text-[11px] text-white/25">—</span>
                      ) : (
                        <button onClick={() => act(w.id, 'pause')} disabled={busyId === w.id}
                          className="text-[11px] px-2 py-1 rounded-md border border-white/15 bg-white/5 text-white/55 hover:bg-white/10 disabled:opacity-50 transition-colors">
                          {busyId === w.id ? '…' : 'Pauze'}
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
