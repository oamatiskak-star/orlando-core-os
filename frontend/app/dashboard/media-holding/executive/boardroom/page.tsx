'use client'

import { useEffect, useState, useCallback } from 'react'
import { Briefcase, RefreshCw, FileText, Calendar, User } from 'lucide-react'
import { EmptyState } from '@/components/executive/EmptyState'
import { RecommendationCard, type Recommendation } from '@/components/executive/RecommendationCard'

type Report = {
  id: string
  report_kind: string
  period_start: string
  period_end: string
  title: string
  summary_md: string
  generated_by_agent: string
  generated_at: string
  scope: Record<string, unknown> | null
}

type ReportDetail = {
  report: Report & { sections: unknown[] }
  recommendations: Recommendation[]
}

const KIND_LABEL: Record<string, string> = {
  daily_briefing: 'Daily Briefing',
  weekly_boardroom: 'Weekly Boardroom',
  channel_deep_dive: 'Channel Deep Dive',
  viral_post_mortem: 'Viral Post-Mortem',
  retention_intelligence: 'Retention Intelligence',
  algorithm_strategy: 'Algorithm Strategy',
  fund_allocation: 'Fund Allocation',
}

export default function BoardroomPage() {
  const [reports, setReports] = useState<Report[]>([])
  const [selected, setSelected] = useState<ReportDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [filterKind, setFilterKind] = useState<string>('')

  const loadList = useCallback(async () => {
    setLoading(true)
    const url = `/api/executive-layer/reports?limit=30${filterKind ? `&kind=${filterKind}` : ''}`
    const res = await fetch(url)
    if (res.ok) {
      const j = await res.json()
      setReports(j.reports ?? [])
      if (!selected && (j.reports?.length ?? 0) > 0) {
        loadDetail(j.reports[0].id as string)
      }
    }
    setLoading(false)
  }, [filterKind, selected])

  const loadDetail = async (id: string) => {
    setLoadingDetail(true)
    const res = await fetch(`/api/executive-layer/reports/${id}`)
    if (res.ok) setSelected(await res.json())
    setLoadingDetail(false)
  }

  useEffect(() => { loadList() }, [loadList])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-400/30 flex items-center justify-center">
            <Briefcase size={16} className="text-indigo-300" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-white/80">AI Boardroom</h1>
            <p className="text-[11px] text-white/40 mt-0.5">Strategische rapporten van ATLAS + specialisten</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={filterKind}
            onChange={e => { setFilterKind(e.target.value); setSelected(null) }}
            className="text-[11px] bg-white/[0.04] border border-white/10 rounded-lg px-2 py-1 text-white/60"
          >
            <option value="">All kinds</option>
            {Object.entries(KIND_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <button
            type="button"
            onClick={loadList}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] rounded-lg bg-white/[0.04] border border-white/10 hover:bg-white/[0.08] text-white/60"
          >
            <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <aside className="space-y-2">
          {loading ? (
            <div className="text-xs text-white/40">Rapporten laden…</div>
          ) : reports.length === 0 ? (
            <EmptyState
              icon={<FileText size={18} />}
              title="Nog geen rapporten"
              hint="ATLAS draait elke ochtend om 07:00 (NL). Specialisten draaien op hun eigen schema."
            />
          ) : (
            reports.map(r => (
              <button
                key={r.id}
                type="button"
                onClick={() => loadDetail(r.id)}
                className={`w-full text-left p-3 rounded-xl border transition-colors ${selected?.report.id === r.id ? 'bg-indigo-500/10 border-indigo-400/30' : 'bg-white/[0.04] border-white/5 hover:bg-white/[0.06]'}`}
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-[10px] uppercase tracking-wide text-white/40">{KIND_LABEL[r.report_kind] ?? r.report_kind}</span>
                  <span className="text-[10px] text-white/30 flex items-center gap-1"><Calendar size={10} />{new Date(r.generated_at).toLocaleDateString('nl-NL')}</span>
                </div>
                <div className="text-xs font-medium text-white/80 line-clamp-2">{r.title}</div>
                <div className="text-[10px] text-white/40 mt-1 flex items-center gap-1"><User size={10} />{r.generated_by_agent}</div>
              </button>
            ))
          )}
        </aside>

        <main className="lg:col-span-2 bg-white/[0.04] rounded-xl border border-white/5 p-4 min-h-[300px]">
          {loadingDetail ? (
            <div className="text-xs text-white/40">Rapport laden…</div>
          ) : !selected ? (
            <EmptyState icon={<FileText size={18} />} title="Selecteer een rapport" />
          ) : (
            <div className="space-y-4">
              <div>
                <div className="text-[10px] uppercase tracking-wide text-indigo-300/70">
                  {KIND_LABEL[selected.report.report_kind] ?? selected.report.report_kind}
                </div>
                <h2 className="text-sm font-semibold text-white/90 mt-1">{selected.report.title}</h2>
                <div className="text-[10px] text-white/40 mt-1">
                  Gegenereerd door {selected.report.generated_by_agent} op {new Date(selected.report.generated_at).toLocaleString('nl-NL')}
                </div>
              </div>

              <div className="prose prose-invert prose-sm max-w-none text-xs text-white/70 whitespace-pre-wrap">
                {selected.report.summary_md || '— Geen samenvatting —'}
              </div>

              {selected.recommendations.length > 0 ? (
                <div className="space-y-2 border-t border-white/5 pt-4">
                  <div className="text-xs font-medium text-white/70">Recommendations ({selected.recommendations.length})</div>
                  {selected.recommendations.map(r => (
                    <RecommendationCard key={r.id} rec={r} onChange={() => loadDetail(selected.report.id)} />
                  ))}
                </div>
              ) : null}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
