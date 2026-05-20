'use client'

import { useState } from 'react'
import clsx from 'clsx'
import { Check, X, Zap } from 'lucide-react'

export type Recommendation = {
  id: string
  action_kind: string
  target_kind: string
  target_id: string | null
  priority: number
  rationale: string | null
  payload: Record<string, unknown> | null
  status: 'pending' | 'approved' | 'dismissed' | 'executed' | 'expired'
  created_at: string
}

const PRIO_COLOR: Record<number, string> = {
  5: 'text-red-300 border-red-400/30 bg-red-500/[0.06]',
  4: 'text-orange-300 border-orange-400/30 bg-orange-500/[0.06]',
  3: 'text-amber-300 border-amber-400/30 bg-amber-500/[0.06]',
  2: 'text-indigo-300 border-indigo-400/30 bg-indigo-500/[0.06]',
  1: 'text-white/50 border-white/10 bg-white/[0.03]',
}

export function RecommendationCard({
  rec,
  onChange,
}: {
  rec: Recommendation
  onChange?: (id: string, newStatus: Recommendation['status']) => void
}) {
  const [busy, setBusy] = useState(false)
  const update = async (status: Recommendation['status']) => {
    setBusy(true)
    const res = await fetch(`/api/executive-layer/recommendations/${rec.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, executed_by: 'orlando' }),
    })
    setBusy(false)
    if (res.ok) onChange?.(rec.id, status)
  }

  const prio = Math.max(1, Math.min(5, rec.priority))
  const isPending = rec.status === 'pending'

  return (
    <div className={clsx('border rounded-xl p-3', PRIO_COLOR[prio])}>
      <div className="flex items-start justify-between gap-3 mb-1.5">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-wide text-white/40 mb-0.5">
            P{prio} · {rec.target_kind} · {rec.action_kind.replace(/_/g, ' ')}
          </div>
          <div className="text-xs text-white/80 line-clamp-3">{rec.rationale ?? '—'}</div>
        </div>
        <div className="text-[10px] text-white/30 shrink-0">{new Date(rec.created_at).toLocaleDateString('nl-NL')}</div>
      </div>

      <div className="flex items-center gap-2">
        {isPending ? (
          <>
            <button
              type="button"
              onClick={() => update('approved')}
              disabled={busy}
              className="flex items-center gap-1 px-2 py-1 rounded text-[11px] bg-emerald-500/10 border border-emerald-400/30 text-emerald-200 hover:bg-emerald-500/20 disabled:opacity-40"
            >
              <Check size={11} /> Approve
            </button>
            <button
              type="button"
              onClick={() => update('dismissed')}
              disabled={busy}
              className="flex items-center gap-1 px-2 py-1 rounded text-[11px] bg-white/[0.04] border border-white/10 text-white/50 hover:bg-white/[0.08] disabled:opacity-40"
            >
              <X size={11} /> Dismiss
            </button>
          </>
        ) : rec.status === 'approved' ? (
          <button
            type="button"
            onClick={() => update('executed')}
            disabled={busy}
            className="flex items-center gap-1 px-2 py-1 rounded text-[11px] bg-violet-500/10 border border-violet-400/30 text-violet-200 hover:bg-violet-500/20 disabled:opacity-40"
          >
            <Zap size={11} /> Mark executed
          </button>
        ) : (
          <span className="text-[10px] uppercase tracking-wide text-white/30">
            {rec.status}
          </span>
        )}
      </div>
    </div>
  )
}
