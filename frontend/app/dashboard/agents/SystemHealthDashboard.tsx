'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle, TrendingUp } from 'lucide-react'
import { generateSummaryReport } from '@/lib/organization/analytics'

interface HealthReport {
  timestamp: string
  agents: any
  tasks: any
  workers: any
  health: {
    system_healthy: boolean
    warning_signals: string[]
  }
}

export default function SystemHealthDashboard() {
  const [report, setReport] = useState<HealthReport | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)

        // Fetch all data
        const [agentsRes, tasksRes, workersRes] = await Promise.all([
          fetch('/api/organization/agents?limit=1000'),
          fetch('/api/organization/tasks?limit=1000'),
          fetch('/api/organization/workers?limit=1000'),
        ])

        const agentsData = await agentsRes.json()
        const tasksData = await tasksRes.json()
        const workersData = await workersRes.json()

        const newReport = generateSummaryReport(
          agentsData.agents || [],
          tasksData.tasks || [],
          workersData.workers || []
        )

        setReport(newReport)
      } catch (err) {
        console.error('Failed to fetch health data:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchData()

    // Refresh every minute
    const interval = setInterval(fetchData, 60000)
    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return (
      <div className="bg-white/[0.06] border border-white/5 rounded-xl p-5 flex items-center justify-center min-h-32">
        <p className="text-xs text-white/50">Loading system health...</p>
      </div>
    )
  }

  if (!report) {
    return (
      <div className="bg-white/[0.06] border border-white/5 rounded-xl p-5">
        <p className="text-xs text-white/50">Failed to load health data</p>
      </div>
    )
  }

  const { agents, tasks, workers, health } = report

  return (
    <div className="space-y-4">
      {/* System Status */}
      <div
        className={`border rounded-xl p-5 ${
          health.system_healthy
            ? 'bg-emerald-500/10 border-emerald-500/20'
            : 'bg-red-500/10 border-red-500/20'
        }`}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            {health.system_healthy ? (
              <CheckCircle size={24} className="text-emerald-400" />
            ) : (
              <AlertTriangle size={24} className="text-red-400" />
            )}
            <div>
              <p className={`text-sm font-semibold ${health.system_healthy ? 'text-emerald-400' : 'text-red-400'}`}>
                {health.system_healthy ? 'System Healthy' : 'System Issues Detected'}
              </p>
              <p className="text-xs text-white/50 mt-1">
                Last updated: {new Date(report.timestamp).toLocaleTimeString()}
              </p>
            </div>
          </div>
        </div>

        {health.warning_signals.length > 0 && (
          <div className="mt-3 pt-3 border-t border-white/10 space-y-1">
            {health.warning_signals.map((signal, idx) => (
              <p key={idx} className="text-xs text-white/70 flex items-center gap-2">
                <span className="w-1 h-1 bg-current rounded-full flex-shrink-0" />
                {signal}
              </p>
            ))}
          </div>
        )}
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {/* Tasks */}
        <div className="bg-white/[0.06] border border-white/5 rounded-lg p-3">
          <p className="text-[10px] text-white/50">Task Success Rate</p>
          <p className="text-xl font-bold text-indigo-400 mt-1">{tasks.success_rate}%</p>
          <p className="text-[10px] text-white/40 mt-1">
            {tasks.completed}/{tasks.total} completed
          </p>
        </div>

        {/* Agents */}
        <div className="bg-white/[0.06] border border-white/5 rounded-lg p-3">
          <p className="text-[10px] text-white/50">Agent Completion</p>
          <p className="text-xl font-bold text-cyan-400 mt-1">{agents.average_completion_rate}%</p>
          <p className="text-[10px] text-white/40 mt-1">
            {agents.active}/{agents.total} active
          </p>
        </div>

        {/* Workers */}
        <div className="bg-white/[0.06] border border-white/5 rounded-lg p-3">
          <p className="text-[10px] text-white/50">Workers Online</p>
          <p className="text-xl font-bold text-emerald-400 mt-1">
            {workers.online}/{workers.total}
          </p>
          <p className="text-[10px] text-white/40 mt-1">
            Queue: {workers.average_queue_length.toFixed(1)} avg
          </p>
        </div>

        {/* Failed Tasks */}
        {tasks.failed > 0 && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
            <p className="text-[10px] text-red-400">Failed Tasks</p>
            <p className="text-xl font-bold text-red-400 mt-1">{tasks.failed}</p>
          </div>
        )}

        {/* Failed Agents */}
        {agents.failed > 0 && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
            <p className="text-[10px] text-red-400">Failed Agents</p>
            <p className="text-xl font-bold text-red-400 mt-1">{agents.failed}</p>
          </div>
        )}

        {/* Offline Workers */}
        {workers.offline > 0 && (
          <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-3">
            <p className="text-[10px] text-orange-400">Offline Workers</p>
            <p className="text-xl font-bold text-orange-400 mt-1">{workers.offline}</p>
          </div>
        )}
      </div>

      {/* Top Performers */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {agents.most_active && (
          <div className="bg-white/[0.06] border border-white/5 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp size={14} className="text-indigo-400" />
              <p className="text-[10px] font-medium text-white/70">Most Active Agent</p>
            </div>
            <p className="text-sm font-medium text-white">{agents.most_active.name}</p>
            <p className="text-xs text-white/50 mt-1">{agents.most_active.tasks} tasks</p>
          </div>
        )}

        {workers.busiest_worker && (
          <div className="bg-white/[0.06] border border-white/5 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp size={14} className="text-cyan-400" />
              <p className="text-[10px] font-medium text-white/70">Busiest Worker</p>
            </div>
            <p className="text-sm font-medium text-white">{workers.busiest_worker.name}</p>
            <p className="text-xs text-white/50 mt-1">Queue: {workers.busiest_worker.queue}</p>
          </div>
        )}
      </div>

      {/* Task Distribution */}
      <div className="bg-white/[0.06] border border-white/5 rounded-lg p-3">
        <p className="text-[10px] font-medium text-white/70 mb-2">Task Distribution by Source</p>
        <div className="space-y-1">
          {Object.entries(tasks.total_by_source).map(([source, count]: [string, any]) => (
            <div key={source} className="flex items-center justify-between text-xs">
              <span className="text-white/50 capitalize">{source}</span>
              <div className="flex items-center gap-2">
                <div className="w-32 bg-white/5 rounded-full h-2">
                  <div
                    className="bg-indigo-500 h-2 rounded-full"
                    style={{ width: `${(count / tasks.total) * 100}%` }}
                  />
                </div>
                <span className="text-white font-medium w-8 text-right">{count}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
