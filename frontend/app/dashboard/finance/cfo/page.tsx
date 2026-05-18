'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import {
  TrendingUp, TrendingDown, AlertTriangle, CheckCircle,
  RefreshCw, Zap, DollarSign, Shield, BarChart3, Brain,
  ArrowUpRight, ArrowDownRight, Clock, FileText, ExternalLink,
} from 'lucide-react'
import type { CfoInsight, CfoRiskAlert, CfoKpiData, CfoCashflowData, CfoTaxData } from '@/lib/finance/cfo-types'

function fmt(n: number) {
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)
}

function fmtPct(n: number) {
  return `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`
}

type SyncStatus = 'idle' | 'syncing' | 'analyzing' | 'done' | 'error'

type AnalyzeResult = {
  kpi:      CfoKpiData
  cashflow: CfoCashflowData
  tax:      CfoTaxData
  insights: number
  alerts:   number
  actions:  number
}

export default function CfoCockpitPage() {
  const [syncStatus,     setSyncStatus]     = useState<SyncStatus>('idle')
  const [analyzeResult,  setAnalyzeResult]  = useState<AnalyzeResult | null>(null)
  const [insights,       setInsights]       = useState<CfoInsight[]>([])
  const [alerts,         setAlerts]         = useState<CfoRiskAlert[]>([])
  const [lastSync,       setLastSync]       = useState<string | null>(null)
  const [error,          setError]          = useState<string | null>(null)
  const [mbConnected,    setMbConnected]    = useState<boolean | null>(null)

  const loadCurrent = useCallback(async () => {
    const now   = new Date()
    const year  = now.getFullYear()
    const month = now.getMonth() + 1

    const [analyzeRes, alertsRes] = await Promise.all([
      fetch(`/api/finance/cfo/analyze?year=${year}&month=${month}`),
      fetch('/api/finance/alerts?limit=20'),
    ])

    const analyzeData = await analyzeRes.json().catch(() => null)
    const alertsData  = await alertsRes.json().catch(() => null)

    if (analyzeData?.report) {
      const r = analyzeData.report
      setAnalyzeResult({
        kpi: r.kpi_data ?? {
          revenue_total: r.revenue_total ?? 0,
          costs_total:   r.costs_total   ?? 0,
          profit_net:    r.profit_net    ?? 0,
          profit_margin_pct: r.profit_margin_pct ?? 0,
          ebitda:        r.profit_net    ?? 0,
          burnrate:      r.costs_total   ? r.costs_total / 30 : 0,
          runway_days:   0,
          revenue_recurring: 0,
          revenue_one_off:   0,
          revenue_mom_change: 0,
          costs_top:         [],
        },
        cashflow: r.cashflow_data ?? {
          current_balance: 0, balance_30d: r.cashflow_end ?? 0,
          balance_60d: 0, balance_90d: 0, incoming_30d: r.debtors_open ?? 0, outgoing_30d: 0,
        },
        tax: r.tax_data ?? {
          btw_current_quarter: r.btw_to_pay ?? 0, btw_reserved: 0, btw_gap: 0,
          vpb_estimated_year: 0, vpb_reserved: r.vpb_reserved ?? 0, vpb_gap: 0,
          next_deadlines: [],
        },
        insights: analyzeData.insights?.length ?? 0,
        alerts:   alertsData?.count ?? 0,
        actions:  0,
      })
    }

    if (analyzeData?.insights) setInsights(analyzeData.insights.slice(0, 8))
    if (alertsData?.alerts)    setAlerts(alertsData.alerts.slice(0, 6))
  }, [])

  useEffect(() => {
    loadCurrent()
    // Check Moneybird verbinding
    fetch('/api/integrations/status').then(r => r.json()).then(d => {
      const mb = d?.connections?.find((c: { type: string; status: string }) => c.type === 'moneybird')
      setMbConnected(mb?.status === 'connected')
    }).catch(() => setMbConnected(false))
  }, [loadCurrent])

  async function handleSync() {
    setSyncStatus('syncing')
    setError(null)

    try {
      const syncRes = await fetch('/api/finance/moneybird/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sync_type: 'volledig', company_id: 'STRKBEHEER' }),
      })
      if (!syncRes.ok) {
        const err = await syncRes.json()
        throw new Error(err.error ?? 'Sync mislukt')
      }

      setSyncStatus('analyzing')

      const analyzeRes = await fetch('/api/finance/cfo/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ generate_report: false }),
      })
      if (!analyzeRes.ok) throw new Error('Analyse mislukt')
      const result = await analyzeRes.json()

      setAnalyzeResult(result)
      setLastSync(new Date().toISOString())
      setSyncStatus('done')
      await loadCurrent()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Onbekende fout')
      setSyncStatus('error')
    }
  }

  async function resolveAlert(id: string) {
    await fetch('/api/finance/alerts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action: 'resolve' }),
    })
    setAlerts(prev => prev.filter(a => a.id !== id))
  }

  const criticalAlerts = alerts.filter(a => a.severity === 'critical')
  const highAlerts     = alerts.filter(a => a.severity === 'high')
  const kpi            = analyzeResult?.kpi
  const cashflow       = analyzeResult?.cashflow
  const tax            = analyzeResult?.tax

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-white flex items-center gap-2">
            <Brain size={16} className="text-indigo-400" />
            CFO Cockpit
          </h1>
          <p className="text-xs text-white/50 mt-0.5">AI-gestuurde financiële intelligentie — Boekhouder + CFO + Fiscalist</p>
        </div>
        <div className="flex items-center gap-2">
          {lastSync && (
            <span className="text-xs text-white/40">
              Laatste sync: {new Date(lastSync).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button
            onClick={handleSync}
            disabled={syncStatus === 'syncing' || syncStatus === 'analyzing'}
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-medium px-3 py-2 rounded-lg transition-colors"
          >
            <RefreshCw size={12} className={syncStatus === 'syncing' || syncStatus === 'analyzing' ? 'animate-spin' : ''} />
            {syncStatus === 'syncing' ? 'Syncing...' : syncStatus === 'analyzing' ? 'Analyseren...' : 'Sync + Analyse'}
          </button>
          <Link
            href="/api/finance/cfo/report/pdf"
            target="_blank"
            className="flex items-center gap-1.5 border border-white/10 text-white/60 hover:text-white text-xs px-3 py-2 rounded-lg transition-colors"
          >
            <FileText size={12} />
            PDF Rapport
          </Link>
        </div>
      </div>

      {/* Moneybird warning */}
      {mbConnected === false && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3 flex items-center gap-2">
          <AlertTriangle size={14} className="text-amber-400 flex-shrink-0" />
          <p className="text-xs text-amber-400">
            Moneybird niet verbonden. <Link href="/dashboard/admin" className="underline">Verbind nu</Link> voor live data.
          </p>
        </div>
      )}

      {/* Sync status */}
      {syncStatus === 'error' && error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-xs text-red-400">
          {error}
        </div>
      )}
      {syncStatus === 'done' && (
        <div className="bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-3 flex items-center gap-2 text-xs text-green-400">
          <CheckCircle size={13} />
          Sync + CFO analyse voltooid — {analyzeResult?.insights ?? 0} inzichten, {analyzeResult?.alerts ?? 0} alerts gegenereerd
        </div>
      )}

      {/* Critical alerts */}
      {criticalAlerts.length > 0 && (
        <div className="space-y-2">
          {criticalAlerts.map(alert => (
            <div key={alert.id} className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 flex items-start justify-between gap-3">
              <div className="flex items-start gap-2">
                <AlertTriangle size={14} className="text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-red-400">{alert.title}</p>
                  <p className="text-xs text-red-400/70 mt-0.5">{alert.message}</p>
                </div>
              </div>
              <button
                onClick={() => resolveAlert(alert.id)}
                className="text-[10px] text-red-400/60 hover:text-red-400 border border-red-500/20 px-2 py-1 rounded-lg flex-shrink-0 transition-colors"
              >
                Oplossen
              </button>
            </div>
          ))}
        </div>
      )}

      {/* KPI grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard
          label="Omzet MTD"
          value={kpi ? fmt(kpi.revenue_total) : '—'}
          sub={kpi ? fmtPct(kpi.revenue_mom_change) + ' MoM' : ''}
          trend={kpi?.revenue_mom_change}
          color="blue"
        />
        <KpiCard
          label="Kosten MTD"
          value={kpi ? fmt(kpi.costs_total) : '—'}
          sub={kpi ? `Burnrate ${fmt(kpi.burnrate)}/dag` : ''}
          color="red"
        />
        <KpiCard
          label="Nettowinst"
          value={kpi ? fmt(kpi.profit_net) : '—'}
          sub={kpi ? `Marge ${kpi.profit_margin_pct.toFixed(1)}%` : ''}
          trend={kpi?.profit_net}
          color={kpi && kpi.profit_net >= 0 ? 'green' : 'red'}
        />
        <KpiCard
          label="Cashflow 30d"
          value={cashflow ? fmt(cashflow.balance_30d) : '—'}
          sub="verwacht saldo"
          trend={cashflow?.balance_30d}
          color={cashflow && cashflow.balance_30d >= 0 ? 'green' : 'red'}
        />
        <KpiCard
          label="BTW Schuld"
          value={tax ? fmt(tax.btw_current_quarter) : '—'}
          sub={tax ? `Gap: ${fmt(Math.abs(tax.btw_gap))}` : ''}
          color={tax && tax.btw_gap > 1000 ? 'red' : 'amber'}
        />
        <KpiCard
          label="Runway"
          value={kpi ? `${kpi.runway_days}d` : '—'}
          sub="op basis burnrate"
          color={kpi && kpi.runway_days > 90 ? 'green' : kpi && kpi.runway_days > 30 ? 'amber' : 'red'}
        />
      </div>

      {/* Midden sectie: Cashflow + Belasting */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Cashflow prognose */}
        <div className="bg-white/[0.06] border border-white/5 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-white flex items-center gap-1.5">
              <BarChart3 size={13} className="text-blue-400" />
              Cashflow Prognose
            </h3>
            <Link href="/dashboard/finance/cfo/cashflow" className="text-[10px] text-white/40 hover:text-white/60 transition-colors">
              Details →
            </Link>
          </div>
          <div className="space-y-2">
            {[
              { label: 'Huidig saldo',   val: cashflow?.current_balance ?? 0 },
              { label: 'Over 30 dagen',  val: cashflow?.balance_30d     ?? 0 },
              { label: 'Over 60 dagen',  val: cashflow?.balance_60d     ?? 0 },
              { label: 'Over 90 dagen',  val: cashflow?.balance_90d     ?? 0 },
            ].map(row => (
              <div key={row.label} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                <span className="text-xs text-white/50">{row.label}</span>
                <span className={`text-sm font-semibold ${row.val >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {fmt(row.val)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Belasting status */}
        <div className="bg-white/[0.06] border border-white/5 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-white flex items-center gap-1.5">
              <Shield size={13} className="text-amber-400" />
              Belasting Status
            </h3>
            <Link href="/dashboard/finance/cfo/belasting" className="text-[10px] text-white/40 hover:text-white/60 transition-colors">
              Details →
            </Link>
          </div>
          <div className="space-y-2">
            <TaxRow
              label="BTW Q kwartaal"
              required={tax?.btw_current_quarter ?? 0}
              reserved={tax?.btw_reserved ?? 0}
              deadline={tax?.btw_deadline}
            />
            <TaxRow
              label="VPB (jaar)"
              required={tax?.vpb_estimated_year ?? 0}
              reserved={tax?.vpb_reserved ?? 0}
            />
            {tax?.next_deadlines?.slice(0, 2).map((d, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                <div>
                  <span className="text-xs text-white/70">{d.type}</span>
                  <span className="text-[10px] text-white/40 ml-2">{d.deadline}</span>
                </div>
                <span className="text-xs text-amber-400">{fmt(d.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* AI Inzichten */}
      {insights.length > 0 && (
        <div className="bg-white/[0.06] border border-white/5 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-white flex items-center gap-1.5">
              <Brain size={13} className="text-purple-400" />
              AI CFO Inzichten
            </h3>
            <Link href="/dashboard/finance/cfo/inzichten" className="text-[10px] text-white/40 hover:text-white/60 transition-colors">
              Alle inzichten →
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {insights.slice(0, 4).map(ins => (
              <InsightCard key={ins.id} insight={ins} />
            ))}
          </div>
        </div>
      )}

      {/* Hoge alerts */}
      {highAlerts.length > 0 && (
        <div className="bg-white/[0.06] border border-white/5 rounded-xl p-4">
          <h3 className="text-xs font-semibold text-white mb-3 flex items-center gap-1.5">
            <AlertTriangle size={13} className="text-amber-400" />
            Actieve Risico Signalen
          </h3>
          <div className="space-y-2">
            {highAlerts.map(alert => (
              <div key={alert.id} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                <div className="flex items-start gap-2">
                  <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${
                    alert.severity === 'high' ? 'bg-amber-400' : 'bg-blue-400'
                  }`} />
                  <div>
                    <p className="text-xs text-white/80">{alert.title}</p>
                    <p className="text-[10px] text-white/50 mt-0.5">{alert.message.slice(0, 100)}</p>
                  </div>
                </div>
                <button
                  onClick={() => resolveAlert(alert.id)}
                  className="text-[10px] text-white/40 hover:text-white/60 border border-white/10 px-2 py-1 rounded-lg flex-shrink-0 ml-2 transition-colors"
                >
                  ✓
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick links */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { href: '/dashboard/finance/cfo/cashflow',  label: 'Cashflow',          icon: BarChart3,    color: 'text-blue-400',   bg: 'bg-blue-500/10' },
          { href: '/dashboard/finance/cfo/belasting',  label: 'Belasting',         icon: Shield,       color: 'text-amber-400',  bg: 'bg-amber-500/10' },
          { href: '/dashboard/finance/cfo/inzichten',  label: 'AI Inzichten',      icon: Brain,        color: 'text-purple-400', bg: 'bg-purple-500/10' },
          { href: '/dashboard/finance/cfo/rapport',    label: 'CFO Rapport',       icon: FileText,     color: 'text-green-400',  bg: 'bg-green-500/10' },
        ].map(item => (
          <Link
            key={item.href}
            href={item.href}
            className="bg-white/[0.06] border border-white/5 rounded-xl p-4 flex items-center gap-3 hover:bg-white/[0.09] transition-colors group"
          >
            <div className={`w-8 h-8 rounded-lg ${item.bg} flex items-center justify-center flex-shrink-0`}>
              <item.icon size={15} className={item.color} />
            </div>
            <div>
              <p className="text-xs font-medium text-white">{item.label}</p>
            </div>
            <ArrowUpRight size={12} className="text-white/30 group-hover:text-white/60 ml-auto transition-colors" />
          </Link>
        ))}
      </div>
    </div>
  )
}

function KpiCard({
  label, value, sub, color, trend,
}: {
  label: string; value: string; sub?: string; color: string; trend?: number
}) {
  const colorMap: Record<string, string> = {
    blue:  'text-blue-400',
    green: 'text-green-400',
    red:   'text-red-400',
    amber: 'text-amber-400',
    white: 'text-white',
  }
  const borderMap: Record<string, string> = {
    blue:  'border-blue-500/20',
    green: 'border-green-500/20',
    red:   'border-red-500/20',
    amber: 'border-amber-500/20',
    white: 'border-white/5',
  }
  return (
    <div className={`bg-white/[0.06] border ${borderMap[color] ?? 'border-white/5'} rounded-xl p-3`}>
      <p className="text-[10px] font-medium text-white/50 uppercase tracking-wider mb-1.5">{label}</p>
      <div className="flex items-baseline gap-1">
        <p className={`text-base font-bold ${colorMap[color] ?? 'text-white'}`}>{value}</p>
        {trend !== undefined && (
          trend >= 0
            ? <ArrowUpRight size={11} className="text-green-400 flex-shrink-0" />
            : <ArrowDownRight size={11} className="text-red-400 flex-shrink-0" />
        )}
      </div>
      {sub && <p className="text-[10px] text-white/40 mt-1">{sub}</p>}
    </div>
  )
}

function TaxRow({
  label, required, reserved, deadline,
}: {
  label: string; required: number; reserved: number; deadline?: string
}) {
  const gap      = required - reserved
  const pct      = required > 0 ? (reserved / required) * 100 : 100
  const isOk     = gap <= 0 || pct >= 90
  return (
    <div className="py-2 border-b border-white/5 last:border-0">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-white/70">{label}</span>
          {deadline && <span className="text-[10px] text-white/40">— {deadline}</span>}
        </div>
        <span className={`text-xs font-semibold ${isOk ? 'text-green-400' : 'text-red-400'}`}>
          {gap > 0 ? `Gap: ${fmt(gap)}` : 'OK'}
        </span>
      </div>
      <div className="w-full bg-white/5 rounded-full h-1.5">
        <div
          className={`h-1.5 rounded-full transition-all ${isOk ? 'bg-green-500' : pct > 50 ? 'bg-amber-500' : 'bg-red-500'}`}
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
      <div className="flex justify-between mt-0.5">
        <span className="text-[10px] text-white/40">Gereserveerd: {fmt(reserved)}</span>
        <span className="text-[10px] text-white/40">Vereist: {fmt(required)}</span>
      </div>
    </div>
  )
}

function InsightCard({ insight }: { insight: CfoInsight }) {
  const priorityColor = insight.priority === 'kritiek' ? 'text-red-400 border-red-500/20'
    : insight.priority === 'hoog'    ? 'text-amber-400 border-amber-500/20'
    : 'text-blue-400 border-blue-500/20'

  return (
    <div className="border border-white/5 rounded-lg p-3">
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <p className="text-xs font-medium text-white leading-tight">{insight.title}</p>
        <span className={`text-[9px] font-semibold border px-1.5 py-0.5 rounded-full flex-shrink-0 ${priorityColor}`}>
          {insight.priority.toUpperCase()}
        </span>
      </div>
      <p className="text-[11px] text-white/55 leading-relaxed">{insight.body.slice(0, 140)}{insight.body.length > 140 ? '...' : ''}</p>
      {insight.impact_amount && (
        <p className="text-[10px] text-indigo-400 mt-1.5">Impact: {fmt(insight.impact_amount)}</p>
      )}
    </div>
  )
}
