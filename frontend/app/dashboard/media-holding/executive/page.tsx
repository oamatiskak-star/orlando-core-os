'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import {
  Crown, RefreshCw, TrendingUp, Activity, AlertTriangle,
  Eye, Briefcase, Rocket, Sparkles, BarChart3,
} from 'lucide-react'
import { KpiStrip, type Kpi } from '@/components/executive/KpiStrip'
import { AlertFeed } from '@/components/executive/AlertFeed'
import { EmptyState } from '@/components/executive/EmptyState'
import { RecommendationCard, type Recommendation } from '@/components/executive/RecommendationCard'

type ExecutiveKpis = {
  channels_active: number
  views_24h: number
  views_7d: number
  retention_avg_7d: number
  critical_alerts_open: number
  alerts_open_total: number
  recs_pending: number
  revenue_30d: number
  spend_30d: number
  viral_alerts_7d: number
}

function fmt(n: number): string {
  if (!Number.isFinite(n) || n === 0) return '0'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return n.toLocaleString('nl-NL')
}

export default function ExecutiveOverviewPage() {
  const [kpis, setKpis] = useState<ExecutiveKpis | null>(null)
  const [recs, setRecs] = useState<Recommendation[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [approvingAll, setApprovingAll] = useState(false)

  const load = useCallback(async () => {
    setRefreshing(true)
    const [kpisRes, recsRes] = await Promise.all([
      fetch('/api/executive-layer/kpis/executive'),
      fetch('/api/executive-layer/recommendations?status=pending&limit=10'),
    ])
    if (kpisRes.ok) setKpis(await kpisRes.json())
    if (recsRes.ok) {
      const j = await recsRes.json()
      setRecs(j.recommendations ?? [])
    }
    setLoading(false)
    setRefreshing(false)
  }, [])

  const approveAll = useCallback(async () => {
    if (recs.length === 0) return
    setApprovingAll(true)
    try {
      await Promise.all(
        recs.map(r =>
          fetch(`/api/executive-layer/recommendations/${r.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'approved', executed_by: 'orlando' }),
          })
        )
      )
      await load()
    } finally {
      setApprovingAll(false)
    }
  }, [recs, load])

  useEffect(() => {
    load()
    const t = setInterval(load, 60_000)
    return () => clearInterval(t)
  }, [load])

  const kpiItems: Kpi[] = kpis ? [
    { label: 'Active channels', value: kpis.channels_active, icon: <Activity size={12} />, accent: 'violet' },
    { label: 'Views 24h', value: fmt(kpis.views_24h), icon: <Eye size={12} />, accent: 'white' },
    { label: 'Views 7d', value: fmt(kpis.views_7d), icon: <TrendingUp size={12} />, accent: 'white' },
    { label: 'Retention avg 7d', value: kpis.retention_avg_7d > 0 ? `${(kpis.retention_avg_7d * 100).toFixed(0)}%` : '—', icon: <Activity size={12} />, accent: 'indigo' },
    { label: 'Critical alerts', value: kpis.critical_alerts_open, icon: <AlertTriangle size={12} />, accent: kpis.critical_alerts_open > 0 ? 'red' : 'white' },
    { label: 'Open alerts', value: kpis.alerts_open_total, accent: kpis.alerts_open_total > 0 ? 'amber' : 'white' },
    { label: 'Viral alerts 7d', value: kpis.viral_alerts_7d, accent: 'emerald' },
    { label: 'Recs pending', value: kpis.recs_pending, accent: kpis.recs_pending > 0 ? 'violet' : 'white' },
    { label: 'Revenue 30d', value: `€${fmt(kpis.revenue_30d)}`, accent: 'emerald' },
    { label: 'Spend 30d', value: `€${fmt(kpis.spend_30d)}`, accent: 'white' },
  ] : []

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-violet-500/10 border border-violet-400/30 flex items-center justify-center">
            <Crown size={16} className="text-violet-300" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-white/80">Executive Overview</h1>
            <p className="text-[11px] text-white/40 mt-0.5">ATLAS + 5 specialist agents · realtime ecosystem command</p>
          </div>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={refreshing}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] rounded-lg bg-white/[0.04] border border-white/10 hover:bg-white/[0.08] text-white/60 disabled:opacity-40"
        >
          <RefreshCw size={11} className={refreshing ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {loading && !kpis ? (
        <div className="text-xs text-white/40">KPI's laden…</div>
      ) : kpis ? (
        <KpiStrip items={kpiItems} />
      ) : (
        <EmptyState icon={<BarChart3 size={18} />} title="Geen KPI data" hint="v_executive_kpis view geeft geen rij terug — controleer migratie 076." />
      )}

      <div className="flex flex-wrap gap-2">
        <CtaButton href="/dashboard/media-holding/channels" icon={<Rocket size={11} />} label="Launch New Channel" />
        <CtaButton href="/dashboard/media-holding/executive/algorithm" icon={<Sparkles size={11} />} label="Amplify Winner" />
        <CtaButton href="/dashboard/media-holding/factory" icon={<Sparkles size={11} />} label="Generate Viral Batch" />
        <CtaButton href="/dashboard/media-holding/executive/boardroom" icon={<Briefcase size={11} />} label="Open Boardroom" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white/[0.04] rounded-xl border border-white/5 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs font-medium text-white/70 flex items-center gap-2">
              <Sparkles size={12} className="text-violet-300" /> Pending recommendations
            </div>
            <div className="flex items-center gap-2">
              {recs.length > 0 && (
                <button
                  type="button"
                  onClick={approveAll}
                  disabled={approvingAll}
                  className="text-[10px] px-2 py-1 rounded bg-emerald-500/20 border border-emerald-400/30 text-emerald-200 hover:bg-emerald-500/30 disabled:opacity-40"
                >
                  {approvingAll ? 'Approving...' : `Approve all (${recs.length})`}
                </button>
              )}
              <Link href="/dashboard/media-holding/executive/boardroom" className="text-[10px] text-white/40 hover:text-white/60">
                All →
              </Link>
            </div>
          </div>
          {recs.length === 0 ? (
            <EmptyState
              icon={<Sparkles size={18} className="text-white/40" />}
              title="Geen pending recommendations"
              hint="ATLAS draait dagelijks om 07:00. Recommendations verschijnen hier zodra Pending."
            />
          ) : (
            <div className="space-y-2">
              {recs.map(r => (
                <RecommendationCard
                  key={r.id}
                  rec={r}
                  onChange={() => load()}
                />
              ))}
            </div>
          )}
        </div>

        <div className="bg-white/[0.04] rounded-xl border border-white/5 p-4">
          <div className="text-xs font-medium text-white/70 mb-3 flex items-center gap-2">
            <AlertTriangle size={12} className="text-amber-300" /> Live alerts
          </div>
          <AlertFeed limit={10} onlyUnack />
        </div>
      </div>
    </div>
  )
}

function CtaButton({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] rounded-lg bg-violet-500/10 border border-violet-400/20 text-violet-200 hover:bg-violet-500/15"
    >
      {icon}
      {label}
    </Link>
  )
}
