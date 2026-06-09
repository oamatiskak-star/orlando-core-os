'use client'

import { useCallback, useEffect, useState } from 'react'
import { RefreshCw, Flag, Target, AlertTriangle, GitBranch, Sparkles } from 'lucide-react'

type PriorityItem = {
  id: string
  company_id: string | null
  build_id: string | null
  entity: string | null
  module: string | null
  priority_rank: number
  priority_reason: string | null
  businessplan_phase: string | null
  linked_milestone: string | null
  revenue_impact_score: number
  delivery_impact_score: number
  blocker_score: number
  dependency_score: number
  recommended_owner: string | null
  recommended_start_today: boolean
}

const PHASE_COLOR: Record<string, string> = { A: '#34d399', B: '#22d3ee', C: '#a855f7' }

// Jaar-1 omzetdoel uit hermes.businessplan_meta (anker waar elke prioriteit op terugslaat).
const YEAR1_TARGET = '€2.880.000'

export default function DagPrioriteitSection({
  companySlug,
  heading = 'Dagprioriteit — vandaag eerst starten',
}: {
  companySlug?: string
  heading?: string
}) {
  const [items, setItems] = useState<PriorityItem[]>([])
  const [loading, setLoading] = useState(true)
  const [recalcing, setRecalcing] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const qs = companySlug ? `?company=${encodeURIComponent(companySlug)}` : ''
      const res = await fetch(`/api/build-tracker/daily-priority${qs}`)
      const j = await res.json()
      setItems(Array.isArray(j.items) ? j.items : [])
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [companySlug])

  useEffect(() => {
    void load()
  }, [load])

  async function recompute() {
    setRecalcing(true)
    setMsg(null)
    try {
      const res = await fetch('/api/build-tracker/refresh-canonical', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ recompute_priorities: true }),
      })
      const j = await res.json()
      setMsg(res.ok ? `Herberekend · ${j.priorities_count ?? 0} prioriteiten` : `Fout: ${j.error ?? 'onbekend'}`)
      await load()
    } catch {
      setMsg('Fout: netwerk onbereikbaar.')
    } finally {
      setRecalcing(false)
    }
  }

  return (
    <div className="bg-white/[0.02] border border-white/[0.08] rounded-xl p-4">
      <div className="flex items-center gap-2 mb-1">
        <Flag size={14} className="text-emerald-400" />
        <h2 className="text-[13px] font-semibold text-white">{heading}</h2>
        <button
          onClick={recompute}
          disabled={recalcing}
          className="ml-auto inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/[0.04] hover:bg-white/[0.08] transition-all text-[11px] text-white/65 hover:text-white disabled:opacity-50"
        >
          <RefreshCw size={12} className={recalcing ? 'animate-spin' : ''} /> Refresh + Herbereken Dagprioriteit
        </button>
      </div>
      <p className="text-[10.5px] text-white/40 mb-3">
        Volgorde teruggeleid naar het Master Businessplan · jaar-1 doel <span className="text-white/70">{YEAR1_TARGET}</span> · Fase A→B→C
      </p>
      {msg && <p className="text-[10px] text-white/45 mb-2">{msg}</p>}

      {loading ? (
        <p className="text-[11px] text-white/35">Laden…</p>
      ) : items.length === 0 ? (
        <p className="text-[11px] text-white/35">
          Geen dagprioriteit voor vandaag — draai &quot;Refresh + Herbereken Dagprioriteit&quot; of wacht op de 06:00-planner.
        </p>
      ) : (
        <ol className="space-y-2">
          {items.map((it) => {
            const color = PHASE_COLOR[it.businessplan_phase ?? ''] ?? '#94a3b8'
            return (
              <li
                key={it.id}
                className="bg-white/[0.04] border border-white/[0.06] rounded-lg p-3"
                style={{ borderLeft: `2px solid ${color}66` }}
              >
                <div className="flex items-start gap-2">
                  <span className="text-[10px] font-bold w-5 text-white/40 shrink-0 mt-0.5">#{it.priority_rank}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0" style={{ background: `${color}26`, color }}>
                        Fase {it.businessplan_phase ?? '?'}
                      </span>
                      {it.recommended_start_today && (
                        <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 inline-flex items-center gap-1">
                          <Sparkles size={9} /> vandaag starten
                        </span>
                      )}
                      <span className="text-[12px] text-white/90 font-medium truncate">{it.module || it.entity || 'Taak'}</span>
                    </div>
                    {it.priority_reason && <p className="text-[10px] text-white/50 mt-1 leading-snug">{it.priority_reason}</p>}
                    <div className="flex flex-wrap items-center gap-2.5 mt-1.5 text-[9.5px] text-white/45">
                      {it.linked_milestone && (
                        <span className="inline-flex items-center gap-1"><Target size={9} /> {it.linked_milestone}</span>
                      )}
                      <span className="inline-flex items-center gap-1" title="omzet-impact">💶 {it.revenue_impact_score}</span>
                      <span className="inline-flex items-center gap-1" title="delivery-impact">🚚 {it.delivery_impact_score}</span>
                      <span className="inline-flex items-center gap-1" title="blocker"><AlertTriangle size={9} /> {it.blocker_score}</span>
                      <span className="inline-flex items-center gap-1" title="dependency"><GitBranch size={9} /> {it.dependency_score}</span>
                      {it.recommended_owner && <span>👤 {it.recommended_owner}</span>}
                      {it.entity && <span className="text-white/35">{it.entity}</span>}
                    </div>
                  </div>
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
