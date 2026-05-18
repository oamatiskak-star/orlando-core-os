'use client'

import { useState } from 'react'
import { Scale, Loader2, Calendar, Receipt, Building2, RefreshCw, AlertCircle } from 'lucide-react'

type FiscaalData = {
  analysis: string
  stats: {
    totalBTW: number
    btwTeBetalen: number
    totalExcl: number
    brutomarge: number
    vennootschapsbelasting: number
    currentQuarter: number
    btwDeadline: string
  }
}

function fmt(n: number) {
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)
}

export default function FiscalistPage() {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<FiscaalData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [generatedAt, setGeneratedAt] = useState<string | null>(null)

  async function run() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/osil/fiscalist', { method: 'POST' })
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

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-white">AI Fiscalist</h1>
          <p className="text-xs text-white/50 mt-0.5">BTW · VPB · Dividendstrategie · Holdingstructuur</p>
        </div>
        <button
          onClick={run}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-500/10 border border-violet-500/20 text-violet-400 text-xs font-medium hover:bg-violet-500/20 transition-colors disabled:opacity-50"
        >
          {loading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
          {loading ? 'Analyseren...' : data ? 'Heranalyse' : 'Fiscale Analyse'}
        </button>
      </div>

      {!data && !loading && (
        <div className="py-16 text-center space-y-4">
          <Scale size={36} className="text-violet-400/30 mx-auto" />
          <div>
            <p className="text-sm text-white/50">AI Fiscalist — Big 4 niveau advies</p>
            <p className="text-xs text-white/28 mt-0.5">BTW-aangifte, VPB-optimalisatie, dividend & intercompany</p>
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>
      )}

      {loading && (
        <div className="py-16 text-center space-y-3">
          <Loader2 size={28} className="text-violet-400/50 mx-auto animate-spin" />
          <p className="text-xs text-white/40">AI Fiscalist analyseert fiscale positie...</p>
        </div>
      )}

      {data && !loading && (
        <div className="space-y-4">
          <p className="text-[10px] text-white/30">{generatedAt}</p>

          {/* BTW deadline alert */}
          <div className="flex items-center gap-3 p-3 bg-amber-500/5 border border-amber-500/15 rounded-xl">
            <AlertCircle size={14} className="text-amber-400 flex-shrink-0" />
            <div>
              <p className="text-xs font-medium text-amber-300">BTW-aangifte Q{data.stats.currentQuarter} deadline</p>
              <p className="text-[10px] text-amber-400/70 mt-0.5">{data.stats.btwDeadline} — BTW te betalen: {fmt(data.stats.btwTeBetalen)}</p>
            </div>
          </div>

          {/* KPI strip */}
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: 'BTW Uitgefactureerd', value: fmt(data.stats.totalBTW), color: 'text-white/70', icon: Receipt },
              { label: 'Omzet (excl. BTW)', value: fmt(data.stats.totalExcl), color: 'text-violet-400', icon: Building2 },
              { label: 'Brutomarge', value: fmt(data.stats.brutomarge), color: 'text-emerald-400', icon: Scale },
              { label: 'VPB Schatting', value: fmt(data.stats.vennootschapsbelasting), color: 'text-amber-400', icon: Calendar },
            ].map(k => (
              <div key={k.label} className="bg-white/[0.04] border border-white/5 rounded-xl p-3 text-center">
                <k.icon size={13} className={`${k.color} mx-auto mb-1 opacity-60`} />
                <p className="text-[9px] text-white/38">{k.label}</p>
                <p className={`text-sm font-bold mt-0.5 ${k.color}`}>{k.value}</p>
              </div>
            ))}
          </div>

          {/* Entiteiten */}
          <div className="grid grid-cols-4 gap-2">
            {[
              { name: 'STRKBEHEER BV', role: 'Holding/Vastgoed' },
              { name: 'STRKBOUW BV', role: '100% dochter' },
              { name: 'BOUWPROFFS BV', role: '60/40 JV' },
              { name: 'MODIWERIJO FM', role: 'Finance BV' },
            ].map(e => (
              <div key={e.name} className="bg-white/[0.03] border border-white/5 rounded-lg p-2 text-center">
                <p className="text-[10px] font-medium text-white/60">{e.name}</p>
                <p className="text-[9px] text-white/30 mt-0.5">{e.role}</p>
              </div>
            ))}
          </div>

          {/* AI Analysis */}
          <div className="bg-white/[0.04] border border-white/5 rounded-xl p-4">
            <p className="text-[10px] font-semibold text-white/45 uppercase tracking-wider mb-3">Fiscale Analyse & Advies</p>
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
