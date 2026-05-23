'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import {
  Crown, RefreshCw, TrendingUp, Activity, AlertTriangle,
  Eye, Briefcase, Rocket, Sparkles, BarChart3, Wallet, Zap,
} from 'lucide-react'
import { KpiTileGrid, type KpiTileItem } from '@/components/executive/KpiTileV2'
import { AlertFeed } from '@/components/executive/AlertFeed'
import { EmptyState } from '@/components/executive/EmptyState'
import { RecommendationCard, type Recommendation } from '@/components/executive/RecommendationCard'
import { SectionCard } from '@/components/executive/SectionCard'
import { LiveBadge } from '@/components/executive/LiveBadge'
import { ActionCTA } from '@/components/executive/ActionCTA'
import { useRealtimeChannel } from '@/lib/realtime'

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

type Target = { metric: string; target_value: number; period: string; channel_id: string | null }

export default function ExecutiveOverviewPage() {
  const [kpis, setKpis] = useState<ExecutiveKpis | null>(null)
  const [recs, setRecs] = useState<Recommendation[]>([])
  const [targets, setTargets] = useState<Target[]>([])
  const [atlasReport, setAtlasReport] = useState<{ id: string; title: string; summary_md: string; generated_at: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    setRefreshing(true)
    const [kpisRes, recsRes, targetsRes, atlasRes] = await Promise.all([
      fetch('/api/executive-layer/kpis/executive', { cache: 'no-store' }),
      fetch('/api/executive-layer/recommendations?status=pending&limit=10', { cache: 'no-store' }),
      fetch('/api/algorithm/targets', { cache: 'no-store' }).catch(() => null),
      fetch('/api/executive-layer/reports?kind=daily_briefing&limit=1', { cache: 'no-store' }),
    ])
    if (kpisRes.ok) setKpis(await kpisRes.json())
    if (recsRes.ok) {
      const j = await recsRes.json()
      setRecs(j.recommendations ?? [])
    }
    if (targetsRes && targetsRes.ok) {
      const j = await targetsRes.json()
      setTargets(j.targets ?? [])
    }
    if (atlasRes.ok) {
      const j = await atlasRes.json()
      setAtlasReport((j.reports ?? [])[0] ?? null)
    }
    setLoading(false)
    setRefreshing(false)
  }, [])

  useEffect(() => {
    load()
    const t = setInterval(load, 60_000)
    return () => clearInterval(t)
  }, [load])

  useRealtimeChannel(
    'executive-overview',
    [
      { table: 'executive_alerts', event: 'INSERT' },
      { table: 'executive_recommendations', event: '*' },
    ],
    () => load(),
  )

  const targetFor = (metric: string): number | undefined => {
    const ecoTarget = targets.find(t => t.metric === metric && t.channel_id === null)
    return ecoTarget?.target_value
  }

  const kpiItems: KpiTileItem[] = kpis ? [
    {
      label: 'Active channels', current: kpis.channels_active, icon: <Activity size={12} />, accent: 'amplify',
    },
    {
      label: 'Views 24h', current: kpis.views_24h, target: targetFor('views_24h') ?? 25000,
      icon: <Eye size={12} />, accent: 'neutral', live: true,
    },
    {
      label: 'Views 7d', current: kpis.views_7d, target: targetFor('views_7d') ?? 175000,
      icon: <TrendingUp size={12} />, accent: 'neutral',
    },
    {
      label: 'Retention avg 7d', current: kpis.retention_avg_7d * 100, unit: '%',
      target: (targetFor('retention_avg') ?? 0.55) * 100,
      icon: <Activity size={12} />, accent: 'momentum',
    },
    {
      label: 'Critical alerts', current: kpis.critical_alerts_open,
      icon: <AlertTriangle size={12} />, accent: kpis.critical_alerts_open > 0 ? 'decay' : 'neutral',
      live: kpis.critical_alerts_open > 0, invertGood: true,
    },
    {
      label: 'Open alerts', current: kpis.alerts_open_total,
      accent: kpis.alerts_open_total > 0 ? 'warn' : 'neutral', invertGood: true,
    },
    {
      label: 'Viral alerts 7d', current: kpis.viral_alerts_7d, accent: 'breakout',
    },
    {
      label: 'Recs pending', current: kpis.recs_pending, accent: kpis.recs_pending > 0 ? 'amplify' : 'neutral',
    },
    {
      label: 'Revenue 30d', current: kpis.revenue_30d, unit: '€',
      target: targetFor('revenue_30d'), accent: 'breakout',
    },
    {
      label: 'Spend 30d', current: kpis.spend_30d, unit: '€', accent: 'neutral', invertGood: true,
    },
  ] : []

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-400/30 flex items-center justify-center exec-glow-amplify">
            <Crown size={18} className="text-violet-300" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-white/85 flex items-center gap-2">
              Executive Overview
              <LiveBadge tone="amplify" />
            </h1>
            <p className="text-[11px] text-white/40 mt-0.5">
              ATLAS + 5 specialist agents · realtime ecosystem command · target overlay live
            </p>
          </div>
        </div>
        <ActionCTA
          label="Refresh"
          intent="neutral"
          size="sm"
          icon={<RefreshCw size={11} className={refreshing ? 'animate-spin' : ''} />}
          onClick={load}
        />
      </div>

      {loading && !kpis ? (
        <div className="text-xs text-white/40">KPI's laden…</div>
      ) : kpis ? (
        <KpiTileGrid items={kpiItems} />
      ) : (
        <EmptyState
          icon={<BarChart3 size={18} />}
          title="Geen KPI data"
          hint="v_executive_kpis view geeft geen rij terug — controleer migratie 076."
        />
      )}

      <div className="flex flex-wrap gap-2">
        <CtaLink href="/dashboard/media-holding/channels" icon={<Rocket size={11} />} label="Launch New Channel" />
        <CtaLink href="/dashboard/media-holding/executive/algorithm" icon={<Zap size={11} />} label="Algorithm Center" />
        <CtaLink href="/dashboard/media-holding/factory" icon={<Sparkles size={11} />} label="Generate Viral Batch" />
        <CtaLink href="/dashboard/media-holding/executive/boardroom" icon={<Briefcase size={11} />} label="Open Boardroom" />
        <CtaLink href="/dashboard/media-holding/executive/fund" icon={<Wallet size={11} />} label="Content Fund" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <SectionCard
          className="lg:col-span-2"
          title="Pending recommendations"
          icon={<Sparkles size={12} className="text-violet-300" />}
          accent="amplify"
          action={
            <Link href="/dashboard/media-holding/executive/boardroom" className="text-[10px] text-white/40 hover:text-white/60">
              All →
            </Link>
          }
        >
          {recs.length === 0 ? (
            <EmptyState
              icon={<Sparkles size={18} className="text-white/40" />}
              title="Geen pending recommendations"
              hint="ATLAS draait dagelijks om 07:00. Recommendations verschijnen hier zodra Pending."
            />
          ) : (
            <div className="space-y-2">
              {recs.map(r => (
                <RecommendationCard key={r.id} rec={r} onChange={() => load()} />
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="Live alerts"
          icon={<AlertTriangle size={12} className="text-amber-300" />}
          accent="warn"
          action={<LiveBadge tone="warn" />}
        >
          <AlertFeed limit={10} onlyUnack />
        </SectionCard>
      </div>

      <SectionCard
        title="ATLAS commentary"
        icon={<Crown size={12} className="text-violet-300" />}
        accent="amplify"
        glow={!!atlasReport}
        action={atlasReport
          ? <span className="text-[10px] text-white/40">{new Date(atlasReport.generated_at).toLocaleString('nl-NL')}</span>
          : null}
      >
        {atlasReport ? (
          <div>
            <h3 className="text-sm font-semibold text-white/90">{atlasReport.title}</h3>
            <div className="text-xs text-white/65 mt-2 whitespace-pre-wrap leading-relaxed">{atlasReport.summary_md}</div>
          </div>
        ) : (
          <EmptyState
            icon={<Crown size={18} className="text-violet-300/60" />}
            title="ATLAS heeft nog geen daily briefing"
            hint="Trigger handmatig via /api/executive-layer/agents/run/atlas (kost ~$0.30)."
          />
        )}
      </SectionCard>
    </div>
  )
}

function CtaLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
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
