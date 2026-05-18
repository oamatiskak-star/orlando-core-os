'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  Brain, AlertTriangle, TrendingUp, Target, Zap,
  Shield, BarChart3, ChevronRight, RefreshCw, CheckCircle,
  AlertCircle, Activity
} from 'lucide-react'

type OsilSession = {
  id: string
  session_type: string
  title: string
  status: string
  priority: string
  context_snapshot: Record<string, unknown>
  ai_analysis: string
  ai_recommendations: Array<{ priority: string; action: string; category: string }>
  created_at: string
}

type OsilAlert = {
  id: string
  alert_type: string
  severity: string
  title: string
  description: string
  recommended_action: string | null
  company_id: string | null
  created_at: string
}

type OsilKpi = {
  ar_open: number
  ar_overdue: number
  ar_incasso: number
  active_projects: number
  survival_mode: boolean
  growth_mode: boolean
  ai_verdict: string | null
}

type OsilOpportunity = {
  id: string
  category: string
  title: string
  potential_value: number | null
  ai_score: number
  status: string
  time_horizon: string | null
}

function fmt(n: number) {
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'border-red-500/40 bg-red-500/5 text-red-400',
  high:     'border-orange-500/30 bg-orange-500/5 text-orange-400',
  medium:   'border-amber-500/30 bg-amber-500/5 text-amber-400',
  low:      'border-white/10 bg-white/[0.02] text-white/50',
}

const SEVERITY_ICON: Record<string, React.ReactNode> = {
  critical: <AlertCircle size={13} className="text-red-400 flex-shrink-0" />,
  high:     <AlertTriangle size={13} className="text-orange-400 flex-shrink-0" />,
  medium:   <AlertTriangle size={13} className="text-amber-400 flex-shrink-0" />,
  low:      <Activity size={13} className="text-white/40 flex-shrink-0" />,
}

const PRIO_COLORS: Record<string, string> = {
  kritiek: 'text-red-400 bg-red-500/10',
  hoog:    'text-amber-400 bg-amber-500/10',
  normaal: 'text-indigo-400 bg-indigo-500/10',
  laag:    'text-white/45 bg-white/5',
}

const CATEGORY_COLORS: Record<string, string> = {
  vastgoed:    'text-emerald-400 bg-emerald-500/10',
  saas:        'text-indigo-400 bg-indigo-500/10',
  youtube:     'text-red-400 bg-red-500/10',
  financieel:  'text-amber-400 bg-amber-500/10',
  legal:       'text-purple-400 bg-purple-500/10',
}

export default function OsilDashboard() {
  const [sessions, setSessions] = useState<OsilSession[]>([])
  const [alerts, setAlerts] = useState<OsilAlert[]>([])
  const [kpi, setKpi] = useState<OsilKpi | null>(null)
  const [opportunities, setOpportunities] = useState<OsilOpportunity[]>([])
  const [loading, setLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)
  const [lastResult, setLastResult] = useState<{ mode: string; session_id: string } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/osil/analyze', { cache: 'no-store' })
      if (res.ok) {
        const d = await res.json()
        setSessions(d.sessions ?? [])
        setAlerts(d.alerts ?? [])
        setKpi(d.latest_kpi ?? null)
        setOpportunities(d.top_opportunities ?? [])
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function runAnalysis() {
    setAnalyzing(true)
    try {
      const res = await fetch('/api/osil/analyze', { method: 'POST' })
      if (res.ok) {
        const d = await res.json()
        setLastResult({ mode: d.mode, session_id: d.session_id })
        await load()
      }
    } finally {
      setAnalyzing(false)
    }
  }

  async function resolveAlert(id: string) {
    await fetch('/api/osil/alerts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    setAlerts(prev => prev.filter(a => a.id !== id))
  }

  const latestSession = sessions[0]
  const mode = kpi?.survival_mode ? 'SURVIVAL' : kpi?.growth_mode ? 'GROEI' : 'BALANS'
  const modeColor = kpi?.survival_mode ? 'text-red-400 bg-red-500/10 border-red-500/20' : kpi?.growth_mode ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' : 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20'

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center">
            <Brain size={17} className="text-violet-400" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-white">Orlando Strategic Intelligence Layer</h1>
            <p className="text-xs text-white/50 mt-0.5">AI strategische commandolaag — boven alle systemen</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {kpi && (
            <span className={`px-3 py-1 rounded-full text-xs font-bold border ${modeColor}`}>
              {mode} MODUS
            </span>
          )}
          <button
            onClick={runAnalysis}
            disabled={analyzing}
            className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-xs font-medium px-4 py-2 rounded-lg transition-colors"
          >
            {analyzing ? <RefreshCw size={12} className="animate-spin" /> : <Brain size={12} />}
            {analyzing ? 'Analyseren...' : 'Board Analyse'}
          </button>
        </div>
      </div>

      {/* Result banner */}
      {lastResult && !analyzing && (
        <div className="bg-violet-500/10 border border-violet-500/20 rounded-xl px-4 py-3 flex items-center gap-3">
          <CheckCircle size={14} className="text-violet-400 flex-shrink-0" />
          <p className="text-xs text-violet-300">
            Board analyse voltooid — Modus: <strong>{lastResult.mode}</strong>. Zie resultaten hieronder.
          </p>
        </div>
      )}

      {/* KPI strip */}
      {kpi && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Open Debiteuren', value: fmt(kpi.ar_open), color: 'text-amber-400' },
            { label: 'Vervallen AR', value: fmt(kpi.ar_overdue), color: kpi.ar_overdue > 20000 ? 'text-red-400' : 'text-white/70' },
            { label: 'Incasso Totaal', value: fmt(kpi.ar_incasso), color: kpi.ar_incasso > 0 ? 'text-red-500' : 'text-white/70' },
            { label: 'Actieve Projecten', value: String(kpi.active_projects), color: 'text-emerald-400' },
          ].map(s => (
            <div key={s.label} className="bg-white/[0.06] border border-white/5 rounded-xl p-4">
              <p className="text-[10px] font-medium text-white/50 uppercase tracking-wider mb-1">{s.label}</p>
              <p className={`text-lg font-semibold ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {loading && !kpi ? (
        <div className="py-16 text-center text-xs text-white/40">Laden...</div>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {/* Left: AI Analysis + Decisions */}
          <div className="col-span-2 space-y-4">
            {/* Latest board analysis */}
            {latestSession?.ai_analysis ? (
              <div className="bg-white/[0.06] border border-white/5 rounded-xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Brain size={13} className="text-violet-400" />
                    <h3 className="text-xs font-semibold text-white">Board Analyse</h3>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${PRIO_COLORS[latestSession.priority] ?? 'text-white/50 bg-white/5'}`}>
                      {latestSession.priority}
                    </span>
                  </div>
                  <span className="text-[10px] text-white/38">
                    {new Date(latestSession.created_at).toLocaleString('nl-NL', { dateStyle: 'short', timeStyle: 'short' })}
                  </span>
                </div>
                <div className="prose-none">
                  {latestSession.ai_analysis.split('\n').filter(l => l.trim()).map((line, i) => (
                    <p key={i} className={`text-xs leading-relaxed mb-1 ${
                      line.startsWith('#') ? 'text-white font-semibold mt-3 text-sm' :
                      line.match(/^\d\./) ? 'text-white/80 font-medium mt-2' :
                      line.startsWith('-') ? 'text-white/65 pl-3' :
                      'text-white/55'
                    }`}>
                      {line.replace(/^#+\s/, '')}
                    </p>
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-white/[0.04] border border-white/5 rounded-xl p-8 flex flex-col items-center gap-3">
                <Brain size={28} className="text-violet-400/40" />
                <p className="text-sm text-white/45">Nog geen board analyse uitgevoerd</p>
                <button onClick={runAnalysis} disabled={analyzing}
                  className="text-xs text-violet-400 hover:text-violet-300">
                  Start eerste analyse
                </button>
              </div>
            )}

            {/* Recommendations */}
            {latestSession?.ai_recommendations && latestSession.ai_recommendations.length > 0 && (
              <div className="bg-white/[0.06] border border-white/5 rounded-xl p-4">
                <h3 className="text-xs font-semibold text-white mb-3 flex items-center gap-2">
                  <Target size={13} className="text-violet-400" />
                  Prioritaire Acties
                </h3>
                <div className="space-y-2">
                  {latestSession.ai_recommendations.map((rec, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 bg-white/[0.03] border border-white/5 rounded-lg">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium flex-shrink-0 ${PRIO_COLORS[rec.priority] ?? 'text-white/50 bg-white/5'}`}>
                        {rec.priority}
                      </span>
                      <p className="text-xs text-white/70 flex-1">{rec.action}</p>
                      <span className="text-[10px] text-white/38 flex-shrink-0">{rec.category}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Quick links */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { href: '/dashboard/osil/board', icon: Brain, label: 'Board Sessies', color: 'text-violet-400 bg-violet-500/10 border-violet-500/20' },
                { href: '/dashboard/osil/kansen', icon: TrendingUp, label: 'Kansen Radar', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
                { href: '/dashboard/osil/rapport', icon: BarChart3, label: 'Executive Rapport', color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20' },
                { href: '/dashboard/finance/cfo', icon: Shield, label: 'CFO Cockpit', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
                { href: '/dashboard/finance/cfo/belasting', icon: Zap, label: 'Fiscaal', color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
                { href: '/dashboard/finance', icon: BarChart3, label: 'Finance OS', color: 'text-white/50 bg-white/5 border-white/10' },
              ].map(l => (
                <Link key={l.href} href={l.href}
                  className={`flex items-center gap-2 p-3 rounded-xl border transition-colors hover:opacity-80 ${l.color}`}>
                  <l.icon size={13} />
                  <span className="text-xs font-medium">{l.label}</span>
                  <ChevronRight size={11} className="ml-auto opacity-50" />
                </Link>
              ))}
            </div>
          </div>

          {/* Right: Alerts + Opportunities */}
          <div className="space-y-4">
            {/* Active alerts */}
            <div className="bg-white/[0.06] border border-white/5 rounded-xl p-4">
              <h3 className="text-xs font-semibold text-white mb-3 flex items-center gap-2">
                <AlertTriangle size={13} className="text-amber-400" />
                Actieve Waarschuwingen
                {alerts.length > 0 && (
                  <span className="ml-auto text-[10px] font-bold text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded-full">
                    {alerts.length}
                  </span>
                )}
              </h3>
              {alerts.length === 0 ? (
                <div className="flex items-center gap-2 py-3">
                  <CheckCircle size={13} className="text-green-400" />
                  <p className="text-xs text-green-400">Geen actieve waarschuwingen</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {alerts.slice(0, 5).map(a => (
                    <div key={a.id} className={`p-2.5 rounded-lg border ${SEVERITY_COLORS[a.severity] ?? SEVERITY_COLORS.low}`}>
                      <div className="flex items-start gap-2">
                        {SEVERITY_ICON[a.severity]}
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-medium leading-tight">{a.title}</p>
                          <p className="text-[10px] text-white/45 mt-0.5 line-clamp-2">{a.description}</p>
                        </div>
                        <button
                          onClick={() => resolveAlert(a.id)}
                          className="text-white/30 hover:text-green-400 transition-colors flex-shrink-0"
                          title="Markeer opgelost"
                        >
                          <CheckCircle size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Top opportunities */}
            <div className="bg-white/[0.06] border border-white/5 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold text-white flex items-center gap-2">
                  <TrendingUp size={13} className="text-emerald-400" />
                  Top Kansen
                </h3>
                <Link href="/dashboard/osil/kansen" className="text-[10px] text-indigo-400 hover:text-indigo-300">
                  Alle →
                </Link>
              </div>
              {opportunities.length === 0 ? (
                <p className="text-xs text-white/40 py-2 text-center">Geen kansen geregistreerd</p>
              ) : (
                <div className="space-y-2">
                  {opportunities.map(op => (
                    <div key={op.id} className="flex items-start gap-2 p-2 rounded-lg bg-white/[0.03] border border-white/5">
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium flex-shrink-0 ${CATEGORY_COLORS[op.category] ?? 'text-white/45 bg-white/5'}`}>
                        {op.category}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] text-white/80 font-medium truncate">{op.title}</p>
                        {op.potential_value && (
                          <p className="text-[10px] text-emerald-400">{fmt(op.potential_value)}</p>
                        )}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className={`text-[11px] font-bold ${op.ai_score >= 80 ? 'text-emerald-400' : op.ai_score >= 50 ? 'text-amber-400' : 'text-white/45'}`}>
                          {op.ai_score}
                        </p>
                        <p className="text-[9px] text-white/30">score</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
