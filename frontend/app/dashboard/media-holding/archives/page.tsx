'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Archive, ChevronLeft, Filter, ExternalLink, RefreshCw,
} from 'lucide-react'
import clsx from 'clsx'

type Channel = { id: string; name: string; niche: string | null; language: string }

type Row = {
  id: string
  reason: string | null
  archived_at: string
  content_id: string | null
  title: string | null
  kind: string | null
  language: string | null
  status: string | null
  output_url: string | null
  published_at: string | null
  channel: Channel | null
}

type Stats = {
  total: number
  by_reason:  { key: string; count: number }[]
  by_kind:    { key: string; count: number }[]
  by_channel: { key: string; count: number }[]
}

const WINDOWS = [
  { label: 'Alles',  iso: '' },
  { label: '7d',     iso: () => isoDaysAgo(7) },
  { label: '30d',    iso: () => isoDaysAgo(30) },
  { label: '90d',    iso: () => isoDaysAgo(90) },
] as const
function isoDaysAgo(n: number) { return new Date(Date.now() - n * 86_400_000).toISOString() }

function rel(ts: string | null) {
  if (!ts) return '—'
  const diff = (Date.now() - new Date(ts).getTime()) / 1000
  if (diff < 3600)  return `${Math.round(diff/60)}m geleden`
  if (diff < 86400) return `${Math.round(diff/3600)}u geleden`
  return `${Math.round(diff/86400)}d geleden`
}

export default function ArchivesPage() {
  const [channels, setChannels]   = useState<Channel[]>([])
  const [channelFilter, setChannelFilter] = useState<string>('')
  const [windowIdx, setWindowIdx] = useState<number>(0)
  const [rows, setRows]           = useState<Row[]>([])
  const [stats, setStats]         = useState<Stats | null>(null)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState('')

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const w = WINDOWS[windowIdx]
      const since = typeof w.iso === 'function' ? w.iso() : ''
      const params = new URLSearchParams()
      if (channelFilter) params.set('channel', channelFilter)
      if (since)         params.set('since', since)
      const r = await fetch(`/api/media-holding/archives?${params.toString()}`)
      const j = await r.json()
      if (!r.ok) throw new Error(j.error ?? `${r.status}`)
      setRows((j.archives ?? []) as Row[])
      setStats(j.stats as Stats)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Onbekende fout')
    } finally {
      setLoading(false)
    }
  }, [channelFilter, windowIdx])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    fetch('/api/media-holding/channels').then(async (r) => {
      if (r.ok) setChannels(((await r.json()).channels ?? []) as Channel[])
    })
  }, [])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/media-holding" className="text-white/40 hover:text-white">
            <ChevronLeft size={16} />
          </Link>
          <div className="w-9 h-9 rounded-xl bg-white/[0.06] border border-white/10 flex items-center justify-center">
            <Archive size={16} className="text-white/70" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-white">Archives</h1>
            <p className="text-xs text-white/50">Gearchiveerde content · audit trail · read-only</p>
          </div>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/10 text-[11px] text-white/65 hover:text-white"
        >
          <RefreshCw size={11} className={loading ? 'animate-spin' : ''} /> ververs
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white/[0.04] border border-white/5 rounded-xl p-3 flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1.5 text-white/55 text-[11px]">
          <Filter size={12} /> Filters:
        </div>
        <select
          value={channelFilter}
          onChange={(e) => setChannelFilter(e.target.value)}
          className="bg-white/[0.06] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white"
        >
          <option value="">Alle kanalen</option>
          {channels.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <div className="flex items-center gap-1">
          {WINDOWS.map((w, i) => (
            <button
              key={w.label}
              onClick={() => setWindowIdx(i)}
              className={clsx(
                'px-3 py-1.5 rounded-lg text-[11px] border',
                windowIdx === i
                  ? 'bg-violet-500/15 text-violet-300 border-violet-500/25'
                  : 'bg-white/[0.04] border-white/10 text-white/55 hover:text-white',
              )}
            >{w.label}</button>
          ))}
        </div>
      </div>

      {error && (
        <div className="bg-red-500/5 border border-red-500/20 rounded-lg px-4 py-2.5 text-xs text-red-300">{error}</div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <StatCard label="Totaal gearchiveerd" value={String(stats?.total ?? 0)} />
        <StatCard label="Reasons" value={String(stats?.by_reason.length ?? 0)} />
        <StatCard label="Kinds" value={String(stats?.by_kind.length ?? 0)} />
        <StatCard label="Kanalen" value={String(stats?.by_channel.length ?? 0)} />
      </div>

      {/* Aggregaten */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <BreakdownCard title="Per reden"   items={stats?.by_reason  ?? []} />
        <BreakdownCard title="Per kind"    items={stats?.by_kind    ?? []} />
        <BreakdownCard title="Per kanaal"  items={stats?.by_channel ?? []} />
      </div>

      {/* Table */}
      <div className="bg-white/[0.04] border border-white/5 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-white/5">
          <h3 className="text-xs font-semibold text-white/85">Archief — recent eerst</h3>
        </div>
        {loading ? (
          <div className="p-10 text-center text-xs text-white/40">Laden…</div>
        ) : rows.length === 0 ? (
          <div className="p-10 text-center text-xs text-white/40">
            Geen gearchiveerde items in dit filter.
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead className="bg-white/[0.02]">
              <tr className="text-[10px] uppercase text-white/40 tracking-wider">
                <th className="text-left px-4 py-2">Titel</th>
                <th className="text-left">Kanaal</th>
                <th className="text-left">Kind</th>
                <th className="text-left">Reden</th>
                <th className="text-left">Gearchiveerd</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-white/5 hover:bg-white/[0.03]">
                  <td className="px-4 py-2.5">
                    <p className="text-white/90 line-clamp-1">{r.title ?? '— zonder titel —'}</p>
                    <p className="text-[10px] text-white/35">{(r.language ?? '').toUpperCase()} · status {r.status ?? '—'}</p>
                  </td>
                  <td className="text-white/75">{r.channel?.name ?? '—'}</td>
                  <td className="text-white/75 capitalize">{r.kind ?? '—'}</td>
                  <td className="text-white/65 max-w-xs line-clamp-1" title={r.reason ?? ''}>{r.reason ?? '—'}</td>
                  <td className="text-white/55 text-[11px]">{rel(r.archived_at)}</td>
                  <td className="px-2 text-right">
                    {r.output_url && (
                      <a href={r.output_url} target="_blank" rel="noreferrer" className="text-white/40 hover:text-violet-300">
                        <ExternalLink size={12} />
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white/[0.04] border border-white/8 rounded-xl p-3.5">
      <p className="text-[10px] text-white/40 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-xl font-semibold tabular-nums text-white">{value}</p>
    </div>
  )
}

function BreakdownCard({ title, items }: { title: string; items: { key: string; count: number }[] }) {
  const max = Math.max(1, ...items.map((i) => i.count))
  return (
    <div className="bg-white/[0.04] border border-white/5 rounded-xl p-4">
      <h3 className="text-xs font-semibold text-white/85 mb-3">{title}</h3>
      {items.length === 0 ? (
        <p className="text-[11px] text-white/40">Geen data.</p>
      ) : (
        <ul className="space-y-2">
          {items.slice(0, 8).map((it) => (
            <li key={it.key}>
              <div className="flex items-center justify-between text-[11px] text-white/75 mb-1">
                <span className="truncate">{it.key}</span>
                <span className="tabular-nums text-white/55 ml-2">{it.count}</span>
              </div>
              <div className="h-1 bg-white/[0.06] rounded-full overflow-hidden">
                <div className="h-full bg-violet-500/60 rounded-full" style={{ width: `${(it.count / max) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
