'use client'

import { useState } from 'react'
import { ShieldAlert, Loader2, AlertTriangle, Users, TrendingDown, MessageSquare, RefreshCw } from 'lucide-react'

type RecoveryData = {
  analysis: string
  stats: {
    totalOverdue: number
    totalIncasso: number
    overdueCount: number
    criticalCount: number
  }
  topDebtors: Array<{ debtor_name: string | null; amount_incl: number; days_overdue: number }>
}

function fmt(n: number) {
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)
}

export default function RecoveryPage() {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<RecoveryData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [generatedAt, setGeneratedAt] = useState<string | null>(null)

  async function run() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/osil/recovery', { method: 'POST' })
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
          <h1 className="text-lg font-semibold text-white">Recovery & Reputatie Agent</h1>
          <p className="text-xs text-white/50 mt-0.5">Cashflow herstel + crediteurenrelaties beschermen</p>
        </div>
        <button
          onClick={run}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium hover:bg-red-500/20 transition-colors disabled:opacity-50"
        >
          {loading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
          {loading ? 'Analyseren...' : data ? 'Heranalyse' : 'Analyse Starten'}
        </button>
      </div>

      {!data && !loading && (
        <div className="py-16 text-center space-y-4">
          <ShieldAlert size={36} className="text-red-400/30 mx-auto" />
          <div>
            <p className="text-sm text-white/50">Recovery & Reputatie analyse</p>
            <p className="text-xs text-white/28 mt-0.5">Analyseert vervallen facturen, incasso dossiers en juridische mails</p>
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>
      )}

      {loading && (
        <div className="py-16 text-center space-y-3">
          <Loader2 size={28} className="text-red-400/50 mx-auto animate-spin" />
          <p className="text-xs text-white/40">Recovery Agent analyseert live data...</p>
        </div>
      )}

      {data && !loading && (
        <div className="space-y-4">
          <p className="text-[10px] text-white/30">{generatedAt}</p>

          {/* KPI strip */}
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: 'Vervallen AR', value: fmt(data.stats.totalOverdue), color: 'text-red-400', icon: TrendingDown },
              { label: 'Incasso', value: fmt(data.stats.totalIncasso), color: 'text-amber-400', icon: AlertTriangle },
              { label: 'Debiteuren', value: String(data.stats.overdueCount), color: 'text-white/70', icon: Users },
              { label: 'Kritiek >60d', value: String(data.stats.criticalCount), color: 'text-red-400', icon: ShieldAlert },
            ].map(k => (
              <div key={k.label} className="bg-white/[0.04] border border-white/5 rounded-xl p-3 text-center">
                <k.icon size={13} className={`${k.color} mx-auto mb-1 opacity-60`} />
                <p className="text-[9px] text-white/38">{k.label}</p>
                <p className={`text-sm font-bold mt-0.5 ${k.color}`}>{k.value}</p>
              </div>
            ))}
          </div>

          {/* Top debtors */}
          {data.topDebtors.length > 0 && (
            <div className="bg-white/[0.04] border border-white/5 rounded-xl p-4">
              <p className="text-[10px] font-semibold text-white/45 uppercase tracking-wider mb-3">Top Vervallen Debiteuren</p>
              <div className="space-y-2">
                {data.topDebtors.map((d, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <span className="text-white/65">{d.debtor_name ?? 'Onbekend'}</span>
                    <div className="flex items-center gap-3">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${d.days_overdue > 60 ? 'text-red-400 bg-red-500/10' : 'text-amber-400 bg-amber-500/10'}`}>
                        {d.days_overdue}d
                      </span>
                      <span className="text-white/70 font-medium tabular-nums">{fmt(d.amount_incl)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI Analysis */}
          <div className="bg-white/[0.04] border border-white/5 rounded-xl p-4">
            <p className="text-[10px] font-semibold text-white/45 uppercase tracking-wider mb-3">
              <MessageSquare size={10} className="inline mr-1" />
              Recovery Analyse
            </p>
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
