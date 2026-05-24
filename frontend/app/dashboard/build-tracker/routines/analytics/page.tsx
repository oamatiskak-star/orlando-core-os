import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { KpiStrip, type Kpi } from '@/components/executive/KpiStrip'
import { RoutineStatusBadge } from '@/lib/routines/badges'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type WindowMetrics = {
  days: number
  total_runs: number
  completed: number
  failed: number
  recovered: number
  cancelled: number
  success_rate: number
  failure_rate: number
  avg_seconds: number
  total_cost_cents: number
  avg_cost_cents: number
  manual_runs: number
  automated_runs: number
  automation_ratio: number
  human_intervention_ratio: number
  active_routines: number
}

type DayMetric = {
  day: string
  total_runs: number
  completed: number
  failed: number
  avg_seconds: number
}

type TopRunner = {
  routine_id: string
  name: string
  kind: string
  status: 'active' | 'paused' | 'disabled' | 'draft'
  total_runs: number
  success_rate: number
  avg_seconds: number
  total_cost_cents: number
}

function fmtSeconds(s: number): string {
  if (s < 60) return `${s.toFixed(1)}s`
  if (s < 3600) return `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`
}

function fmtCents(c: number): string {
  return `€${(c / 100).toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtDay(s: string): string {
  return new Date(s).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', weekday: 'short' })
}

export default async function RoutinesAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>
}) {
  const params = await searchParams
  const days = [7, 14, 30, 90].includes(Number(params.days)) ? Number(params.days) : 7

  const supabase = await createClient()

  const [windowRes, byDayRes, topRes] = await Promise.all([
    supabase.rpc('routine_metrics_window', { p_days: days }),
    supabase.rpc('routine_metrics_by_day', { p_days: days }),
    supabase.rpc('routine_top_runners',    { p_days: days, p_limit: 10 }),
  ])

  const m       = (windowRes.data ?? null) as WindowMetrics | null
  const byDay   = (byDayRes.data  ?? []) as DayMetric[]
  const top     = (topRes.data    ?? []) as TopRunner[]

  const kpis: Kpi[] = m
    ? [
        { label: `Total runs (${days}d)`, value: m.total_runs,        accent: 'indigo' },
        { label: 'Success rate',          value: `${m.success_rate}%`, accent: m.success_rate >= 90 ? 'emerald' : m.success_rate >= 70 ? 'amber' : 'red' },
        { label: 'Failure rate',          value: `${m.failure_rate}%`, accent: m.failure_rate > 10 ? 'red' : 'white' },
        { label: 'Avg duration',          value: fmtSeconds(m.avg_seconds), accent: 'white' },
        { label: 'Total cost',            value: fmtCents(m.total_cost_cents), hint: `avg ${fmtCents(m.avg_cost_cents)}`, accent: 'violet' },
      ]
    : []

  const maxRuns = Math.max(1, ...byDay.map(d => d.total_runs))

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-white/40">Venster: laatste {days} dagen — switch:</p>
        <nav className="flex gap-1">
          {[7, 14, 30, 90].map(d => (
            <Link
              key={d}
              href={`/dashboard/build-tracker/routines/analytics?days=${d}`}
              className={
                d === days
                  ? 'px-2.5 py-1 text-[10px] bg-emerald-500/15 border border-emerald-400/30 text-emerald-200 rounded'
                  : 'px-2.5 py-1 text-[10px] bg-white/[0.04] border border-white/10 text-white/60 rounded hover:bg-white/[0.08]'
              }
            >
              {d}d
            </Link>
          ))}
        </nav>
      </div>

      <KpiStrip items={kpis} />

      {m && (
        <section className="bg-white/[0.04] rounded-xl border border-white/[0.06] p-4">
          <h2 className="text-xs font-medium text-white/70 mb-3">Automation vs. menselijke interventie</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-[11px]">
            <div>
              <p className="text-[10px] uppercase tracking-wide text-white/40 mb-1">Automation ratio</p>
              <p className="text-2xl font-semibold text-emerald-300 tabular-nums">{m.automation_ratio}%</p>
              <p className="text-[10px] text-white/40 mt-0.5">{m.automated_runs} automated runs</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-white/40 mb-1">Human intervention</p>
              <p className="text-2xl font-semibold text-amber-300 tabular-nums">{m.human_intervention_ratio}%</p>
              <p className="text-[10px] text-white/40 mt-0.5">{m.manual_runs} manual / retry runs</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-white/40 mb-1">Active routines</p>
              <p className="text-2xl font-semibold text-violet-300 tabular-nums">{m.active_routines}</p>
              <p className="text-[10px] text-white/40 mt-0.5">recovered: {m.recovered} · cancelled: {m.cancelled}</p>
            </div>
          </div>
        </section>
      )}

      <section className="bg-white/[0.04] rounded-xl border border-white/[0.06] p-4">
        <h2 className="text-xs font-medium text-white/70 mb-3">Runs per dag</h2>
        {byDay.length === 0 ? (
          <p className="text-[11px] text-white/40 py-6 text-center">Geen runs in dit venster.</p>
        ) : (
          <ul className="space-y-1.5">
            {byDay.map((d) => {
              const successWidth = d.total_runs > 0 ? (d.completed / maxRuns) * 100 : 0
              const failWidth    = d.total_runs > 0 ? (d.failed    / maxRuns) * 100 : 0
              return (
                <li key={d.day} className="flex items-center gap-3">
                  <span className="text-[10px] text-white/45 tabular-nums w-24 shrink-0">{fmtDay(d.day)}</span>
                  <div className="flex-1 h-4 bg-white/[0.04] rounded overflow-hidden flex">
                    <div className="h-full bg-emerald-500/40" style={{ width: `${successWidth}%` }} />
                    <div className="h-full bg-red-500/40"     style={{ width: `${failWidth}%` }} />
                  </div>
                  <span className="text-[10px] text-white/65 tabular-nums w-12 text-right">{d.total_runs}</span>
                  <span className="text-[10px] text-white/40 tabular-nums w-20 text-right">{fmtSeconds(d.avg_seconds)}</span>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section className="bg-white/[0.04] rounded-xl border border-white/[0.06] p-4">
        <h2 className="text-xs font-medium text-white/70 mb-3">Top runners ({days}d)</h2>
        {top.length === 0 ? (
          <p className="text-[11px] text-white/40 py-6 text-center">Nog geen runs — Run een routine om hier metrics te zien.</p>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="text-left text-[9px] uppercase tracking-wide text-white/35">
                <th className="pb-2 font-medium">Routine</th>
                <th className="pb-2 font-medium">Kind</th>
                <th className="pb-2 font-medium">Status</th>
                <th className="pb-2 font-medium text-right">Runs</th>
                <th className="pb-2 font-medium text-right">Success</th>
                <th className="pb-2 font-medium text-right">Avg duur</th>
                <th className="pb-2 font-medium text-right">Kosten</th>
              </tr>
            </thead>
            <tbody>
              {top.map((t) => (
                <tr key={t.routine_id} className="border-t border-white/[0.04]">
                  <td className="py-1.5 text-[11px]">
                    <Link href={`/dashboard/build-tracker/routines/${t.routine_id}`} className="text-white/85 hover:text-white">
                      {t.name}
                    </Link>
                  </td>
                  <td className="py-1.5 text-[10px] text-white/55 font-mono uppercase tracking-wide">{t.kind}</td>
                  <td className="py-1.5"><RoutineStatusBadge status={t.status} size="xs" /></td>
                  <td className="py-1.5 text-right text-[10px] tabular-nums text-white/70">{t.total_runs}</td>
                  <td className="py-1.5 text-right text-[10px] tabular-nums text-emerald-300/80">{t.success_rate}%</td>
                  <td className="py-1.5 text-right text-[10px] tabular-nums text-white/55">{fmtSeconds(t.avg_seconds)}</td>
                  <td className="py-1.5 text-right text-[10px] tabular-nums text-violet-300/80">{fmtCents(t.total_cost_cents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}
