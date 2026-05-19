'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Activity, ChevronLeft } from 'lucide-react'
import clsx from 'clsx'

type Kpis = {
  channels:           { total: number; by_status: Record<string, number> }
  viral_opportunities:{ total: number; top: Array<{ id: string; title?: string; virality_score: number }> }
  content:            { total: number; by_status: Record<string, number> }
  uploads:            { total: number; by_status: Record<string, number> }
  metrics:            { total_views: number; total_revenue: number }
  workers:            { total: number; by_status: Record<string, number>; list: Array<{ name: string; status: string; kind: string; last_seen: string | null }> }
  sponsors:           { total: number }
  affiliates:         { total: number }
  monetization:       { monthly_revenue_active: number }
}

export default function MediaHoldingDashboard() {
  const [kpis, setKpis] = useState<Kpis | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/media-holding/dashboard/kpis')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { setKpis(j); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/media-holding" className="text-white/40 hover:text-white">
          <ChevronLeft size={16} />
        </Link>
        <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
          <Activity size={16} className="text-indigo-400" />
        </div>
        <div>
          <h1 className="text-base font-semibold text-white">Media Holding KPI Dashboard</h1>
          <p className="text-xs text-white/50">Holding-wide operationele KPIs</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Total views" value={loading ? '…' : (kpis?.metrics.total_views ?? 0).toLocaleString('nl-NL')} color="text-white" />
        <Stat label="Total revenue (snapshot)" value={loading ? '…' : `€ ${(kpis?.metrics.total_revenue ?? 0).toFixed(2)}`} color="text-emerald-300" />
        <Stat label="Active monthly revenue" value={loading ? '…' : `€ ${(kpis?.monetization.monthly_revenue_active ?? 0).toLocaleString('nl-NL', { minimumFractionDigits: 2 })}`} color="text-amber-300" />
        <Stat label="Viral opportunities" value={loading ? '…' : (kpis?.viral_opportunities.total ?? 0).toString()} color="text-indigo-300" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Panel title="Channels per status">
          {kpis && Object.keys(kpis.channels.by_status ?? {}).length > 0 ? (
            <ul className="space-y-1">
              {Object.entries(kpis.channels.by_status).map(([s, n]) => (
                <li key={s} className="flex justify-between text-xs">
                  <span className="text-white/65">{s}</span>
                  <span className="text-white/85 font-medium">{n}</span>
                </li>
              ))}
            </ul>
          ) : <Empty>Geen kanalen geïncubateerd.</Empty>}
        </Panel>

        <Panel title="Workers">
          {kpis && (kpis.workers.list?.length ?? 0) > 0 ? (
            <ul className="space-y-1">
              {kpis.workers.list.map((w) => (
                <li key={w.name} className="flex justify-between text-xs">
                  <span className="text-white/65">{w.name}</span>
                  <span className={clsx(
                    'px-1.5 rounded text-[10px]',
                    w.status === 'idle'    ? 'bg-emerald-500/10 text-emerald-300' :
                    w.status === 'running' ? 'bg-amber-500/10 text-amber-300' :
                    w.status === 'offline' ? 'bg-white/[0.06] text-white/40' :
                    w.status === 'error'   ? 'bg-red-500/10 text-red-400' :
                                              'bg-white/[0.08] text-white/55',
                  )}>{w.status}</span>
                </li>
              ))}
            </ul>
          ) : <Empty>Geen workers geregistreerd.</Empty>}
        </Panel>

        <Panel title="Content per status">
          {kpis && Object.keys(kpis.content.by_status ?? {}).length > 0 ? (
            <ul className="space-y-1">
              {Object.entries(kpis.content.by_status).map(([s, n]) => (
                <li key={s} className="flex justify-between text-xs">
                  <span className="text-white/65">{s}</span>
                  <span className="text-white/85 font-medium">{n}</span>
                </li>
              ))}
            </ul>
          ) : <Empty>Content Factory nog niet actief.</Empty>}
        </Panel>

        <Panel title="Top viral opportunities">
          {kpis && (kpis.viral_opportunities.top?.length ?? 0) > 0 ? (
            <ul className="space-y-1">
              {kpis.viral_opportunities.top.map((o) => (
                <li key={o.id} className="flex justify-between text-xs gap-2">
                  <span className="text-white/85 truncate max-w-[260px]">{o.title ?? '(geen titel)'}</span>
                  <span className="text-indigo-300 font-semibold shrink-0">{o.virality_score}</span>
                </li>
              ))}
            </ul>
          ) : <Empty>Geen viral kansen — start eerst een scan.</Empty>}
        </Panel>
      </div>
    </div>
  )
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-white/[0.06] border border-white/5 rounded-xl p-4">
      <p className="text-[11px] text-white/50 mb-1">{label}</p>
      <p className={`text-2xl font-semibold ${color}`}>{value}</p>
    </div>
  )
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white/[0.06] border border-white/5 rounded-xl p-4">
      <p className="text-[11px] text-white/50 uppercase tracking-wider mb-3">{title}</p>
      {children}
    </div>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] text-white/40 italic">{children}</p>
}
