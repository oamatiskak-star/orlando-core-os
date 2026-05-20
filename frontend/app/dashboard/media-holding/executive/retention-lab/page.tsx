'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Activity, RefreshCw, ChevronRight, Sparkles } from 'lucide-react'
import { EmptyState } from '@/components/executive/EmptyState'

type RetentionReport = {
  id: string
  report_kind: string
  title: string
  summary_md: string
  generated_at: string
  sections?: unknown
}

export default function ExecutiveRetentionLab() {
  const [reports, setReports] = useState<RetentionReport[]>([])
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/executive-layer/reports?kind=retention_intelligence&limit=10')
    if (res.ok) {
      const j = await res.json()
      setReports(j.reports ?? [])
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const runAgent = async () => {
    setRunning(true)
    try {
      const res = await fetch('/api/executive-layer/agents/run/retention_scientist', { method: 'POST' })
      const j = await res.json()
      if (!res.ok) console.warn('Run failed', j)
      await load()
    } finally {
      setRunning(false)
    }
  }

  const latest = reports[0]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-400/30 flex items-center justify-center">
            <Activity size={16} className="text-emerald-300" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-white/80">Retention Lab</h1>
            <p className="text-[11px] text-white/40 mt-0.5">Hook intelligence, pacing & dopamine timing — Retention Scientist 08:30 NL</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/media-holding/retention-lab"
            className="text-[11px] text-white/40 hover:text-white/60 underline underline-offset-2"
          >
            Operationele Lab →
          </Link>
          <button
            type="button"
            onClick={runAgent}
            disabled={running}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] rounded-lg bg-emerald-500/10 border border-emerald-400/30 text-emerald-200 hover:bg-emerald-500/20 disabled:opacity-40"
          >
            <Sparkles size={11} className={running ? 'animate-spin' : ''} />
            Run Retention Scientist
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-xs text-white/40">Rapporten laden…</div>
      ) : !latest ? (
        <EmptyState
          icon={<Activity size={18} />}
          title="Nog geen retention intelligence"
          hint="Klik Run Retention Scientist om de eerste 30-dagen aggregatie te draaien."
        />
      ) : (
        <>
          <div className="bg-white/[0.04] border border-white/5 rounded-xl p-4">
            <div className="text-[10px] uppercase tracking-wide text-emerald-300/70 mb-1">Latest report</div>
            <h2 className="text-sm font-semibold text-white/90">{latest.title}</h2>
            <div className="text-[10px] text-white/40 mt-1 mb-3">{new Date(latest.generated_at).toLocaleString('nl-NL')}</div>
            <div className="text-xs text-white/70 whitespace-pre-wrap">{latest.summary_md}</div>
            <RetentionSections sections={latest.sections} />
          </div>

          {reports.length > 1 ? (
            <div className="bg-white/[0.04] border border-white/5 rounded-xl p-4">
              <div className="text-xs font-medium text-white/70 mb-3">History</div>
              <div className="space-y-1.5">
                {reports.slice(1).map(r => (
                  <Link
                    key={r.id}
                    href={`/dashboard/media-holding/executive/boardroom?report=${r.id}`}
                    className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/[0.02] border border-white/5 hover:bg-white/[0.05] text-xs"
                  >
                    <span className="text-white/70">{r.title}</span>
                    <span className="flex items-center gap-2 text-[10px] text-white/30">
                      {new Date(r.generated_at).toLocaleDateString('nl-NL')}
                      <ChevronRight size={12} />
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}

function RetentionSections({ sections }: { sections: unknown }) {
  if (!Array.isArray(sections) || sections.length === 0) return null
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
      {sections.map((s, idx) => {
        const section = s as { kind?: string; items?: unknown[]; value?: unknown }
        return (
          <div key={idx} className="bg-white/[0.03] border border-white/5 rounded-lg p-3">
            <div className="text-[10px] uppercase tracking-wide text-white/40 mb-2">{section.kind?.replace(/_/g, ' ')}</div>
            <pre className="text-[10px] text-white/60 whitespace-pre-wrap overflow-x-auto">
              {JSON.stringify(section.items ?? section.value ?? null, null, 2)}
            </pre>
          </div>
        )
      })}
    </div>
  )
}
