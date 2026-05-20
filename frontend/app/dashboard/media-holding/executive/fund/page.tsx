'use client'

import { useEffect, useState, useCallback } from 'react'
import { Wallet, RefreshCw, Sparkles, TrendingUp, TrendingDown } from 'lucide-react'
import { EmptyState } from '@/components/executive/EmptyState'

type Allocation = {
  id: string
  period_start: string
  period_end: string
  channel_id: string | null
  channel_name: string | null
  niche: string | null
  allocated_eur: number
  spent_eur: number
  views_attributed: number
  revenue_attributed: number
  roi_estimate: number
  status: 'proposed' | 'active' | 'closed' | 'overspent'
  rationale: string | null
}

function fmt(n: number): string {
  if (!Number.isFinite(n)) return '0'
  return n.toLocaleString('nl-NL', { maximumFractionDigits: 0 })
}

export default function ContentFundPage() {
  const [allocations, setAllocations] = useState<Allocation[]>([])
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/executive-layer/fund/allocations?limit=100')
    if (res.ok) {
      const j = await res.json()
      setAllocations(j.allocations ?? [])
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const runAgent = async () => {
    setRunning(true)
    try {
      const res = await fetch('/api/executive-layer/agents/run/content_fund_manager', { method: 'POST' })
      if (!res.ok) console.warn('Run failed', await res.json())
      await load()
    } finally {
      setRunning(false)
    }
  }

  const updateAllocation = async (id: string, allocated_eur: number, status?: Allocation['status']) => {
    const res = await fetch(`/api/executive-layer/fund/allocations/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ allocated_eur, status }),
    })
    if (res.ok) await load()
  }

  const totals = allocations.reduce(
    (acc, a) => {
      acc.allocated += Number(a.allocated_eur ?? 0)
      acc.spent += Number(a.spent_eur ?? 0)
      acc.revenue += Number(a.revenue_attributed ?? 0)
      return acc
    },
    { allocated: 0, spent: 0, revenue: 0 }
  )
  const netRoi = totals.spent > 0 ? (totals.revenue - totals.spent) / totals.spent : 0

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-400/30 flex items-center justify-center">
            <Wallet size={16} className="text-emerald-300" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-white/80">Content Fund</h1>
            <p className="text-[11px] text-white/40 mt-0.5">Render-budget allocaties per kanaal · Content Fund Manager elke maandag 09:00</p>
          </div>
        </div>
        <button
          type="button"
          onClick={runAgent}
          disabled={running}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] rounded-lg bg-emerald-500/10 border border-emerald-400/30 text-emerald-200 hover:bg-emerald-500/20 disabled:opacity-40"
        >
          <Sparkles size={11} className={running ? 'animate-spin' : ''} />
          Run Fund Manager
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="bg-white/[0.04] border border-white/5 rounded-xl p-3">
          <div className="text-[10px] uppercase tracking-wide text-white/40 mb-1">Allocated</div>
          <div className="text-lg font-semibold text-white">€{fmt(totals.allocated)}</div>
        </div>
        <div className="bg-white/[0.04] border border-white/5 rounded-xl p-3">
          <div className="text-[10px] uppercase tracking-wide text-white/40 mb-1">Spent</div>
          <div className="text-lg font-semibold text-white/80">€{fmt(totals.spent)}</div>
        </div>
        <div className="bg-white/[0.04] border border-white/5 rounded-xl p-3">
          <div className="text-[10px] uppercase tracking-wide text-white/40 mb-1">Revenue</div>
          <div className="text-lg font-semibold text-emerald-300">€{fmt(totals.revenue)}</div>
        </div>
        <div className="bg-white/[0.04] border border-white/5 rounded-xl p-3">
          <div className="text-[10px] uppercase tracking-wide text-white/40 mb-1">Net ROI</div>
          <div className={`text-lg font-semibold flex items-center gap-1.5 ${netRoi >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
            {netRoi >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
            {(netRoi * 100).toFixed(0)}%
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-xs text-white/40">Allocaties laden…</div>
      ) : allocations.length === 0 ? (
        <EmptyState
          icon={<Wallet size={18} />}
          title="Nog geen allocaties"
          hint="Run Fund Manager om de eerste budget-allocaties te genereren op basis van ROI."
        />
      ) : (
        <div className="overflow-x-auto bg-white/[0.04] border border-white/5 rounded-xl">
          <table className="w-full text-xs">
            <thead className="text-[10px] uppercase tracking-wide text-white/40 border-b border-white/5">
              <tr>
                <th className="text-left px-4 py-2">Period</th>
                <th className="text-left px-4 py-2">Channel</th>
                <th className="text-right px-4 py-2">Allocated</th>
                <th className="text-right px-4 py-2">Spent</th>
                <th className="text-right px-4 py-2">Revenue</th>
                <th className="text-right px-4 py-2">ROI est</th>
                <th className="text-left px-4 py-2">Status</th>
                <th className="text-right px-4 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {allocations.map(a => (
                <tr key={a.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                  <td className="px-4 py-2 text-white/60">{a.period_start} → {a.period_end}</td>
                  <td className="px-4 py-2 text-white/80">{a.channel_name ?? a.niche ?? '—'}</td>
                  <td className="px-4 py-2 text-right tabular-nums">€{fmt(Number(a.allocated_eur))}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-white/60">€{fmt(Number(a.spent_eur))}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-emerald-300">€{fmt(Number(a.revenue_attributed))}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{(Number(a.roi_estimate) * 100).toFixed(0)}%</td>
                  <td className="px-4 py-2 text-white/50 uppercase text-[10px] tracking-wide">{a.status}</td>
                  <td className="px-4 py-2 text-right">
                    {a.status === 'proposed' ? (
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => updateAllocation(a.id, Number(a.allocated_eur) * 1.2, 'active')}
                          className="text-[10px] px-2 py-1 rounded bg-emerald-500/10 border border-emerald-400/30 text-emerald-200 hover:bg-emerald-500/20"
                        >
                          Increase +20%
                        </button>
                        <button
                          type="button"
                          onClick={() => updateAllocation(a.id, Number(a.allocated_eur) * 0.8, 'active')}
                          className="text-[10px] px-2 py-1 rounded bg-white/[0.04] border border-white/10 text-white/50 hover:bg-white/[0.08]"
                        >
                          Reduce −20%
                        </button>
                      </div>
                    ) : null}
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
