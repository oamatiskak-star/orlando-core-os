'use client'

import { useEffect, useState } from 'react'
import { Brain, TrendingUp, DollarSign, AlertTriangle, Shield, Zap, RefreshCw } from 'lucide-react'
import type { CfoInsight } from '@/lib/finance/cfo-types'

function fmt(n: number) {
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)
}

const INSIGHT_ICONS: Record<string, typeof Brain> = {
  kostenoptimalisatie: DollarSign,
  omzetgroei:         TrendingUp,
  liquiditeit:        Zap,
  belasting:          Shield,
  risico:             AlertTriangle,
  groei:              TrendingUp,
  anomalie:           AlertTriangle,
  advies:             Brain,
}

const INSIGHT_LABELS: Record<string, string> = {
  kostenoptimalisatie: 'Kostenoptimalisatie',
  omzetgroei:         'Omzetgroei',
  liquiditeit:        'Liquiditeit',
  belasting:          'Belasting',
  risico:             'Risico',
  groei:              'Groei',
  anomalie:           'Anomalie',
  advies:             'Advies',
}

export default function InzichtenPage() {
  const [insights, setInsights]         = useState<CfoInsight[]>([])
  const [loading,  setLoading]          = useState(true)
  const [analyzing, setAnalyzing]       = useState(false)
  const [filter,   setFilter]           = useState<string>('all')

  async function loadInsights() {
    const res = await fetch('/api/finance/cfo/analyze')
    const data = await res.json().catch(() => null)
    setInsights(data?.insights ?? [])
    setLoading(false)
  }

  async function runAnalysis() {
    setAnalyzing(true)
    const now = new Date()
    await fetch('/api/finance/cfo/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        period_year:     now.getFullYear(),
        period_month:    now.getMonth() + 1,
        generate_report: false,
      }),
    })
    await loadInsights()
    setAnalyzing(false)
  }

  async function dismiss(id: string) {
    setInsights(prev => prev.filter(i => i.id !== id))
    // Optimistic UI — geen backend call voor dismiss hier, dit kan uitgebreid worden
  }

  useEffect(() => { loadInsights() }, [])

  const filtered = filter === 'all' ? insights : insights.filter(i => i.insight_type === filter)
  const types    = Array.from(new Set(insights.map(i => i.insight_type)))

  const priorityOrder = { kritiek: 0, hoog: 1, middel: 2, laag: 3 }
  const sorted = [...filtered].sort((a, b) =>
    (priorityOrder[a.priority] ?? 4) - (priorityOrder[b.priority] ?? 4)
  )

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-white flex items-center gap-2">
            <Brain size={16} className="text-purple-400" />
            AI CFO Inzichten
          </h1>
          <p className="text-xs text-white/50 mt-0.5">Gegenereerd door 3-laags AI: Boekhouder + CFO + Fiscalist</p>
        </div>
        <button
          onClick={runAnalysis}
          disabled={analyzing}
          className="flex items-center gap-1.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-medium px-3 py-2 rounded-lg transition-colors"
        >
          <RefreshCw size={12} className={analyzing ? 'animate-spin' : ''} />
          {analyzing ? 'Analyseren...' : 'Heranalyseer'}
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setFilter('all')}
          className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${filter === 'all' ? 'bg-purple-600/20 text-purple-400 border border-purple-500/20' : 'text-white/50 hover:text-white/70 border border-white/5'}`}
        >
          Alle ({insights.length})
        </button>
        {types.map(type => (
          <button
            key={type}
            onClick={() => setFilter(type)}
            className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${filter === type ? 'bg-purple-600/20 text-purple-400 border border-purple-500/20' : 'text-white/50 hover:text-white/70 border border-white/5'}`}
          >
            {INSIGHT_LABELS[type] ?? type}
          </button>
        ))}
      </div>

      {/* Insights */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw size={16} className="text-white/30 animate-spin" />
        </div>
      ) : sorted.length === 0 ? (
        <div className="bg-white/[0.06] border border-white/5 rounded-xl p-10 text-center">
          <Brain size={24} className="text-white/20 mx-auto mb-3" />
          <p className="text-xs text-white/40">Geen inzichten beschikbaar.</p>
          <p className="text-[10px] text-white/30 mt-1">Klik &apos;Heranalyseer&apos; om AI inzichten te genereren.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sorted.map(ins => {
            const Icon = INSIGHT_ICONS[ins.insight_type] ?? Brain
            const priorityConfig = {
              kritiek: { color: 'text-red-400',    bg: 'bg-red-500/10',    border: 'border-red-500/20',    badge: 'bg-red-500/20 text-red-400' },
              hoog:    { color: 'text-amber-400',  bg: 'bg-amber-500/10',  border: 'border-amber-500/20',  badge: 'bg-amber-500/20 text-amber-400' },
              middel:  { color: 'text-blue-400',   bg: 'bg-blue-500/10',   border: 'border-blue-500/20',   badge: 'bg-blue-500/20 text-blue-400' },
              laag:    { color: 'text-white/50',   bg: 'bg-white/5',       border: 'border-white/5',       badge: 'bg-white/10 text-white/50' },
            }[ins.priority] ?? { color: 'text-white/50', bg: 'bg-white/5', border: 'border-white/5', badge: 'bg-white/10 text-white/50' }

            return (
              <div key={ins.id} className={`${ins.priority === 'kritiek' ? 'bg-red-500/5' : 'bg-white/[0.06]'} border ${priorityConfig.border} rounded-xl p-4`}>
                <div className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-lg ${priorityConfig.bg} flex items-center justify-center flex-shrink-0`}>
                    <Icon size={14} className={priorityConfig.color} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <h4 className="text-sm font-semibold text-white leading-tight">{ins.title}</h4>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${priorityConfig.badge}`}>
                          {ins.priority.toUpperCase()}
                        </span>
                        <span className="text-[9px] text-white/30 border border-white/5 px-1.5 py-0.5 rounded-full">
                          {INSIGHT_LABELS[ins.insight_type] ?? ins.insight_type}
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-white/65 leading-relaxed">{ins.body}</p>
                    <div className="flex items-center gap-3 mt-2.5">
                      {ins.impact_amount && (
                        <span className="text-xs text-indigo-400 font-medium">
                          Impact: {fmt(ins.impact_amount)}
                        </span>
                      )}
                      {ins.confidence && (
                        <span className="text-[10px] text-white/35">
                          Betrouwbaarheid: {ins.confidence}%
                        </span>
                      )}
                      {ins.action_required && ins.action_label && (
                        <span className="text-xs text-green-400 border border-green-500/20 px-2 py-0.5 rounded-lg">
                          → {ins.action_label}
                        </span>
                      )}
                      <button
                        onClick={() => dismiss(ins.id)}
                        className="ml-auto text-[10px] text-white/30 hover:text-white/50 transition-colors"
                      >
                        Verbergen
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
