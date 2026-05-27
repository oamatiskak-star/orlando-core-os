'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { ChevronLeft, TrendingUp, TrendingDown, AlertCircle, Target, DollarSign, PieChart, Zap, Eye } from 'lucide-react'
import clsx from 'clsx'

type RevenueMetrics = {
  actual_revenue: number
  target_revenue: number
  variance: number
  variance_percentage: number
  performance_status: 'exceeding' | 'on_track' | 'at_risk' | 'behind'
  projected_final: number
  days_elapsed: number
  days_remaining: number
  daily_run_rate: number
  required_daily_rate: number
}

type AffiliatePerformance = {
  affiliate_id: string
  affiliate_name: string
  total_revenue: number
  total_clicks: number
  total_conversions: number
  conversion_rate: number
  epc: number
  ctr: number
  roi: number
  performance_rank: number
  trend: 'improving' | 'stable' | 'declining'
  recommendation: 'keep' | 'optimize' | 'replace' | 'expand'
}

type ChannelPerformance = {
  channel_id: string
  channel_name: string
  total_revenue: number
  total_affiliates: number
  avg_epc: number
  top_affiliate: string
  conversion_rate: number
  growth_rate: number
  performance_rank: number
  roi: number
}

type CountryPerformance = {
  country_code: string
  country_name: string
  total_revenue: number
  total_clicks: number
  conversion_rate: number
  epc: number
  top_affiliate: string
  top_content_type: string
  growth_potential: 'high' | 'medium' | 'low'
  performance_rank: number
  priority: number
}

type OptimizationRecommendation = {
  recommendation_id: string
  type: 'add_affiliate' | 'remove_affiliate' | 'scale_affiliate' | 'pause_affiliate' | 'adjust_strategy'
  affiliate_id?: string
  channel_id?: string
  country_code?: string
  current_metrics: Record<string, number>
  expected_improvement: {
    revenue_increase_pct: number
    conversion_rate_improvement: number
    epc_improvement: number
  }
  confidence_score: number
  implementation_steps: string[]
  risk_level: 'low' | 'medium' | 'high'
  estimated_timeline_days: number
}

export default function RevenueIntelligencePage() {
  const [metrics, setMetrics] = useState<RevenueMetrics | null>(null)
  const [affiliates, setAffiliates] = useState<AffiliatePerformance[]>([])
  const [channels, setChannels] = useState<ChannelPerformance[]>([])
  const [countries, setCountries] = useState<CountryPerformance[]>([])
  const [recommendations, setRecommendations] = useState<OptimizationRecommendation[]>([])
  const [loading, setLoading] = useState(true)
  const [mrr, setMrr] = useState(0)
  const [arr, setArr] = useState(0)
  const [selectedView, setSelectedView] = useState<'overview' | 'affiliates' | 'channels' | 'countries' | 'recommendations'>('overview')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/media-holding/revenue-intelligence/metrics')
      if (!response.ok) {
        throw new Error('Failed to fetch revenue intelligence data')
      }

      const data = await response.json()

      setMetrics(data.revenue_metrics)
      setAffiliates(data.affiliate_performance || [])
      setChannels(data.channel_performance || [])
      setCountries(data.country_performance || [])
      setRecommendations(data.recommendations || [])
      setMrr(data.summary?.mrr || 0)
      setArr(data.summary?.arr || 0)
    } catch (error) {
      console.error('Error loading revenue intelligence:', error)
      // Fall back to minimal display
      setMetrics({
        actual_revenue: 0,
        target_revenue: 0,
        variance: 0,
        variance_percentage: 0,
        performance_status: 'at_risk',
        projected_final: 0,
        days_elapsed: 0,
        days_remaining: 0,
        daily_run_rate: 0,
        required_daily_rate: 0,
      })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  if (loading) {
    return (
      <div className="p-10 text-center text-xs text-white/40">Laden…</div>
    )
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'exceeding':
        return 'text-emerald-300'
      case 'on_track':
        return 'text-blue-300'
      case 'at_risk':
        return 'text-amber-300'
      case 'behind':
        return 'text-red-300'
      default:
        return 'text-white'
    }
  }

  const getTrendIcon = (trend: string) => {
    if (trend === 'improving') return <TrendingUp size={12} className="text-emerald-400" />
    if (trend === 'declining') return <TrendingDown size={12} className="text-red-400" />
    return <TrendingUp size={12} className="text-white/40" />
  }

  const getRecommendationColor = (rec: string) => {
    switch (rec) {
      case 'expand':
        return 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
      case 'keep':
        return 'bg-blue-500/10 text-blue-300 border-blue-500/20'
      case 'optimize':
        return 'bg-amber-500/10 text-amber-300 border-amber-500/20'
      case 'replace':
        return 'bg-red-500/10 text-red-300 border-red-500/20'
      default:
        return 'bg-white/10 text-white/50'
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/media-holding" className="text-white/40 hover:text-white">
          <ChevronLeft size={16} />
        </Link>
        <div className="w-9 h-9 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-center">
          <DollarSign size={16} className="text-green-400" />
        </div>
        <div>
          <h1 className="text-base font-semibold text-white">Revenue Intelligence</h1>
          <p className="text-xs text-white/50">Goals, affiliate performance, optimization</p>
        </div>
      </div>

      {/* View selector */}
      <div className="flex gap-2 flex-wrap">
        {(['overview', 'affiliates', 'channels', 'countries', 'recommendations'] as const).map((view) => (
          <button
            key={view}
            onClick={() => setSelectedView(view)}
            className={clsx(
              'px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all',
              selectedView === view
                ? 'bg-emerald-500/30 border border-emerald-500/50 text-emerald-200'
                : 'bg-white/[0.06] border border-white/10 text-white/60 hover:bg-white/[0.1]'
            )}
          >
            {view.charAt(0).toUpperCase() + view.slice(1).replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* OVERVIEW */}
      {selectedView === 'overview' && metrics && (
        <div className="space-y-4">
          {/* Monthly metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Kpi label="Target Revenue" value={`€${metrics.target_revenue.toLocaleString('nl-NL')}`} color="text-blue-300" icon={<Target size={11} />} />
            <Kpi label="Actual Revenue" value={`€${metrics.actual_revenue.toLocaleString('nl-NL')}`} color="text-emerald-300" icon={<TrendingUp size={11} />} />
            <Kpi label="Variance" value={`${metrics.variance_percentage > 0 ? '+' : ''}${metrics.variance_percentage.toFixed(1)}%`} color={metrics.variance_percentage > 0 ? 'text-emerald-300' : 'text-red-300'} icon={<Eye size={11} />} />
            <Kpi label="Status" value={metrics.performance_status.toUpperCase()} color={getStatusColor(metrics.performance_status)} icon={<AlertCircle size={11} />} />
          </div>

          {/* Progress bar */}
          <div className="bg-white/[0.04] border border-white/8 rounded-xl p-4">
            <div className="flex justify-between mb-2">
              <span className="text-xs text-white/60">Monthly progress</span>
              <span className="text-xs text-white/40">{metrics.days_elapsed} / {metrics.days_elapsed + metrics.days_remaining} days</span>
            </div>
            <div className="w-full bg-white/10 rounded-full h-2">
              <div
                className="bg-emerald-500 h-2 rounded-full"
                style={{ width: `${(metrics.actual_revenue / metrics.target_revenue) * 100}%` }}
              />
            </div>
            <div className="text-xs text-white/50 mt-2">
              Daily run rate: <span className="text-amber-300 font-semibold">€{metrics.daily_run_rate.toFixed(0)}</span> | Required: <span className="text-white/60">€{metrics.required_daily_rate.toFixed(0)}</span>
            </div>
          </div>

          {/* Projected & MRR/ARR */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Kpi label="Projected Final" value={`€${metrics.projected_final.toLocaleString('nl-NL')}`} color="text-violet-300" icon={<Zap size={11} />} />
            <Kpi label="MRR" value={`€${mrr.toLocaleString('nl-NL')}`} color="text-green-300" icon={<DollarSign size={11} />} />
            <Kpi label="ARR" value={`€${(arr / 1000).toFixed(0)}k`} color="text-green-300" icon={<DollarSign size={11} />} />
            <Kpi label="Growth" value={`${(((arr - mrr) / mrr) * 100).toFixed(1)}%`} color="text-amber-300" icon={<TrendingUp size={11} />} />
          </div>

          {/* Top performers vs bottom performers */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white/[0.04] border border-white/8 rounded-xl p-4">
              <h3 className="text-xs font-semibold text-emerald-300 uppercase tracking-wide mb-3 flex items-center gap-2">
                <TrendingUp size={12} /> Top Affiliates
              </h3>
              <div className="space-y-2">
                {affiliates.slice(0, 3).map((aff) => (
                  <div key={aff.affiliate_id} className="flex justify-between items-start p-2 rounded bg-white/[0.02]">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-white truncate">{aff.affiliate_name}</p>
                      <p className="text-[10px] text-white/50">ROI: {aff.roi.toFixed(1)}x • {aff.conversion_rate.toFixed(1)}% conv</p>
                    </div>
                    <div className="text-right ml-2 shrink-0">
                      <p className="text-xs font-semibold text-emerald-300">€{aff.total_revenue.toLocaleString('nl-NL')}</p>
                      <div className="flex items-center gap-1 justify-end text-[10px] text-white/50">
                        {getTrendIcon(aff.trend)}
                        <span>{aff.trend}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white/[0.04] border border-white/8 rounded-xl p-4">
              <h3 className="text-xs font-semibold text-red-300 uppercase tracking-wide mb-3 flex items-center gap-2">
                <AlertCircle size={12} /> At Risk / Underperforming
              </h3>
              <div className="space-y-2">
                {affiliates.filter((a) => a.roi < 1.5 || a.trend === 'declining').map((aff) => (
                  <div key={aff.affiliate_id} className="flex justify-between items-start p-2 rounded bg-white/[0.02]">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-white truncate">{aff.affiliate_name}</p>
                      <p className={clsx('text-[10px]', aff.roi < 1 ? 'text-red-400' : 'text-amber-400')}>
                        ROI: {aff.roi.toFixed(1)}x • {aff.recommendation}
                      </p>
                    </div>
                    <div className="text-right ml-2 shrink-0">
                      <p className="text-xs font-semibold text-white/70">€{aff.total_revenue.toLocaleString('nl-NL')}</p>
                      <div className="flex items-center gap-1 justify-end text-[10px] text-red-400">
                        {getTrendIcon(aff.trend)}
                        <span>{aff.trend}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AFFILIATES */}
      {selectedView === 'affiliates' && (
        <div className="space-y-2">
          {affiliates.map((aff) => (
            <div key={aff.affiliate_id} className="bg-white/[0.04] border border-white/8 rounded-xl p-4">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="text-sm font-semibold text-white">{aff.affiliate_name}</h3>
                  <p className="text-[10px] text-white/50">#{aff.performance_rank} rank</p>
                </div>
                <div className={clsx('px-2.5 py-1 rounded border text-[10px] font-medium', getRecommendationColor(aff.recommendation))}>
                  {aff.recommendation.toUpperCase()}
                </div>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                <Stat label="Revenue" value={`€${aff.total_revenue.toLocaleString('nl-NL')}`} />
                <Stat label="Clicks" value={aff.total_clicks.toLocaleString('nl-NL')} />
                <Stat label="Conversions" value={aff.total_conversions.toLocaleString('nl-NL')} />
                <Stat label="Conv. Rate" value={`${aff.conversion_rate.toFixed(1)}%`} color="text-violet-300" />
                <Stat label="EPC" value={`€${aff.epc.toFixed(2)}`} color="text-amber-300" />
                <Stat label="ROI" value={`${aff.roi.toFixed(1)}x`} color={aff.roi > 2 ? 'text-emerald-300' : aff.roi > 1 ? 'text-amber-300' : 'text-red-300'} />
              </div>
              <div className="mt-3 flex items-center gap-2 pt-3 border-t border-white/5">
                <span className="text-[10px] text-white/50">Trend:</span>
                <div className="flex items-center gap-1">
                  {getTrendIcon(aff.trend)}
                  <span className="text-xs text-white/60">{aff.trend}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* CHANNELS */}
      {selectedView === 'channels' && (
        <div className="space-y-2">
          {channels.map((ch) => (
            <div key={ch.channel_id} className="bg-white/[0.04] border border-white/8 rounded-xl p-4">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="text-sm font-semibold text-white">{ch.channel_name}</h3>
                  <p className="text-[10px] text-white/50">Top: {ch.top_affiliate}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-emerald-300">€{ch.total_revenue.toLocaleString('nl-NL')}</p>
                  <p className={clsx('text-[10px]', ch.growth_rate > 15 ? 'text-emerald-300' : 'text-white/50')}>
                    {ch.growth_rate > 0 ? '+' : ''}{ch.growth_rate.toFixed(1)}% growth
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                <Stat label="Affiliates" value={ch.total_affiliates.toLocaleString('nl-NL')} />
                <Stat label="Avg EPC" value={`€${ch.avg_epc.toFixed(2)}`} color="text-amber-300" />
                <Stat label="Conv. Rate" value={`${ch.conversion_rate.toFixed(1)}%`} color="text-violet-300" />
                <Stat label="ROI" value={`${ch.roi.toFixed(1)}x`} color={ch.roi > 2 ? 'text-emerald-300' : 'text-amber-300'} />
                <Stat label="Rank" value={`#${ch.performance_rank}`} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* COUNTRIES */}
      {selectedView === 'countries' && (
        <div className="space-y-2">
          {countries.map((c) => (
            <div key={c.country_code} className="bg-white/[0.04] border border-white/8 rounded-xl p-4">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="text-sm font-semibold text-white">{c.country_name}</h3>
                  <p className="text-[10px] text-white/50">Top: {c.top_affiliate} • {c.top_content_type}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-emerald-300">€{c.total_revenue.toLocaleString('nl-NL')}</p>
                  <p className={clsx('text-[10px]', c.growth_potential === 'high' ? 'text-emerald-300' : 'text-white/50')}>
                    {c.growth_potential} potential
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                <Stat label="Clicks" value={c.total_clicks.toLocaleString('nl-NL')} />
                <Stat label="Conv. Rate" value={`${c.conversion_rate.toFixed(1)}%`} color="text-violet-300" />
                <Stat label="EPC" value={`€${c.epc.toFixed(2)}`} color="text-amber-300" />
                <Stat label="Priority" value={c.priority.toLocaleString('nl-NL')} />
                <Stat label="Rank" value={`#${c.performance_rank}`} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* RECOMMENDATIONS */}
      {selectedView === 'recommendations' && (
        <div className="space-y-3">
          {recommendations.map((rec) => (
            <div key={rec.recommendation_id} className={clsx(
              'rounded-xl p-4 border',
              rec.type === 'scale_affiliate' ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-red-500/10 border-red-500/20'
            )}>
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className={clsx('text-sm font-semibold', rec.type === 'scale_affiliate' ? 'text-emerald-300' : 'text-red-300')}>
                    {rec.type === 'scale_affiliate' ? 'SCALE' : 'REMOVE'} {rec.affiliate_id}
                  </h3>
                  <p className="text-[10px] text-white/50">Confidence: {(rec.confidence_score * 100).toFixed(0)}% • Risk: {rec.risk_level}</p>
                </div>
                <div className="text-right">
                  <p className={clsx('text-sm font-semibold', rec.type === 'scale_affiliate' ? 'text-emerald-300' : 'text-red-300')}>
                    {rec.expected_improvement.revenue_increase_pct > 0 ? '+' : ''}{rec.expected_improvement.revenue_increase_pct}% revenue
                  </p>
                  <p className="text-[10px] text-white/50">{rec.estimated_timeline_days} days</p>
                </div>
              </div>
              <div className="bg-black/30 rounded p-2 mb-3">
                <p className="text-[10px] text-white/60 font-mono">
                  Current: ROI {rec.current_metrics.roi?.toFixed(2) || 'N/A'}x • Conv {rec.current_metrics.conversion_rate?.toFixed(1) || 'N/A'}%
                </p>
              </div>
              <div>
                <p className="text-[10px] text-white/40 uppercase tracking-wide mb-2">Implementation steps</p>
                <ul className="text-[10px] text-white/60 space-y-1">
                  {rec.implementation_steps.map((step, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-white/30 shrink-0">•</span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Kpi({ label, value, color, icon }: { label: string; value: string; color: string; icon?: React.ReactNode }) {
  return (
    <div className="bg-white/[0.04] border border-white/8 rounded-xl p-3">
      <div className="flex items-center gap-1 text-[9px] text-white/40 uppercase tracking-wide mb-1">
        {icon}<span>{label}</span>
      </div>
      <p className={`text-sm font-semibold tabular-nums ${color}`}>{value}</p>
    </div>
  )
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <p className="text-[9px] text-white/35 uppercase">{label}</p>
      <p className={`text-xs font-semibold tabular-nums ${color || 'text-white'}`}>{value}</p>
    </div>
  )
}
