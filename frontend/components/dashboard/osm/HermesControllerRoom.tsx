import { Shield, TrendingUp, AlertTriangle, Zap, Clock, CheckCircle, ArrowUpRight, BarChart3, RefreshCw } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

type HermesStats = {
  active_recoveries: number
  resolved_issues: number
  failed_deliveries: number
  avg_recovery_time_ms: number
  success_rate: number
  total_errors_today: number
}

async function getHermesStats(): Promise<HermesStats> {
  try {
    const supabase = await createClient()
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()

    const [
      { count: activeRecoveries },
      { count: resolvedIssues },
      { count: failedDeliveries },
      { data: recoveryTimes },
      { count: totalErrors },
    ] = await Promise.all([
      supabase.from('hermes.recovery_status')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active'),
      supabase.from('hermes.recovery_status')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'resolved'),
      supabase.from('build_agent_delivery')
        .select('*', { count: 'exact', head: true })
        .eq('result_status', 'failed'),
      supabase.from('hermes.recovery_logs')
        .select('duration_ms')
        .order('created_at', { ascending: false })
        .limit(100),
      supabase.from('error_records')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', todayStart),
    ])

    const avgTime = recoveryTimes && recoveryTimes.length > 0
      ? Math.round(recoveryTimes.reduce((sum, r) => sum + (r.duration_ms || 0), 0) / recoveryTimes.length)
      : 0

    const successRate = (resolvedIssues ?? 0) + (activeRecoveries ?? 0) > 0
      ? Math.round(((resolvedIssues ?? 0) / ((resolvedIssues ?? 0) + (activeRecoveries ?? 0))) * 100)
      : 100

    return {
      active_recoveries: activeRecoveries ?? 0,
      resolved_issues: resolvedIssues ?? 0,
      failed_deliveries: failedDeliveries ?? 0,
      avg_recovery_time_ms: avgTime,
      success_rate: successRate,
      total_errors_today: totalErrors ?? 0,
    }
  } catch (error) {
    console.error('Error fetching Hermes stats:', error)
    return {
      active_recoveries: 0,
      resolved_issues: 0,
      failed_deliveries: 0,
      avg_recovery_time_ms: 0,
      success_rate: 100,
      total_errors_today: 0,
    }
  }
}

export default async function HermesControllerRoom() {
  const stats = await getHermesStats()

  const healthScore = Math.max(0, Math.min(100, stats.success_rate - Math.min(stats.active_recoveries * 5, 20)))

  const getHealthColor = (score: number) => {
    if (score >= 85) return { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20', label: '🟢 Healthy' }
    if (score >= 70) return { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20', label: '🟡 Monitoring' }
    return { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/20', label: '🔴 Alert' }
  }

  const health = getHealthColor(healthScore)

  return (
    <div className="bg-gradient-to-br from-white/[0.08] to-white/[0.04] border border-white/10 rounded-xl p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg border border-cyan-500/30 bg-cyan-500/10 flex items-center justify-center">
            <Shield size={20} className="text-cyan-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">🤖 Hermes Controller Room</h2>
            <p className="text-xs text-white/50 mt-0.5">AI-Powered Autonomous Recovery System</p>
          </div>
        </div>
        <Link
          href="/dashboard/operations/hermes"
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 hover:bg-cyan-500/20 transition-colors text-xs font-medium"
        >
          <Zap size={12} />
          Command Center
        </Link>
      </div>

      {/* Health Status Bar */}
      <div className={`rounded-lg border ${health.bg} ${health.border} p-4`}>
        <div className="flex items-center justify-between mb-3">
          <span className={`text-sm font-semibold ${health.text}`}>{health.label}</span>
          <span className={`text-2xl font-bold ${health.text}`}>{healthScore}%</span>
        </div>
        <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${
              healthScore >= 85 ? 'bg-emerald-500' : healthScore >= 70 ? 'bg-amber-500' : 'bg-red-500'
            }`}
            style={{ width: `${healthScore}%` }}
          />
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white/[0.03] border border-white/5 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <RefreshCw size={14} className="text-cyan-400" />
            <span className="text-xs font-mono text-white/50">ACTIVE</span>
          </div>
          <p className="text-2xl font-bold text-white">{stats.active_recoveries}</p>
          <p className="text-xs text-white/50 mt-1">Active Recoveries</p>
        </div>

        <div className="bg-white/[0.03] border border-white/5 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <CheckCircle size={14} className="text-emerald-400" />
            <span className="text-xs font-mono text-white/50">RESOLVED</span>
          </div>
          <p className="text-2xl font-bold text-white">{stats.resolved_issues}</p>
          <p className="text-xs text-white/50 mt-1">Issues Resolved</p>
        </div>

        <div className="bg-white/[0.03] border border-white/5 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <AlertTriangle size={14} className="text-amber-400" />
            <span className="text-xs font-mono text-white/50">TODAY</span>
          </div>
          <p className="text-2xl font-bold text-white">{stats.total_errors_today}</p>
          <p className="text-xs text-white/50 mt-1">Errors Today</p>
        </div>

        <div className="bg-white/[0.03] border border-white/5 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <Clock size={14} className="text-violet-400" />
            <span className="text-xs font-mono text-white/50">AVG</span>
          </div>
          <p className="text-2xl font-bold text-white">{stats.avg_recovery_time_ms}ms</p>
          <p className="text-xs text-white/50 mt-1">Recovery Time</p>
        </div>
      </div>

      {/* Performance Indicators */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-white/[0.02] border border-white/5 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={12} className="text-emerald-400" />
            <span className="text-xs font-semibold text-white">Success Rate</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold text-emerald-400">{stats.success_rate}%</span>
            <span className="text-[10px] text-white/40">of recovery ops</span>
          </div>
        </div>

        <div className="bg-white/[0.02] border border-white/5 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 size={12} className="text-sky-400" />
            <span className="text-xs font-semibold text-white">Failed Deliveries</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold text-sky-400">{stats.failed_deliveries}</span>
            <span className="text-[10px] text-white/40">queued for recovery</span>
          </div>
        </div>

        <div className="bg-white/[0.02] border border-white/5 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <Zap size={12} className="text-amber-400" />
            <span className="text-xs font-semibold text-white">System Status</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className={`text-xl font-bold ${healthScore >= 85 ? 'text-emerald-400' : 'text-amber-400'}`}>
              {healthScore >= 85 ? 'Online' : 'Monitoring'}
            </span>
          </div>
        </div>
      </div>

      {/* Quick Commands */}
      <div className="space-y-2 pt-2 border-t border-white/5">
        <p className="text-xs font-semibold text-white/70 uppercase tracking-wider">Quick Commands</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          <Link
            href="/dashboard/operations/hermes"
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-xs text-white/70 hover:text-white/90 group"
          >
            <Shield size={11} className="text-cyan-400 group-hover:text-cyan-300" />
            Monitor Hermes
            <ArrowUpRight size={9} className="ml-auto text-white/30 group-hover:text-white/50" />
          </Link>
          <Link
            href="/dashboard/operations/errors"
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-xs text-white/70 hover:text-white/90 group"
          >
            <AlertTriangle size={11} className="text-red-400 group-hover:text-red-300" />
            View Errors
            <ArrowUpRight size={9} className="ml-auto text-white/30 group-hover:text-white/50" />
          </Link>
          <Link
            href="/dashboard/build-tracker/routines/recovery"
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-xs text-white/70 hover:text-white/90 group"
          >
            <RefreshCw size={11} className="text-violet-400 group-hover:text-violet-300" />
            Recovery Ops
            <ArrowUpRight size={9} className="ml-auto text-white/30 group-hover:text-white/50" />
          </Link>
        </div>
      </div>

      {/* System Note */}
      <div className="bg-white/[0.02] border border-cyan-500/20 rounded-lg p-3 text-[11px] text-white/60 space-y-1">
        <p className="font-semibold text-cyan-400">🔬 Hermes Intelligence</p>
        <p>• Autonomous error detection & recovery across all entities</p>
        <p>• Real-time monitoring of failed deliveries and recovery attempts</p>
        <p>• Automated escalation protocols for unresolved issues</p>
      </div>
    </div>
  )
}
