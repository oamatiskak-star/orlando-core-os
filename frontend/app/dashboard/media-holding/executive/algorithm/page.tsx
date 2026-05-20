'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Zap, RefreshCw, Sparkles } from 'lucide-react'
import { EmptyState } from '@/components/executive/EmptyState'

type Report = {
  id: string
  report_kind: string
  title: string
  summary_md: string
  generated_at: string
  sections?: unknown
}

export default function ExecutiveAlgorithm() {
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/executive-layer/reports?kind=algorithm_strategy&limit=10')
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
      const res = await fetch('/api/executive-layer/agents/run/algorithm_strategist', { method: 'POST' })
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
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-400/30 flex items-center justify-center">
            <Zap size={16} className="text-amber-300" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-white/80">Algorithm Gravity Engine</h1>
            <p className="text-[11px] text-white/40 mt-0.5">Momentum, swarm mode, audience migration — Algorithm Strategist elke 6u</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/media-holding/algorithm-gravity"
            className="text-[11px] text-white/40 hover:text-white/60 underline underline-offset-2"
          >
            Operationele Gravity →
          </Link>
          <button
            type="button"
            onClick={runAgent}
            disabled={running}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] rounded-lg bg-amber-500/10 border border-amber-400/30 text-amber-200 hover:bg-amber-500/20 disabled:opacity-40"
          >
            <Sparkles size={11} className={running ? 'animate-spin' : ''} />
            Run Algorithm Strategist
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-xs text-white/40">Rapporten laden…</div>
      ) : !latest ? (
        <EmptyState
          icon={<Zap size={18} />}
          title="Nog geen strategy reports"
          hint="Klik Run om de eerste analyse te draaien — Algorithm Strategist leest gravity events, trends en audio velocity."
        />
      ) : (
        <div className="bg-white/[0.04] border border-white/5 rounded-xl p-4">
          <div className="text-[10px] uppercase tracking-wide text-amber-300/70 mb-1">Latest market summary</div>
          <h2 className="text-sm font-semibold text-white/90">{latest.title}</h2>
          <div className="text-[10px] text-white/40 mt-1 mb-3">{new Date(latest.generated_at).toLocaleString('nl-NL')}</div>
          <div className="text-xs text-white/70 whitespace-pre-wrap">{latest.summary_md}</div>
          <AlgorithmSections sections={latest.sections} />
        </div>
      )}
    </div>
  )
}

function AlgorithmSections({ sections }: { sections: unknown }) {
  if (!Array.isArray(sections) || sections.length === 0) return null
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
      {sections.map((s, idx) => {
        const section = s as { kind?: string; items?: unknown[] }
        return (
          <div key={idx} className="bg-white/[0.03] border border-white/5 rounded-lg p-3">
            <div className="text-[10px] uppercase tracking-wide text-white/40 mb-2">{section.kind?.replace(/_/g, ' ')}</div>
            <pre className="text-[10px] text-white/60 whitespace-pre-wrap overflow-x-auto max-h-48">
              {JSON.stringify(section.items ?? [], null, 2)}
            </pre>
          </div>
        )
      })}
    </div>
  )
}
