import { createClient } from '@/lib/supabase/server'
import { BarChart2, TrendingUp, TrendingDown, Activity, GitBranch } from 'lucide-react'

type DailyMetric = {
  date: string
  workflow_id: string | null
  company: string | null
  runs_total: number
  runs_success: number
  runs_failed: number
  avg_duration_ms: number
  total_duration_ms: number
}

type WorkflowStat = {
  id: string
  naam: string
  run_count: number
  success_count: number
  failure_count: number
  avg_duration_ms: number | null
  last_run_at: string | null
}

export default async function AnalyticsPage() {
  const supabase = await createClient()

  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const [
    { data: metrics },
    { data: workflows },
    { data: runs7d },
    { count: agentRuns },
  ] = await Promise.all([
    supabase.from('oc_workflow_metrics')
      .select('*')
      .gte('date', since30d)
      .order('date', { ascending: true }),
    supabase.from('oc_workflows')
      .select('id, naam, run_count, success_count, failure_count, avg_duration_ms, last_run_at')
      .neq('status', 'uitgeschakeld')
      .order('run_count', { ascending: false })
      .limit(10),
    supabase.from('oc_workflow_runs')
      .select('status, duration_ms, started_at')
      .gte('started_at', since7d),
    supabase.from('oc_agent_runs')
      .select('*', { count: 'exact', head: true })
      .gte('started_at', since7d),
  ])

  const totalRuns7d = runs7d?.length ?? 0
  const successRuns7d = runs7d?.filter(r => r.status === 'success').length ?? 0
  const failedRuns7d = runs7d?.filter(r => r.status === 'failed').length ?? 0
  const successRate7d = totalRuns7d > 0 ? Math.round((successRuns7d / totalRuns7d) * 100) : 0
  const avgDuration7d = runs7d?.length
    ? Math.round(runs7d.filter(r => r.duration_ms).reduce((s, r) => s + (r.duration_ms ?? 0), 0) / (runs7d.filter(r => r.duration_ms).length || 1))
    : 0

  const totalRunsAllTime = workflows?.reduce((s, w) => s + (w.run_count ?? 0), 0) ?? 0
  const totalSuccessAllTime = workflows?.reduce((s, w) => s + (w.success_count ?? 0), 0) ?? 0
  const successRateAllTime = totalRunsAllTime > 0 ? Math.round((totalSuccessAllTime / totalRunsAllTime) * 100) : 0

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center">
          <BarChart2 size={16} className="text-sky-400" />
        </div>
        <div>
          <h1 className="text-base font-semibold text-white">Analytics</h1>
          <p className="text-xs text-white/50">Prestatie-inzichten voor workflows, agents en automatiseringen</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Runs (7d)', value: totalRuns7d, icon: Activity, color: 'text-sky-400', border: 'border-sky-500/20', sub: null },
          { label: 'Succes Rate (7d)', value: `${successRate7d}%`, icon: TrendingUp, color: successRate7d >= 80 ? 'text-green-400' : 'text-amber-400', border: successRate7d >= 80 ? 'border-green-500/20' : 'border-amber-500/20', sub: null },
          { label: 'Gem. Duur (7d)', value: `${avgDuration7d}ms`, icon: Activity, color: 'text-indigo-400', border: 'border-indigo-500/20', sub: null },
          { label: 'Agent Runs (7d)', value: agentRuns ?? 0, icon: TrendingDown, color: 'text-pink-400', border: 'border-pink-500/20', sub: null },
        ].map(s => {
          const Icon = s.icon
          return (
            <div key={s.label} className={`bg-white/[0.06] border ${s.border} rounded-xl p-4`}>
              <Icon size={13} className={`${s.color} mb-2`} />
              <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-[11px] text-white/50 mt-0.5">{s.label}</p>
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white/[0.06] border border-white/5 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Succes/Fail (7d)</h3>
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <span className="text-xs text-white/50 w-20">Geslaagd</span>
              <div className="flex-1 bg-white/5 rounded-full h-2">
                <div className="bg-green-500 h-2 rounded-full" style={{ width: totalRuns7d > 0 ? `${(successRuns7d / totalRuns7d) * 100}%` : '0%' }} />
              </div>
              <span className="text-xs text-green-400 w-8 text-right">{successRuns7d}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-white/50 w-20">Mislukt</span>
              <div className="flex-1 bg-white/5 rounded-full h-2">
                <div className="bg-red-500 h-2 rounded-full" style={{ width: totalRuns7d > 0 ? `${(failedRuns7d / totalRuns7d) * 100}%` : '0%' }} />
              </div>
              <span className="text-xs text-red-400 w-8 text-right">{failedRuns7d}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-white/50 w-20">Overig</span>
              <div className="flex-1 bg-white/5 rounded-full h-2">
                <div className="bg-white/20 h-2 rounded-full" style={{ width: totalRuns7d > 0 ? `${((totalRuns7d - successRuns7d - failedRuns7d) / totalRuns7d) * 100}%` : '0%' }} />
              </div>
              <span className="text-xs text-white/38 w-8 text-right">{totalRuns7d - successRuns7d - failedRuns7d}</span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-white/5 flex justify-between text-xs text-white/38">
            <span>Totaal (all time): {totalRunsAllTime}</span>
            <span>Succes rate (all time): {successRateAllTime}%</span>
          </div>
        </div>

        <div className="bg-white/[0.06] border border-white/5 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-3">Top Workflows (all time)</h3>
          {!workflows?.length ? (
            <p className="text-xs text-white/38 text-center py-8">Geen data</p>
          ) : (
            <div className="space-y-2">
              {(workflows as WorkflowStat[]).map((wf, i) => {
                const rate = wf.run_count > 0 ? Math.round((wf.success_count / wf.run_count) * 100) : 0
                return (
                  <div key={wf.id} className="flex items-center gap-3">
                    <span className="text-[10px] text-white/25 w-4 flex-shrink-0">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs text-white/70 truncate">{wf.naam}</span>
                        <span className="text-[10px] text-white/38 flex-shrink-0">{wf.run_count}x</span>
                      </div>
                      <div className="flex-1 bg-white/5 rounded-full h-1 mt-1">
                        <div className={`h-1 rounded-full ${rate >= 80 ? 'bg-green-500' : rate >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                          style={{ width: `${rate}%` }} />
                      </div>
                    </div>
                    <span className={`text-[10px] w-8 text-right flex-shrink-0 ${rate >= 80 ? 'text-green-400' : rate >= 50 ? 'text-amber-400' : 'text-red-400'}`}>
                      {rate}%
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {(metrics?.length ?? 0) > 0 && (
        <div className="bg-white/[0.06] border border-white/5 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Dagelijkse Metrics (30d)</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left py-1.5 pr-3 text-white/45 font-medium">Datum</th>
                  <th className="text-right py-1.5 pr-3 text-white/45 font-medium">Runs</th>
                  <th className="text-right py-1.5 pr-3 text-white/45 font-medium">Geslaagd</th>
                  <th className="text-right py-1.5 pr-3 text-white/45 font-medium">Mislukt</th>
                  <th className="text-right py-1.5 text-white/45 font-medium">Gem. Duur</th>
                </tr>
              </thead>
              <tbody>
                {(metrics as DailyMetric[]).slice(-14).reverse().map((m, i) => (
                  <tr key={i} className="border-b border-white/[0.03]">
                    <td className="py-1.5 pr-3 text-white/50 font-mono">{m.date}</td>
                    <td className="py-1.5 pr-3 text-right text-white/70">{m.runs_total}</td>
                    <td className="py-1.5 pr-3 text-right text-green-400">{m.runs_success}</td>
                    <td className="py-1.5 pr-3 text-right text-red-400">{m.runs_failed}</td>
                    <td className="py-1.5 text-right text-white/50">{m.avg_duration_ms ? `${Math.round(m.avg_duration_ms)}ms` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
