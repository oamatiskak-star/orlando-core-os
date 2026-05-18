'use client'

import { useState } from 'react'
import { TrendingUp, Loader2, BarChart3, Package, Scissors, RefreshCw } from 'lucide-react'

type OptData = {
  analysis: string
  stats: {
    totalBudget: number
    totalCost: number
    avgMargin: number
    totalRevenue: number
    potentialSavings: number
    lowMarginCount: number
    overBudgetCount: number
  }
}

function fmt(n: number) {
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)
}

export default function OptimalisatiePage() {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<OptData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [generatedAt, setGeneratedAt] = useState<string | null>(null)

  async function run() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/osil/optimalisatie', { method: 'POST' })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error ?? 'Fout')
      setData(d)
      setGeneratedAt(new Date().toLocaleString('nl-NL', { dateStyle: 'medium', timeStyle: 'short' }))
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  const analysisLines = data?.analysis.split('\n').filter(l => l.trim()) ?? []
  const budgetPct = data ? (data.stats.totalCost / data.stats.totalBudget) * 100 : 0

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-white">Financial Optimization Agent</h1>
          <p className="text-xs text-white/50 mt-0.5">Margeoptimalisatie, kostenreductie & cashflow</p>
        </div>
        <button
          onClick={run}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
        >
          {loading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
          {loading ? 'Analyseren...' : data ? 'Heranalyse' : 'Analyse Starten'}
        </button>
      </div>

      {!data && !loading && (
        <div className="py-16 text-center space-y-4">
          <TrendingUp size={36} className="text-emerald-400/30 mx-auto" />
          <div>
            <p className="text-sm text-white/50">Financial Optimization analyse</p>
            <p className="text-xs text-white/28 mt-0.5">Analyseert projectmarges, budgetten en CFO-inzichten</p>
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>
      )}

      {loading && (
        <div className="py-16 text-center space-y-3">
          <Loader2 size={28} className="text-emerald-400/50 mx-auto animate-spin" />
          <p className="text-xs text-white/40">Financial Optimization Agent analyseert...</p>
        </div>
      )}

      {data && !loading && (
        <div className="space-y-4">
          <p className="text-[10px] text-white/30">{generatedAt}</p>

          {/* KPI strip */}
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: 'Omzet (betaald)', value: fmt(data.stats.totalRevenue), color: 'text-emerald-400', icon: TrendingUp },
              { label: 'Gem. Marge', value: `${data.stats.avgMargin.toFixed(1)}%`, color: data.stats.avgMargin < 10 ? 'text-red-400' : data.stats.avgMargin < 15 ? 'text-amber-400' : 'text-emerald-400', icon: BarChart3 },
              { label: 'Potentiële Besparing', value: fmt(data.stats.potentialSavings), color: 'text-indigo-400', icon: Scissors },
              { label: 'Over Budget', value: String(data.stats.overBudgetCount), color: data.stats.overBudgetCount > 0 ? 'text-red-400' : 'text-white/50', icon: Package },
            ].map(k => (
              <div key={k.label} className="bg-white/[0.04] border border-white/5 rounded-xl p-3 text-center">
                <k.icon size={13} className={`${k.color} mx-auto mb-1 opacity-60`} />
                <p className="text-[9px] text-white/38">{k.label}</p>
                <p className={`text-sm font-bold mt-0.5 ${k.color}`}>{k.value}</p>
              </div>
            ))}
          </div>

          {/* Budget progress */}
          <div className="bg-white/[0.04] border border-white/5 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-semibold text-white/45 uppercase tracking-wider">Budget Utilization</p>
              <span className={`text-xs font-bold ${budgetPct > 90 ? 'text-red-400' : budgetPct > 75 ? 'text-amber-400' : 'text-emerald-400'}`}>
                {budgetPct.toFixed(1)}%
              </span>
            </div>
            <div className="h-2 bg-white/5 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${budgetPct > 90 ? 'bg-red-500' : budgetPct > 75 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                style={{ width: `${Math.min(100, budgetPct)}%` }}
              />
            </div>
            <div className="flex justify-between mt-1.5">
              <span className="text-[10px] text-white/35">Kosten: {fmt(data.stats.totalCost)}</span>
              <span className="text-[10px] text-white/35">Budget: {fmt(data.stats.totalBudget)}</span>
            </div>
          </div>

          {/* AI Analysis */}
          <div className="bg-white/[0.04] border border-white/5 rounded-xl p-4">
            <p className="text-[10px] font-semibold text-white/45 uppercase tracking-wider mb-3">Optimalisatie Analyse</p>
            <div className="space-y-1.5 max-h-[420px] overflow-y-auto">
              {analysisLines.map((line, i) => (
                <p key={i} className={`text-xs leading-relaxed ${
                  line.match(/^\d\./) ? 'text-white/85 font-semibold mt-3' :
                  line.startsWith('-') ? 'text-white/60 pl-3' :
                  'text-white/50'
                }`}>{line}</p>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
