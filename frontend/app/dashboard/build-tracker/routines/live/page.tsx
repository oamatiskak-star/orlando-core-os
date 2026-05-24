import { createClient } from '@/lib/supabase/server'
import { KpiStrip, type Kpi } from '@/components/executive/KpiStrip'
import { RunStatusBadge } from '@/lib/routines/badges'
import type { RoutineRunRow, RunStatus } from '@/lib/routines/types'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type RunWithRoutine = RoutineRunRow & { routines: { name: string; kind: string; slug: string } | null }

function fmtDuration(start: string, end: string | null): string {
  const s = new Date(start).getTime()
  const e = end ? new Date(end).getTime() : Date.now()
  const ms = Math.max(0, e - s)
  if (ms < 1000) return `${ms}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ${Math.floor((ms % 60_000) / 1000)}s`
  return `${Math.floor(ms / 3_600_000)}h ${Math.floor((ms % 3_600_000) / 60_000)}m`
}

function fmtTimeAgo(s: string | null): string {
  if (!s) return '—'
  const diff = Date.now() - new Date(s).getTime()
  if (diff < 60_000) return 'zojuist'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m geleden`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}u geleden`
  return new Date(s).toLocaleString('nl-NL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export default async function RoutinesLivePage() {
  const supabase = await createClient()

  const [activeRunsRes, recentRunsRes, queueByExecutorRes] = await Promise.all([
    supabase
      .from('routine_runs')
      .select('id, routine_id, status, trigger_kind, trigger_payload, service_id, claimed_by, claimed_at, started_at, heartbeat_at, ended_at, error, cost_cents, routines:routine_id(name, kind, slug)')
      .in('status', ['queued', 'running', 'paused', 'awaiting_approval'])
      .order('started_at', { ascending: false })
      .limit(50),

    supabase
      .from('routine_runs')
      .select('id, routine_id, status, trigger_kind, started_at, ended_at, error, cost_cents, routines:routine_id(name, kind, slug)')
      .gte('started_at', new Date(Date.now() - 24 * 3_600_000).toISOString())
      .order('started_at', { ascending: false })
      .limit(50),

    supabase
      .from('v_system_health')
      .select('id, label, status, ok_count, fail_count, note')
      .eq('source', 'orchestrator'),
  ])

  const active = (activeRunsRes.data ?? []) as unknown as RunWithRoutine[]
  const recent = (recentRunsRes.data ?? []) as unknown as RunWithRoutine[]
  const queue = queueByExecutorRes.data ?? []

  const byStatus = recent.reduce<Record<RunStatus, number>>(
    (acc, r) => {
      acc[r.status] = (acc[r.status] ?? 0) + 1
      return acc
    },
    { queued: 0, running: 0, paused: 0, awaiting_approval: 0, failed: 0, recovered: 0, completed: 0, cancelled: 0 },
  )

  const totalQueueOpen = queue.reduce((acc, q) => acc + (q.ok_count ?? 0) + (q.fail_count ?? 0), 0)

  const kpis: Kpi[] = [
    { label: 'Active runs',           value: active.length,        accent: active.length > 0 ? 'indigo' : 'white' },
    { label: 'Completed (24u)',       value: byStatus.completed,                                accent: 'emerald' },
    { label: 'Failed (24u)',          value: byStatus.failed,      accent: byStatus.failed > 0 ? 'red' : 'white' },
    { label: 'Awaiting approval',     value: byStatus.awaiting_approval, accent: byStatus.awaiting_approval > 0 ? 'violet' : 'white' },
    { label: 'Orchestrator queue',    value: totalQueueOpen, hint: `${queue.length} executors`,  accent: totalQueueOpen > 50 ? 'red' : totalQueueOpen > 10 ? 'amber' : 'white' },
  ]

  return (
    <div className="space-y-5">
      <KpiStrip items={kpis} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <section className="bg-white/[0.04] rounded-xl border border-white/[0.06] p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-medium text-white/70">Actieve runs</h2>
            <span className="text-[10px] text-white/40 tabular-nums">{active.length}</span>
          </div>
          {active.length === 0 ? (
            <div className="py-8 text-center text-[11px] text-white/40">Geen actieve runs op dit moment</div>
          ) : (
            <div className="space-y-2">
              {active.map((r) => (
                <div key={r.id} className="bg-white/[0.02] border border-white/[0.05] rounded-lg p-2.5">
                  <div className="flex items-center gap-2">
                    <RunStatusBadge status={r.status} size="xs" />
                    <span className="text-[11px] text-white/80 flex-1 truncate">{r.routines?.name ?? r.routine_id.slice(0, 8)}</span>
                    <span className="text-[10px] text-white/40 tabular-nums">{fmtDuration(r.started_at, r.ended_at)}</span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2 text-[10px] text-white/40">
                    <span className="font-mono uppercase tracking-wide">{r.trigger_kind}</span>
                    {r.service_id && <><span>·</span><span className="font-mono">{r.service_id}</span></>}
                    {r.heartbeat_at && <><span>·</span><span>♥ {fmtTimeAgo(r.heartbeat_at)}</span></>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="bg-white/[0.04] rounded-xl border border-white/[0.06] p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-medium text-white/70">Orchestrator queue per executor</h2>
            <span className="text-[10px] text-white/40 tabular-nums">{queue.length}</span>
          </div>
          {queue.length === 0 ? (
            <div className="py-8 text-center text-[11px] text-white/40">Geen orchestrator-taken in DB</div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="text-left text-[9px] uppercase tracking-wide text-white/35">
                  <th className="pb-2 font-medium">Executor</th>
                  <th className="pb-2 font-medium text-right">Status</th>
                  <th className="pb-2 font-medium text-right">Done</th>
                  <th className="pb-2 font-medium text-right">Failed</th>
                </tr>
              </thead>
              <tbody>
                {queue.map((q) => (
                  <tr key={q.id} className="border-t border-white/[0.04]">
                    <td className="py-1.5 text-[11px] text-white/80 font-mono">{q.label}</td>
                    <td className="py-1.5 text-right text-[10px] text-white/55">{q.status}</td>
                    <td className="py-1.5 text-right text-[10px] tabular-nums text-emerald-300/80">{q.ok_count ?? 0}</td>
                    <td className="py-1.5 text-right text-[10px] tabular-nums text-red-300/80">{q.fail_count ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>

      <section className="bg-white/[0.04] rounded-xl border border-white/[0.06] p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-medium text-white/70">Recente runs (laatste 24u)</h2>
          <span className="text-[10px] text-white/40 tabular-nums">{recent.length}</span>
        </div>
        {recent.length === 0 ? (
          <div className="py-8 text-center text-[11px] text-white/40">Geen runs in de laatste 24 uur</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="text-left text-[9px] uppercase tracking-wide text-white/35">
                <th className="pb-2 font-medium">Routine</th>
                <th className="pb-2 font-medium">Trigger</th>
                <th className="pb-2 font-medium">Status</th>
                <th className="pb-2 font-medium text-right">Duur</th>
                <th className="pb-2 font-medium text-right">Gestart</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((r) => (
                <tr key={r.id} className="border-t border-white/[0.04]">
                  <td className="py-1.5 text-[11px] text-white/85 truncate max-w-[280px]">
                    {r.routines?.name ?? <span className="text-white/30 font-mono">{r.routine_id.slice(0, 8)}…</span>}
                  </td>
                  <td className="py-1.5 text-[10px] text-white/55 font-mono uppercase tracking-wide">{r.trigger_kind}</td>
                  <td className="py-1.5"><RunStatusBadge status={r.status} size="xs" /></td>
                  <td className="py-1.5 text-right text-[10px] tabular-nums text-white/55">{fmtDuration(r.started_at, r.ended_at)}</td>
                  <td className="py-1.5 text-right text-[10px] text-white/45">{fmtTimeAgo(r.started_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}
