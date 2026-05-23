'use client'

import { useCallback, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Zap, RefreshCw, Sparkles, Activity, Flame, Repeat, Rocket, Crown,
  TrendingUp, Layers, Eye, AlertTriangle,
} from 'lucide-react'
import { SectionCard } from '@/components/executive/SectionCard'
import { KpiTileGrid, type KpiTileItem } from '@/components/executive/KpiTileV2'
import { LiveBadge } from '@/components/executive/LiveBadge'
import { BreakoutCard, type BreakoutItem } from '@/components/executive/BreakoutCard'
import { TrendHeatmap, type TrendCell } from '@/components/executive/TrendHeatmap'
import { AutopilotSwitch, type AutopilotLink } from '@/components/executive/AutopilotSwitch'
import { ActionCTA } from '@/components/executive/ActionCTA'
import { EmptyState } from '@/components/executive/EmptyState'
import { useRealtimeChannel } from '@/lib/realtime'

type SignalsKpis = {
  breakouts_24h: number
  momentum_avg: number
  replay_intensity_24h: number
  recommendation_acceleration: number
  swarm_readiness: number
  decay_24h: number
}

type ViralOpp = {
  id: string
  title: string
  virality_score: number
  view_velocity: number
  retention_score: number
  saturation_score: number
  niche: string | null
  channel_name: string | null
  captured_at: string
}

type StrategyReport = {
  id: string
  title: string
  summary_md: string
  generated_at: string
  sections: unknown
}

type SignalsPayload = {
  kpis: SignalsKpis
  gravity_events: BreakoutItem[]
  viral_opportunities: ViralOpp[]
  trend_signals: TrendCell[]
  autopilot: AutopilotLink[]
  latest_strategy: StrategyReport | null
  generated_at: string
}

type StrategySection = { kind?: string; title?: string; items?: unknown[]; body?: string }

const KPI_TARGETS: Record<keyof SignalsKpis, number> = {
  breakouts_24h: 8,
  momentum_avg: 60,
  replay_intensity_24h: 4,
  recommendation_acceleration: 3,
  swarm_readiness: 70,
  decay_24h: 5,
}

export default function ExecutiveAlgorithmPage() {
  const [data, setData] = useState<SignalsPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [running, setRunning] = useState(false)

  const load = useCallback(async () => {
    setRefreshing(true)
    const res = await fetch('/api/algorithm/signals', { cache: 'no-store' })
    if (res.ok) setData(await res.json())
    setLoading(false)
    setRefreshing(false)
  }, [])

  useEffect(() => {
    load()
    const t = setInterval(load, 60_000)
    return () => clearInterval(t)
  }, [load])

  // Realtime tap: zodra een nieuw gravity_event of executive_alert binnenkomt → re-fetch.
  useRealtimeChannel(
    'algorithm-center',
    [
      { table: 'algorithm_gravity_events', event: 'INSERT' },
      { table: 'executive_alerts', event: 'INSERT' },
    ],
    () => load(),
  )

  const runStrategist = async () => {
    setRunning(true)
    try {
      await fetch('/api/executive-layer/agents/run/algorithm_strategist', { method: 'POST' })
      await load()
    } finally {
      setRunning(false)
    }
  }

  const handleAction = (item: BreakoutItem) => async (kind: 'swarm' | 'clone' | 'push' | 'expand') => {
    const res = await fetch('/api/algorithm/actions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kind,
        gravity_event_id: item.id,
        content_item_id: item.content_item_id,
        niche: item.niche,
        notes: `Dispatched from gravity event ${item.event_type} +${item.magnitude}%`,
      }),
    })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      alert(`Actie mislukt: ${j.error ?? res.statusText}`)
    } else {
      load()
    }
  }

  const toggleAutopilot = async (link_key: string, enabled: boolean) => {
    const res = await fetch('/api/algorithm/autopilot', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ link_key, enabled }),
    })
    if (res.ok) load()
  }

  const kpis: KpiTileItem[] = data ? [
    {
      label: 'Breakouts 24h',
      current: data.kpis.breakouts_24h,
      target: KPI_TARGETS.breakouts_24h,
      icon: <Flame size={12} />,
      accent: data.kpis.breakouts_24h >= KPI_TARGETS.breakouts_24h ? 'breakout' : 'amplify',
      live: true,
    },
    {
      label: 'Momentum avg',
      current: data.kpis.momentum_avg,
      target: KPI_TARGETS.momentum_avg,
      unit: '%',
      icon: <TrendingUp size={12} />,
      accent: 'momentum',
    },
    {
      label: 'Replay spikes',
      current: data.kpis.replay_intensity_24h,
      target: KPI_TARGETS.replay_intensity_24h,
      icon: <Repeat size={12} />,
      accent: 'amplify',
    },
    {
      label: 'Recommendation lift',
      current: data.kpis.recommendation_acceleration,
      target: KPI_TARGETS.recommendation_acceleration,
      icon: <Sparkles size={12} />,
      accent: 'breakout',
      hint: 'content_items met ≥2 events',
    },
    {
      label: 'Swarm readiness',
      current: data.kpis.swarm_readiness,
      target: KPI_TARGETS.swarm_readiness,
      unit: '%',
      icon: <Rocket size={12} />,
      accent: data.kpis.swarm_readiness >= KPI_TARGETS.swarm_readiness ? 'breakout' : 'warn',
    },
  ] : []

  const strategySections = ((data?.latest_strategy?.sections as StrategySection[] | undefined) ?? [])

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-400/30 flex items-center justify-center exec-glow-warn">
            <Zap size={18} className="text-amber-300" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-white/85 flex items-center gap-2">
              Algorithm Intelligence Center
              <LiveBadge tone="warn" />
            </h1>
            <p className="text-[11px] text-white/40 mt-0.5">
              YouTube Algorithm Gravity · Trend Scanner · Algorithm Strategist (Sonnet 4.6 elke 6u)
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ActionCTA
            label="Refresh"
            intent="neutral"
            size="sm"
            icon={<RefreshCw size={11} className={refreshing ? 'animate-spin' : ''} />}
            onClick={load}
          />
          <ActionCTA
            label={running ? 'Strategist runt…' : 'Run Strategist'}
            intent="amplify"
            size="sm"
            icon={<Sparkles size={11} />}
            onClick={runStrategist}
            disabled={running}
          />
        </div>
      </div>

      {loading && !data ? (
        <div className="text-xs text-white/40">Signals laden…</div>
      ) : data ? (
        <>
          <KpiTileGrid items={kpis} />

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            <SectionCard
              className="lg:col-span-3"
              title="Breakout Feed"
              icon={<Activity size={12} />}
              action={<LiveBadge />}
            >
              {data.gravity_events.length === 0 ? (
                <EmptyState
                  icon={<Flame size={18} className="text-white/40" />}
                  title="Geen gravity events"
                  hint="Algorithm Gravity Engine schrijft hier zodra view_velocity >50% stijgt tussen snapshots."
                />
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {data.gravity_events.slice(0, 10).map((g, i) => (
                    <BreakoutCard key={g.id} item={g} index={i} onAction={handleAction(g)} />
                  ))}
                </div>
              )}
            </SectionCard>

            <SectionCard
              className="lg:col-span-2"
              title="Trend Heatmap"
              icon={<TrendingUp size={12} />}
              action={
                <span className="text-[10px] text-white/40">
                  {data.trend_signals.length} signals · update 4u
                </span>
              }
            >
              <TrendHeatmap cells={data.trend_signals} />
            </SectionCard>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            <SectionCard
              className="lg:col-span-3"
              title="Algorithm Strategist Report"
              icon={<Crown size={12} />}
              accent="amplify"
              glow={!!data.latest_strategy}
              action={data.latest_strategy
                ? <span className="text-[10px] text-white/40">{new Date(data.latest_strategy.generated_at).toLocaleString('nl-NL')}</span>
                : null}
            >
              {!data.latest_strategy ? (
                <EmptyState
                  icon={<Sparkles size={18} className="text-white/40" />}
                  title="Nog geen strategy report"
                  hint="Klik Run Strategist om de eerste analyse te draaien — kost ~$0.10."
                />
              ) : (
                <>
                  <h2 className="text-sm font-semibold text-white/90">{data.latest_strategy.title}</h2>
                  <div className="text-xs text-white/65 mt-2 whitespace-pre-wrap leading-relaxed">
                    {data.latest_strategy.summary_md}
                  </div>
                  {strategySections.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 mt-4">
                      {strategySections.map((s, idx) => (
                        <motion.div
                          key={idx}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.05 }}
                          className="bg-white/[0.03] border border-white/5 rounded-lg p-3"
                        >
                          <div className="text-[10px] uppercase tracking-wider text-violet-300/80 mb-1.5">
                            {s.title ?? s.kind?.replace(/_/g, ' ') ?? `Section ${idx + 1}`}
                          </div>
                          {s.body ? (
                            <div className="text-[11px] text-white/70 whitespace-pre-wrap leading-relaxed">
                              {s.body}
                            </div>
                          ) : Array.isArray(s.items) && s.items.length > 0 ? (
                            <ul className="text-[11px] text-white/70 list-disc list-inside space-y-1">
                              {s.items.slice(0, 6).map((it, k) => (
                                <li key={k}>{typeof it === 'string' ? it : JSON.stringify(it)}</li>
                              ))}
                            </ul>
                          ) : (
                            <div className="text-[10px] text-white/30 italic">geen content</div>
                          )}
                        </motion.div>
                      ))}
                    </div>
                  ) : null}
                </>
              )}
            </SectionCard>

            <SectionCard
              className="lg:col-span-2"
              title="Autopilot Switchboard"
              icon={<Layers size={12} />}
              action={
                <span className="text-[10px] text-white/40">
                  {data.autopilot.filter(a => a.enabled).length}/{data.autopilot.length} actief
                </span>
              }
            >
              {data.autopilot.length === 0 ? (
                <EmptyState
                  icon={<AlertTriangle size={18} className="text-amber-400/60" />}
                  title="autopilot_config leeg"
                  hint="Run migratie 064 — autopilot_config moet gravity_to_winner + gravity_to_language bevatten."
                />
              ) : (
                <div className="space-y-2">
                  {data.autopilot.map(link => (
                    <AutopilotSwitch key={link.link_key} link={link} onToggle={toggleAutopilot} />
                  ))}
                </div>
              )}
            </SectionCard>
          </div>

          <SectionCard
            title="Top viral opportunities (7d)"
            icon={<Eye size={12} />}
            action={
              <span className="text-[10px] text-white/40">
                {data.viral_opportunities.length} kandidaten · sortering virality_score
              </span>
            }
          >
            {data.viral_opportunities.length === 0 ? (
              <div className="text-xs text-white/40">Geen viral_opportunities in laatste 7 dagen.</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5">
                {data.viral_opportunities.slice(0, 12).map(v => (
                  <div key={v.id} className="bg-white/[0.03] border border-white/5 rounded-lg p-3 hover:bg-white/[0.06] transition-colors">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="text-[10px] uppercase tracking-wider text-violet-300/70">
                        VIR {v.virality_score} · velocity {Math.round(Number(v.view_velocity))}
                      </div>
                      <div className="text-[10px] text-white/30 shrink-0">
                        {new Date(v.captured_at).toLocaleDateString('nl-NL')}
                      </div>
                    </div>
                    <div className="text-xs text-white/85 line-clamp-2" title={v.title}>{v.title}</div>
                    <div className="text-[10px] text-white/40 mt-1">
                      {v.channel_name ?? '—'}{v.niche ? ` · ${v.niche}` : ''} · retention {v.retention_score} · saturation {v.saturation_score}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          <div className="text-[10px] text-white/30 text-right">
            Signals snapshot {new Date(data.generated_at).toLocaleString('nl-NL')}
          </div>
        </>
      ) : (
        <EmptyState
          icon={<AlertTriangle size={18} className="text-amber-400/60" />}
          title="Geen data"
          hint="/api/algorithm/signals gaf niets terug — controleer Supabase env."
        />
      )}
    </div>
  )
}
