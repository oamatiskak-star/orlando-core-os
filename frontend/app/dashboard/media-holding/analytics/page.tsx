'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  BarChart3, ChevronLeft, RefreshCw, Eye, Heart, MessageSquare,
  Share2, DollarSign, TrendingUp, Clock,
} from 'lucide-react'
import clsx from 'clsx'

type Daily = {
  date: string
  views: number; likes: number; comments: number; shares: number; saves: number; revenue: number; samples: number
}

type ChannelRow = {
  channel_id: string
  channel_name: string
  niche: string | null
  language: string | null
  status: string | null
  views: number; likes: number; comments: number; shares: number; saves: number; revenue: number
  retention_pct: number | null
  ctr_pct: number | null
}

type Payload = {
  window_days: number
  totals: { views: number; likes: number; comments: number; shares: number; saves: number; revenue: number }
  today:     { views: number; likes: number; revenue: number; samples: number } | null
  yesterday: { views: number; likes: number; revenue: number; samples: number } | null
  daily: Daily[]
  channels: ChannelRow[]
}

const WINDOWS = [
  { label: '24u', days: 1 },
  { label: '7d',  days: 7 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
] as const

function num(n: number) {
  if (!Number.isFinite(n)) return '0'
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M'
  if (n >= 1_000)     return (n / 1_000).toFixed(1)   + 'K'
  return String(Math.round(n))
}
function money(n: number) {
  return n.toLocaleString('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
}

export default function AnalyticsPage() {
  const [days, setDays]       = useState<number>(7)
  const [data, setData]       = useState<Payload | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const r = await fetch(`/api/media-holding/analytics/daily?days=${days}`)
      const j = await r.json()
      if (!r.ok) throw new Error(j.error ?? `${r.status}`)
      setData(j as Payload)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Onbekende fout')
    } finally {
      setLoading(false)
    }
  }, [days])
  useEffect(() => { load() }, [load])

  const max = Math.max(1, ...(data?.daily.map((d) => d.views) ?? [0]))
  const deltaViews = data?.today && data?.yesterday
    ? data.today.views - data.yesterday.views
    : null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/media-holding" className="text-white/40 hover:text-white">
            <ChevronLeft size={16} />
          </Link>
          <div className="w-9 h-9 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
            <BarChart3 size={16} className="text-violet-400" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-white">Analytics Engine</h1>
            <p className="text-xs text-white/50">Views · CTR · retention · revenue per kanaal · {data?.window_days ?? days} dagen</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {WINDOWS.map((w) => (
            <button
              key={w.days}
              onClick={() => setDays(w.days)}
              className={clsx(
                'px-3 py-1.5 rounded-lg text-[11px] font-medium border',
                days === w.days
                  ? 'bg-violet-500/15 text-violet-300 border-violet-500/25'
                  : 'bg-white/[0.04] text-white/60 border-white/10 hover:text-white',
              )}
            >{w.label}</button>
          ))}
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/10 text-[11px] text-white/65 hover:text-white"
          >
            <RefreshCw size={11} className={loading ? 'animate-spin' : ''} /> ververs
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/5 border border-red-500/20 rounded-lg px-4 py-2.5 text-xs text-red-300">{error}</div>
      )}

      {/* KPI grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        <Kpi icon={<Eye size={11} />}        label="Views (window)"   value={num(data?.totals.views ?? 0)} />
        <Kpi icon={<TrendingUp size={11} />} label="Views vandaag"    value={num(data?.today?.views ?? 0)} delta={deltaViews ?? undefined} />
        <Kpi icon={<Heart size={11} />}      label="Likes"            value={num(data?.totals.likes ?? 0)} />
        <Kpi icon={<MessageSquare size={11} />} label="Comments"      value={num(data?.totals.comments ?? 0)} />
        <Kpi icon={<Share2 size={11} />}     label="Shares"           value={num(data?.totals.shares ?? 0)} />
        <Kpi icon={<DollarSign size={11} />} label="Revenue"          value={money(data?.totals.revenue ?? 0)} />
      </div>

      {/* Daily chart */}
      <div className="bg-white/[0.04] border border-white/5 rounded-xl p-4">
        <h3 className="text-xs font-semibold text-white/80 mb-3">Views per dag</h3>
        {!data || data.daily.length === 0 ? (
          <div className="text-center py-10 text-xs text-white/40">
            Nog geen metrics samples in deze periode.
          </div>
        ) : (
          <div className="flex items-end gap-1 h-40">
            {data.daily.map((d) => (
              <div key={d.date} className="flex-1 flex flex-col items-center gap-1 group">
                <div
                  className="w-full rounded-t bg-gradient-to-t from-violet-600/40 to-violet-400/70 hover:from-violet-500/60 hover:to-violet-300/90 transition-colors relative"
                  style={{ height: `${(d.views / max) * 100}%`, minHeight: 2 }}
                >
                  <div className="absolute inset-x-0 -top-7 text-[9px] text-center text-white/65 opacity-0 group-hover:opacity-100 transition-opacity">
                    {num(d.views)}
                  </div>
                </div>
                <span className="text-[9px] text-white/35 tabular-nums">{d.date.slice(5)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Per-channel table */}
      <div className="bg-white/[0.04] border border-white/5 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
          <h3 className="text-xs font-semibold text-white/80">Per kanaal — {data?.window_days ?? days}d</h3>
          <span className="text-[10px] text-white/40">{data?.channels.length ?? 0} kanalen met samples</span>
        </div>
        {!data || data.channels.length === 0 ? (
          <div className="p-10 text-center text-xs text-white/40">
            <Clock size={20} className="mx-auto text-white/25 mb-2" />
            Nog geen per-channel metrics. Analytics worker moet eerst samples ophalen.
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead className="bg-white/[0.02]">
              <tr className="text-[10px] uppercase text-white/40 tracking-wider">
                <th className="text-left px-4 py-2">Kanaal</th>
                <th className="text-right px-2">Views</th>
                <th className="text-right px-2">Likes</th>
                <th className="text-right px-2">Comments</th>
                <th className="text-right px-2">Shares</th>
                <th className="text-right px-2">CTR</th>
                <th className="text-right px-2">Retention</th>
                <th className="text-right px-4">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {data.channels.map((c) => (
                <tr key={c.channel_id} className="border-t border-white/5 hover:bg-white/[0.03]">
                  <td className="px-4 py-2.5">
                    <p className="text-white/90 font-medium">{c.channel_name}</p>
                    <p className="text-[10px] text-white/40">{c.niche ?? '—'} · {(c.language ?? '').toUpperCase()}</p>
                  </td>
                  <td className="px-2 text-right tabular-nums text-white/90">{num(c.views)}</td>
                  <td className="px-2 text-right tabular-nums text-white/75">{num(c.likes)}</td>
                  <td className="px-2 text-right tabular-nums text-white/75">{num(c.comments)}</td>
                  <td className="px-2 text-right tabular-nums text-white/75">{num(c.shares)}</td>
                  <td className="px-2 text-right tabular-nums text-white/85">{c.ctr_pct       != null ? `${c.ctr_pct.toFixed(1)}%`       : '—'}</td>
                  <td className="px-2 text-right tabular-nums text-white/85">{c.retention_pct != null ? `${c.retention_pct.toFixed(1)}%` : '—'}</td>
                  <td className="px-4 text-right tabular-nums text-emerald-300">{money(c.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

function Kpi({ icon, label, value, delta }: { icon: React.ReactNode; label: string; value: string; delta?: number }) {
  return (
    <div className="bg-white/[0.04] border border-white/8 rounded-xl p-3">
      <div className="flex items-center gap-1.5 text-[10px] text-white/40 uppercase tracking-wide mb-1">
        <span className="text-violet-400">{icon}</span>{label}
      </div>
      <p className="text-lg font-semibold text-white tabular-nums">{value}</p>
      {delta !== undefined && Number.isFinite(delta) && (
        <p className={clsx(
          'text-[10px] tabular-nums mt-0.5',
          delta > 0 ? 'text-emerald-400' : delta < 0 ? 'text-red-400' : 'text-white/40',
        )}>
          {delta > 0 ? '+' : ''}{delta.toLocaleString('nl-NL')} vs gisteren
        </p>
      )}
    </div>
  )
}
