'use client'

import { useEffect, useState, useCallback } from 'react'
import { Building2, RefreshCw } from 'lucide-react'
import { StatusBadge } from '@/components/executive/StatusBadge'
import { EmptyState } from '@/components/executive/EmptyState'

type DecisionStatus = 'promising' | 'breakout' | 'scale_ready' | 'saturated' | 'underperforming' | 'terminated'

type ChannelDecision = {
  channel_id: string
  channel_name: string
  niche: string | null
  operational_status: string
  decision: { status: DecisionStatus; confidence: number; decided_at: string; rationale: unknown } | null
  target_views_10d: number
  current_views_10d: number
}

function fmt(n: number): string {
  if (!Number.isFinite(n) || n === 0) return '0'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return n.toLocaleString('nl-NL')
}

export default function ChannelCommandCenter() {
  const [rows, setRows] = useState<ChannelDecision[]>([])
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/executive-layer/decisions?limit=100')
    if (res.ok) {
      const j = await res.json()
      setRows(j.channels ?? [])
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const runEngine = async () => {
    setRunning(true)
    try {
      const res = await fetch('/api/executive-layer/decisions/run', { method: 'POST' })
      if (!res.ok) throw new Error(`Decision engine returned ${res.status}`)
      await load()
    } catch (err) {
      console.error('Decision engine trigger failed', err)
    } finally {
      setRunning(false)
    }
  }

  const counts = rows.reduce<Record<string, number>>((acc, r) => {
    if (!r.decision) return acc
    acc[r.decision.status] = (acc[r.decision.status] ?? 0) + 1
    return acc
  }, {})

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-violet-500/10 border border-violet-400/30 flex items-center justify-center">
            <Building2 size={16} className="text-violet-300" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-white/80">Channel Command Center</h1>
            <p className="text-[11px] text-white/40 mt-0.5">Status-classificatie per kanaal · Decision Engine elk uur</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={runEngine}
            disabled={running}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] rounded-lg bg-violet-500/10 border border-violet-400/20 text-violet-200 hover:bg-violet-500/20 disabled:opacity-40"
          >
            <RefreshCw size={11} className={running ? 'animate-spin' : ''} />
            Run Decision Engine
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {(['breakout','scale_ready','promising','saturated','underperforming','terminated'] as DecisionStatus[]).map(s => (
          <div key={s} className="bg-white/[0.03] border border-white/5 rounded-lg px-3 py-1.5">
            <div className="flex items-center gap-2">
              <StatusBadge status={s} size="xs" />
              <span className="text-xs text-white/60 tabular-nums">{counts[s] ?? 0}</span>
            </div>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="text-xs text-white/40">Kanalen laden…</div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<Building2 size={18} />}
          title="Geen kanalen"
          hint="Voeg eerst kanalen toe via /dashboard/media-holding/channels."
        />
      ) : (
        <div className="overflow-x-auto bg-white/[0.04] rounded-xl border border-white/5">
          <table className="w-full text-xs">
            <thead className="text-[10px] uppercase tracking-wide text-white/40 border-b border-white/5">
              <tr>
                <th className="text-left px-4 py-2">Channel</th>
                <th className="text-left px-4 py-2">Niche</th>
                <th className="text-left px-4 py-2">Decision</th>
                <th className="text-right px-4 py-2">Confidence</th>
                <th className="text-right px-4 py-2">Views 10d</th>
                <th className="text-right px-4 py-2">Target</th>
                <th className="text-left px-4 py-2">Last decided</th>
                <th className="text-left px-4 py-2">Operational</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.channel_id} className="border-b border-white/5 hover:bg-white/[0.02]">
                  <td className="px-4 py-2 text-white/80 font-medium">{r.channel_name}</td>
                  <td className="px-4 py-2 text-white/50">{r.niche ?? '—'}</td>
                  <td className="px-4 py-2"><StatusBadge status={r.decision?.status ?? null} /></td>
                  <td className="px-4 py-2 text-right tabular-nums text-white/60">
                    {r.decision ? `${(r.decision.confidence * 100).toFixed(0)}%` : '—'}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-white/70">{fmt(r.current_views_10d)}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-white/40">{fmt(r.target_views_10d)}</td>
                  <td className="px-4 py-2 text-white/40 text-[11px]">
                    {r.decision ? new Date(r.decision.decided_at).toLocaleString('nl-NL') : '—'}
                  </td>
                  <td className="px-4 py-2 text-white/50 text-[11px] uppercase tracking-wide">{r.operational_status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
