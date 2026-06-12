'use client'

import { useEffect, useState } from 'react'
import { Compass, TrendingUp, Minus, TrendingDown, OctagonX, CircleDot } from 'lucide-react'

type Decision = {
  channel_id: string; channel_name: string | null
  action: 'scale_up'|'maintain'|'reduce'|'stop'|'hold'
  rank: number | null; trend_ratio: number | null; views_30d: number | null; rationale: string | null
}
type Niche = { niche: string; win_rate: number | null; winners: number; losers: number; views: number; rank: number }
type Resp = {
  decisions: Decision[]
  by_action: Record<string, number>
  niches: Niche[]
}

const num = (n: number | null | undefined) => Number(n ?? 0).toLocaleString('nl-NL')

const ACTION = {
  scale_up: { icon: TrendingUp,   cls: 'text-emerald-300', label: 'Opschalen' },
  maintain: { icon: Minus,        cls: 'text-white/60',    label: 'Handhaven' },
  reduce:   { icon: TrendingDown, cls: 'text-amber-300',   label: 'Verminderen' },
  stop:     { icon: OctagonX,     cls: 'text-red-300',     label: 'Stoppen' },
  hold:     { icon: CircleDot,    cls: 'text-white/40',    label: 'Te weinig data' },
} as const

// S5 — Director: per-kanaal beslissingen (meer/minder/stoppen/opschalen) + niche-ranking.
export default function DirectorDecisionsCard() {
  const [data, setData] = useState<Resp | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    fetch('/api/media-holding/metrics/director')
      .then((r) => (r.ok ? r.json() : null))
      .then((d: Resp | null) => { if (alive) setData(d) })
      .catch(() => { if (alive) setData(null) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])

  const decisions = data?.decisions ?? []

  return (
    <div className="bg-white/[0.03] border border-white/10 rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Compass size={15} className="text-sky-400" />
        <h2 className="text-sm font-semibold text-white">Director — kanaalbeslissingen</h2>
        <span className="text-[10px] text-white/40">data-driven · meer / minder / stoppen / opschalen</span>
      </div>

      {loading ? (
        <p className="text-[11px] text-white/40">Laden…</p>
      ) : decisions.length === 0 ? (
        <p className="text-[10px] text-amber-300/80 bg-amber-500/5 border border-amber-500/15 rounded-md px-3 py-2">
          Nog geen beslissingen — draait wekelijks (en de cron kan handmatig getriggerd worden).
        </p>
      ) : (
        <>
          <div className="flex gap-2 flex-wrap">
            {(['scale_up','maintain','reduce','stop','hold'] as const).map((a) => (
              (data?.by_action?.[a] ?? 0) > 0 ? (
                <span key={a} className={`text-[10px] px-2 py-0.5 rounded-full bg-white/[0.05] ${ACTION[a].cls}`}>
                  {ACTION[a].label}: {data?.by_action?.[a]}
                </span>
              ) : null
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-1.5">
            {decisions.slice(0, 10).map((d) => {
              const A = ACTION[d.action] ?? ACTION.maintain
              const Icon = A.icon
              return (
                <div key={d.channel_id} className="flex items-center gap-2 bg-white/[0.03] border border-white/5 rounded-md px-2.5 py-1.5">
                  <span className="text-[10px] text-white/35 w-5 shrink-0">#{d.rank ?? '–'}</span>
                  <Icon size={13} className={`${A.cls} shrink-0`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] text-white/85 truncate">{d.channel_name || 'Onbekend'}</p>
                    <p className="text-[10px] text-white/40">{num(d.views_30d)} views/30d · trend {Number(d.trend_ratio ?? 0).toFixed(2)}</p>
                  </div>
                  <span className={`text-[10px] font-medium shrink-0 ${A.cls}`}>{A.label}</span>
                </div>
              )
            })}
          </div>

          {(data?.niches?.length ?? 0) > 0 && (
            <div className="pt-2 border-t border-white/5">
              <p className="text-[11px] text-white/55 font-medium mb-1">Niche-ranking (win-rate)</p>
              <div className="flex flex-wrap gap-1.5">
                {data!.niches.slice(0, 6).map((n) => (
                  <span key={n.niche} className="text-[10px] text-white/60 bg-white/[0.04] rounded-md px-2 py-0.5">
                    #{n.rank} {n.niche} · {n.win_rate != null ? `${Math.round(Number(n.win_rate) * 100)}%` : '–'}
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
