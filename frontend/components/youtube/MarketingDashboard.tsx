'use client'

import React, { useEffect, useState } from 'react'

interface KPI {
  views24h: number
  views7d: number
  viewsAllTime: number
  growthRate: number
  viralMomentum: number
  healthScore: number
  healthStatus: string
  revenue24h: number
  revenue7d: number
  avgCTR: string
  businessPlan: {
    target: number
    current: number
    progressPercent: number
    daysRemaining: number
    dailyNeeded: number
    status: string
    statusEmoji: string
    onTrack: boolean
    deadline: string
  }
}

interface Recommendation {
  id: string
  title: string
  type: string
  priority: number
  confidence: string
  estimatedImpact: string
}

interface ABTest {
  id: string
  type: string
  status: string
  variantA: string
  variantB: string
  viewsA: number
  viewsB: number
}

interface Alert {
  level: 'critical' | 'warning' | 'info'
  message: string
  action: string
}

export function MarketingDashboard({ channelId }: { channelId: string }) {
  const [kpis, setKpis] = useState<KPI | null>(null)
  const [recommendations, setRecommendations] = useState<Recommendation[]>([])
  const [abTests, setAbTests] = useState<ABTest[]>([])
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const kpiRes = await fetch(
          `/api/youtube/marketing/dashboard-kpis?channelId=${channelId}`
        )
        const kpiData = await kpiRes.json()
        setKpis(kpiData.kpis)
        setRecommendations(kpiData.recommendations.active)
        setAbTests(kpiData.abTests.active)
        setAlerts(kpiData.alerts)
      } catch (err) {
        console.error('Failed to fetch KPIs:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchData()

    // Refresh every 5 minutes
    const interval = setInterval(fetchData, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [channelId])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-xl text-gray-600">Loading marketing dashboard...</div>
      </div>
    )
  }

  if (!kpis) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-xl text-gray-600">No data available</div>
      </div>
    )
  }

  const progressColor =
    kpis.businessPlan.progressPercent >= 75
      ? 'bg-green-500'
      : kpis.businessPlan.progressPercent >= 50
        ? 'bg-yellow-500'
        : 'bg-red-500'

  return (
    <div className="w-full bg-gradient-to-br from-slate-900 to-slate-800 p-8 rounded-xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">🎬 Marketing Orchestration</h1>
        <p className="text-gray-400">AI-powered growth toward 840k views goal</p>
      </div>

      {/* Critical Alerts */}
      {alerts.length > 0 && (
        <div className="mb-6 space-y-2">
          {alerts.map((alert, idx) => (
            <div
              key={idx}
              className={`p-4 rounded-lg border-l-4 ${
                alert.level === 'critical'
                  ? 'bg-red-900/20 border-red-500 text-red-200'
                  : alert.level === 'warning'
                    ? 'bg-yellow-900/20 border-yellow-500 text-yellow-200'
                    : 'bg-blue-900/20 border-blue-500 text-blue-200'
              }`}
            >
              <div className="font-semibold">{alert.message}</div>
              <div className="text-sm opacity-80">→ {alert.action}</div>
            </div>
          ))}
        </div>
      )}

      {/* Business Plan Status */}
      <div className="mb-8 bg-slate-700/50 p-6 rounded-lg border border-slate-600">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-white">
              {kpis.businessPlan.statusEmoji} 840K Views Business Plan
            </h2>
            <p className="text-gray-400">
              Status: {kpis.businessPlan.status} | Deadline: {kpis.businessPlan.deadline}
            </p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-white">
              {Math.round(kpis.businessPlan.current).toLocaleString()}
            </div>
            <div className="text-sm text-gray-400">
              of {(kpis.businessPlan.target / 1000).toFixed(0)}K views
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-4">
          <div className="flex justify-between mb-2">
            <span className="text-sm font-semibold text-white">Progress</span>
            <span className="text-sm font-bold text-white">
              {kpis.businessPlan.progressPercent.toFixed(1)}%
            </span>
          </div>
          <div className="w-full bg-slate-600 rounded-full h-2 overflow-hidden">
            <div
              className={`h-full ${progressColor} transition-all duration-500`}
              style={{ width: `${Math.min(kpis.businessPlan.progressPercent, 100)}%` }}
            />
          </div>
        </div>

        {/* Daily Metrics */}
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-slate-600/50 p-3 rounded">
            <div className="text-xs text-gray-400 mb-1">Days Remaining</div>
            <div className="text-2xl font-bold text-white">
              {kpis.businessPlan.daysRemaining}
            </div>
          </div>
          <div className="bg-slate-600/50 p-3 rounded">
            <div className="text-xs text-gray-400 mb-1">Daily Needed</div>
            <div className="text-2xl font-bold text-white">
              {(kpis.businessPlan.dailyNeeded / 1000).toFixed(0)}K
            </div>
          </div>
          <div className="bg-slate-600/50 p-3 rounded">
            <div className="text-xs text-gray-400 mb-1">Growth Rate</div>
            <div className="text-2xl font-bold text-white">
              {kpis.growthRate > 0 ? '+' : ''}{kpis.growthRate.toFixed(1)}%
            </div>
          </div>
          <div className="bg-slate-600/50 p-3 rounded">
            <div className="text-xs text-gray-400 mb-1">Health Score</div>
            <div className="text-2xl font-bold text-white">{kpis.healthScore}/100</div>
          </div>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 gap-6 mb-8">
        <div className="bg-slate-700/50 p-6 rounded-lg border border-slate-600">
          <h3 className="text-lg font-semibold text-white mb-4">📊 Views</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-400">Last 24h</span>
              <span className="text-white font-bold">{kpis.views24h.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Last 7d</span>
              <span className="text-white font-bold">{kpis.views7d.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">All-time</span>
              <span className="text-white font-bold">
                {kpis.viewsAllTime.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-slate-700/50 p-6 rounded-lg border border-slate-600">
          <h3 className="text-lg font-semibold text-white mb-4">💰 Revenue</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-400">Last 24h</span>
              <span className="text-white font-bold">
                ${kpis.revenue24h.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Last 7d</span>
              <span className="text-white font-bold">
                ${kpis.revenue7d.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Avg CTR</span>
              <span className="text-white font-bold">{kpis.avgCTR}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Recommendations Feed */}
      {recommendations.length > 0 && (
        <div className="mb-8 bg-slate-700/50 p-6 rounded-lg border border-slate-600">
          <h2 className="text-xl font-bold text-white mb-4">💡 Active Recommendations</h2>
          <div className="space-y-3">
            {recommendations.map(rec => (
              <div
                key={rec.id}
                className="bg-slate-600/50 p-4 rounded border border-slate-500 hover:border-slate-400 transition"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <h4 className="font-semibold text-white">{rec.title}</h4>
                    <p className="text-sm text-gray-400 mt-1">Type: {rec.type}</p>
                  </div>
                  <div className="text-right">
                    <div className="inline-block px-3 py-1 bg-blue-900/50 text-blue-200 rounded text-sm font-semibold">
                      {rec.confidence} confidence
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-sm">
                    <span className="text-gray-400">Impact: </span>
                    <span className="text-green-400 font-semibold">{rec.estimatedImpact}</span>
                  </div>
                  <button
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded text-sm font-semibold transition"
                    onClick={() => alert(`Execute: ${rec.id}`)}
                  >
                    Execute
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* A/B Tests Monitor */}
      {abTests.length > 0 && (
        <div className="bg-slate-700/50 p-6 rounded-lg border border-slate-600">
          <h2 className="text-xl font-bold text-white mb-4">🧪 Active A/B Tests</h2>
          <div className="space-y-4">
            {abTests.map(test => {
              const total = (test.viewsA || 0) + (test.viewsB || 0)
              const pctA = total > 0 ? ((test.viewsA || 0) / total) * 100 : 50
              const pctB = total > 0 ? ((test.viewsB || 0) / total) * 100 : 50

              return (
                <div key={test.id} className="bg-slate-600/50 p-4 rounded border border-slate-500">
                  <div className="mb-3">
                    <h4 className="font-semibold text-white text-sm mb-2">
                      {test.type.toUpperCase()} Test
                    </h4>
                    <div className="grid grid-cols-2 gap-4 text-xs mb-3">
                      <div>
                        <div className="text-gray-400">Variant A</div>
                        <div className="text-white font-semibold">{test.variantA}</div>
                      </div>
                      <div>
                        <div className="text-gray-400">Variant B</div>
                        <div className="text-white font-semibold">{test.variantB}</div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-gray-400">Variant A: {test.viewsA} views</span>
                      <span className="text-white font-bold">{pctA.toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-slate-700 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-blue-500 h-full"
                        style={{ width: `${pctA}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-xs mb-1 mt-2">
                      <span className="text-gray-400">Variant B: {test.viewsB} views</span>
                      <span className="text-white font-bold">{pctB.toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-slate-700 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-green-500 h-full"
                        style={{ width: `${pctB}%` }}
                      />
                    </div>
                  </div>

                  {pctB > pctA + 10 && (
                    <div className="mt-3 p-2 bg-green-900/20 border border-green-500/50 rounded text-xs text-green-300">
                      ✅ Variant B winning ({(pctB - pctA).toFixed(1)}% lead)
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
