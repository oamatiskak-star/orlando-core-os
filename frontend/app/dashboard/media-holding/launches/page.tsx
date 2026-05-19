'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Rocket, ChevronLeft, Trophy, CheckCircle2, Clock, AlertTriangle, Play, ArrowRight } from 'lucide-react'
import clsx from 'clsx'

type Step = {
  id: string
  plan_id: string
  step_order: number
  step_key: string
  step_label: string
  owner_persona: string | null
  status: 'pending' | 'in_progress' | 'completed' | 'blocked' | 'skipped'
  started_at: string | null
  completed_at: string | null
  blocker_reason: string | null
}

type Plan = {
  id: string
  project_name: string
  niche: string | null
  status: 'planned' | 'launching' | 'live' | 'paused' | 'killed'
  channel_id: string | null
  channel: { id: string; name: string | null; niche: string | null; status: string | null } | null
  osil: { id: string; title: string | null; ai_score: number | null; potential_value: number | null } | null
  started_at: string | null
  created_at: string
  steps: Step[]
  progress: { total: number; completed: number; in_progress: number; blocked: number }
}

type Ranked = {
  id: string
  title: string
  composite: number
  ai_score: number
  potential_value: number
  probability_pct: number
  rank?: number
  promoted?: boolean
}

const STATUS_COLOR: Record<string, string> = {
  pending:     'bg-white/[0.06] text-white/45',
  in_progress: 'bg-amber-500/15 text-amber-300',
  completed:   'bg-emerald-500/15 text-emerald-300',
  blocked:     'bg-red-500/15 text-red-400',
  skipped:     'bg-white/[0.04] text-white/30',
}

const PLAN_STATUS_COLOR: Record<string, string> = {
  planned:   'bg-white/[0.06] text-white/55',
  launching: 'bg-violet-500/15 text-violet-300',
  live:      'bg-emerald-500/15 text-emerald-300',
  paused:    'bg-amber-500/15 text-amber-300',
  killed:    'bg-red-500/15 text-red-400',
}

const PERSONA_COLOR: Record<string, string> = {
  Atlas:  'text-blue-300',
  Forge:  'text-pink-300',
  Vortex: 'text-violet-300',
  Nova:   'text-amber-300',
}

export default function LaunchesPage() {
  const [plans, setPlans] = useState<Plan[]>([])
  const [ranked, setRanked] = useState<Ranked[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [pRes, rRes] = await Promise.all([
        fetch('/api/media-holding/launches/plans'),
        fetch('/api/media-holding/launches/rank'),
      ])
      if (pRes.ok) {
        const j = await pRes.json()
        setPlans(j.plans ?? [])
      }
      if (rRes.ok) {
        const j = await rRes.json()
        setRanked(j.ranked ?? [])
      }
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  async function evaluate(topN = 1) {
    setBusy(true); setMsg('')
    try {
      const r = await fetch('/api/media-holding/launches/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ top_n: topN, min_score: 60 }),
      })
      if (r.ok) {
        const j = await r.json()
        const promoted = (j.promoted ?? []).length
        setMsg(promoted > 0
          ? `${promoted} kans${promoted > 1 ? 'en' : ''} gepromoveerd naar gewonnen.`
          : 'Geen kansen die boven minimum score (60) uitkomen.')
        await load()
      } else {
        const j = await r.json().catch(() => ({}))
        setMsg(`Fout: ${j.error ?? r.status}`)
      }
    } finally { setBusy(false) }
  }

  async function updateStep(stepId: string, status: Step['status']) {
    await fetch(`/api/media-holding/launches/steps/${stepId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    await load()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/media-holding" className="text-white/40 hover:text-white">
          <ChevronLeft size={16} />
        </Link>
        <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
          <Rocket size={16} className="text-emerald-400" />
        </div>
        <div className="flex-1">
          <h1 className="text-base font-semibold text-white">Channel Launches</h1>
          <p className="text-xs text-white/50">{plans.length} launches · {plans.filter(p => p.status === 'live').length} live · evaluate actief om winnaars te promoten</p>
        </div>
      </div>

      {/* Actief ranking — kandidaten voor gewonnen */}
      {ranked.length > 0 && (
        <div className="bg-white/[0.04] border border-white/8 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[10px] font-semibold text-white/40 uppercase tracking-wider flex items-center gap-2">
              <Trophy size={11} className="text-amber-400" /> Actief — kandidaten voor gewonnen
            </h2>
            <div className="flex gap-2">
              <button
                onClick={() => evaluate(1)}
                disabled={busy}
                className="flex items-center gap-1 bg-emerald-500/20 border border-emerald-500/30 hover:bg-emerald-500/30 disabled:opacity-50 text-emerald-300 text-[11px] font-medium px-2.5 py-1.5 rounded-lg"
              >
                <Trophy size={11} /> Promote #1
              </button>
              <button
                onClick={() => evaluate(3)}
                disabled={busy}
                className="flex items-center gap-1 bg-violet-500/20 border border-violet-500/30 hover:bg-violet-500/30 disabled:opacity-50 text-violet-300 text-[11px] font-medium px-2.5 py-1.5 rounded-lg"
              >
                <Trophy size={11} /> Promote top 3
              </button>
            </div>
          </div>
          <div className="space-y-1">
            {ranked.map((r) => (
              <div key={r.id} className="flex items-center gap-3 px-3 py-2 bg-white/[0.04] rounded-lg">
                <span className={clsx('text-[10px] font-bold w-6 tabular-nums', r.rank === 1 ? 'text-amber-300' : 'text-white/40')}>
                  #{r.rank ?? '-'}
                </span>
                <span className="text-sm text-white/85 flex-1 truncate">{r.title}</span>
                <span className="text-[10px] text-white/45 tabular-nums">AI {r.ai_score}</span>
                <span className="text-[10px] text-white/45 tabular-nums">€{Number(r.potential_value).toFixed(0)}</span>
                <span className="text-[11px] font-bold text-emerald-300 tabular-nums w-12 text-right">{Number(r.composite).toFixed(1)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {msg && (
        <div className="bg-white/[0.04] border border-white/10 rounded-lg px-4 py-2.5 text-[11px] text-white/70">
          {msg}
        </div>
      )}

      {/* Launch plans grid */}
      {loading ? (
        <div className="p-10 text-center text-xs text-white/40">Laden…</div>
      ) : plans.length === 0 ? (
        <div className="p-10 text-center bg-white/[0.04] border border-white/5 rounded-xl">
          <Rocket size={32} className="mx-auto text-white/30 mb-3" />
          <p className="text-sm text-white/65">Nog geen launch plans.</p>
          <p className="text-[11px] text-white/40 mt-1">Promote een actief kans hierboven om een launch plan te genereren.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {plans.map((plan) => {
            const pct = plan.progress.total ? Math.round((plan.progress.completed / plan.progress.total) * 100) : 0
            return (
              <div key={plan.id} className="bg-white/[0.04] border border-white/8 rounded-xl p-4">
                <div className="flex items-start gap-3 mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={clsx('text-[10px] font-bold px-1.5 py-0.5 rounded uppercase', PLAN_STATUS_COLOR[plan.status])}>{plan.status}</span>
                      {plan.niche && <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-300">{plan.niche}</span>}
                      {plan.osil?.ai_score && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300">AI {plan.osil.ai_score}</span>}
                    </div>
                    <p className="text-sm font-semibold text-white line-clamp-1">{plan.project_name}</p>
                    <p className="text-[10px] text-white/40 mt-0.5">
                      {plan.progress.completed}/{plan.progress.total} steps · {plan.progress.in_progress} in progress · {plan.progress.blocked} blocked
                    </p>
                  </div>
                  <div className="shrink-0 w-28">
                    <div className="w-full h-1.5 bg-white/[0.07] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${pct}%`, background: 'linear-gradient(to right, #34d399, #10b981)' }}
                      />
                    </div>
                    <p className="text-[10px] text-white/40 mt-1 text-right tabular-nums">{pct}%</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-1.5">
                  {plan.steps.map((step) => (
                    <button
                      key={step.id}
                      onClick={() => {
                        const next: Step['status'] =
                          step.status === 'pending'     ? 'in_progress' :
                          step.status === 'in_progress' ? 'completed'   :
                          step.status === 'completed'   ? 'pending'     :
                          step.status === 'blocked'     ? 'pending'     :
                          'pending'
                        updateStep(step.id, next)
                      }}
                      className={clsx(
                        'group text-left p-2 rounded-lg border transition-all',
                        step.status === 'completed' ? 'bg-emerald-500/[0.05] border-emerald-500/20' :
                        step.status === 'in_progress' ? 'bg-amber-500/[0.06] border-amber-500/25' :
                        step.status === 'blocked' ? 'bg-red-500/[0.06] border-red-500/25' :
                        'bg-white/[0.03] border-white/8 hover:border-white/15'
                      )}
                    >
                      <div className="flex items-center gap-1.5 mb-1">
                        {step.status === 'completed' && <CheckCircle2 size={11} className="text-emerald-300" />}
                        {step.status === 'in_progress' && <Clock size={11} className="text-amber-300" />}
                        {step.status === 'blocked' && <AlertTriangle size={11} className="text-red-400" />}
                        {step.status === 'pending' && <span className="w-2.5 h-2.5 rounded-full border border-white/30 inline-block" />}
                        <span className="text-[10px] text-white/30 tabular-nums">{step.step_order}</span>
                      </div>
                      <p className="text-[11px] font-medium text-white/85 line-clamp-1">{step.step_label}</p>
                      {step.owner_persona && (
                        <p className={clsx('text-[10px] mt-0.5', PERSONA_COLOR[step.owner_persona] ?? 'text-white/40')}>
                          {step.owner_persona}
                        </p>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
