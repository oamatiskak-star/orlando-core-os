'use client'

import { useEffect, useState } from 'react'
import { Brain, ArrowUpRight, ArrowDownRight, OctagonX, FlaskConical, Copy } from 'lucide-react'

type Rec = {
  id: string; niche: string; category: string | null; action: 'increase'|'reduce'|'stop'|'test'
  recommendation: string; confidence: number; win_rate: number | null; sample_n: number
}
type Pattern = { niche: string; category: string; length_bucket: string; n: number; avg_score?: number; avg_views?: number }
type ReplItem = { job_id: string; status: string; niche: string | null; source_title: string | null }
type Resp = {
  recommendations: Rec[]
  by_action: Record<string, number>
  winners: Pattern[]
  losers: Pattern[]
  replication?: { total: number; planned: number; items: ReplItem[] }
}

const ACTION = {
  increase: { icon: ArrowUpRight,  cls: 'text-emerald-300', label: 'Meer' },
  reduce:   { icon: ArrowDownRight, cls: 'text-amber-300',  label: 'Minder' },
  stop:     { icon: OctagonX,      cls: 'text-red-300',     label: 'Stop' },
  test:     { icon: FlaskConical,  cls: 'text-indigo-300',  label: 'Test' },
} as const

// S2 — Learnings & aanbevelingen. Bron: /api/media-holding/metrics/learning.
export default function LearningRecommendationsCard() {
  const [data, setData] = useState<Resp | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    fetch('/api/media-holding/metrics/learning')
      .then((r) => (r.ok ? r.json() : null))
      .then((d: Resp | null) => { if (alive) setData(d) })
      .catch(() => { if (alive) setData(null) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])

  const recs = data?.recommendations ?? []

  return (
    <div className="bg-white/[0.03] border border-white/10 rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Brain size={15} className="text-fuchsia-400" />
        <h2 className="text-sm font-semibold text-white">Learnings &amp; aanbevelingen</h2>
        <span className="text-[10px] text-white/40">winner/loser-patronen per niche · hook</span>
      </div>

      {loading ? (
        <p className="text-[11px] text-white/40">Laden…</p>
      ) : recs.length === 0 ? (
        <p className="text-[10px] text-amber-300/80 bg-amber-500/5 border border-amber-500/15 rounded-md px-3 py-2">
          Nog geen aanbevelingen — vult zich zodra de cron heeft gedraaid en er genoeg
          besliste videos (winners/losers) per niche zijn.
        </p>
      ) : (
        <>
          <div className="flex gap-2 flex-wrap">
            {(['increase','reduce','stop','test'] as const).map((a) => (
              <span key={a} className={`text-[10px] px-2 py-0.5 rounded-full bg-white/[0.05] ${ACTION[a].cls}`}>
                {ACTION[a].label}: {data?.by_action?.[a] ?? 0}
              </span>
            ))}
          </div>
          <div className="space-y-1">
            {recs.slice(0, 8).map((rec) => {
              const A = ACTION[rec.action] ?? ACTION.test
              const Icon = A.icon
              return (
                <div key={rec.id} className="flex items-start gap-2 bg-white/[0.03] border border-white/5 rounded-md px-2.5 py-1.5">
                  <Icon size={13} className={`${A.cls} mt-0.5 shrink-0`} />
                  <div className="min-w-0">
                    <p className="text-[11px] text-white/85">{rec.recommendation}</p>
                    <p className="text-[10px] text-white/40">
                      {rec.win_rate != null ? `win ${Number(rec.win_rate).toFixed(0)}%` : ''}
                      {rec.sample_n ? ` · n=${rec.sample_n}` : ''}
                      {` · conf ${Number(rec.confidence).toFixed(2)}`}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {!loading && data?.replication && (
        <div className="pt-2 border-t border-white/5">
          <div className="flex items-center gap-2 mb-1">
            <Copy size={12} className="text-cyan-300" />
            <p className="text-[11px] text-white/60">
              Replicatie-queue: <span className="text-cyan-300 font-medium">{data.replication.planned} gepland</span>
              <span className="text-white/35"> / {data.replication.total} totaal</span>
            </p>
          </div>
          {data.replication.items.length > 0 && (
            <div className="space-y-0.5">
              {data.replication.items.slice(0, 4).map((it) => (
                <p key={it.job_id} className="text-[10px] text-white/45 truncate">
                  ↻ {it.source_title || it.niche || 'winner'} <span className="text-white/30">· {it.status}</span>
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
