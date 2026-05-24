import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { KpiStrip, type Kpi } from '@/components/executive/KpiStrip'
import { RunStatusBadge, HealthStatusBadge } from '@/lib/routines/badges'
import { restartRun, cancelRun, approveStep, denyStep, deferStep, dismissAlert } from '../actions'
import type { RoutineRunRow } from '@/lib/routines/types'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type FailedRunRow = RoutineRunRow & { routines: { name: string; slug: string; kind: string } | null }

type ApprovalRow = {
  id: string
  run_id: string
  step_id: string
  requested_at: string
  decision: string | null
  routine_runs: { routine_id: string; routines: { name: string; slug: string } | null } | null
}

type WatchdogIncidentRow = {
  deploy_id: string
  service_id: string
  service_name: string
  failure_kind: string
  failure_summary: string | null
  attempts_made: number
  status: string
  opened_at: string
  host_id: string
}

type AlertRow = {
  id: string
  alert_kind: string
  severity: string
  title: string
  message: string
  detected_at: string
  payload: Record<string, unknown>
}

function fmtTime(s: string | null): string {
  if (!s) return '—'
  return new Date(s).toLocaleString('nl-NL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

const SEVERITY_STYLE: Record<string, string> = {
  critical: 'bg-red-500/10 text-red-300 border-red-400/30',
  high:     'bg-orange-500/10 text-orange-300 border-orange-400/30',
  medium:   'bg-amber-500/10 text-amber-300 border-amber-400/30',
  low:      'bg-white/[0.04] text-white/50 border-white/10',
  info:     'bg-indigo-500/10 text-indigo-300 border-indigo-400/30',
}

export default async function RoutinesRecoveryPage() {
  const supabase = await createClient()

  const [failedRunsRes, approvalsRes, incidentsRes, alertsRes] = await Promise.all([
    supabase
      .from('routine_runs')
      .select('id, routine_id, parent_run_id, status, trigger_kind, trigger_payload, service_id, claimed_by, claimed_at, started_at, heartbeat_at, ended_at, error, cost_cents, routines:routine_id(name, slug, kind)')
      .in('status', ['failed', 'paused'])
      .order('started_at', { ascending: false })
      .limit(50),

    supabase
      .from('routine_approvals')
      .select('id, run_id, step_id, requested_at, decision, routine_runs:run_id(routine_id, routines:routine_id(name, slug))')
      .is('decision', null)
      .order('requested_at', { ascending: true })
      .limit(50),

    supabase
      .from('infra_watchdog_incidents')
      .select('deploy_id, service_id, service_name, failure_kind, failure_summary, attempts_made, status, opened_at, host_id')
      .eq('status', 'open')
      .order('opened_at', { ascending: false })
      .limit(20),

    supabase
      .from('executive_alerts')
      .select('id, alert_kind, severity, title, message, detected_at, payload')
      .eq('target_kind', 'routine')
      .is('acknowledged_at', null)
      .order('detected_at', { ascending: false })
      .limit(20),
  ])

  const failedRuns = (failedRunsRes.data ?? []) as unknown as FailedRunRow[]
  const approvals  = (approvalsRes.data ?? []) as unknown as ApprovalRow[]
  const incidents  = (incidentsRes.data ?? []) as WatchdogIncidentRow[]
  const alerts     = (alertsRes.data ?? []) as AlertRow[]

  const kpis: Kpi[] = [
    { label: 'Failed runs',         value: failedRuns.length, accent: failedRuns.length > 0 ? 'red' : 'white' },
    { label: 'Pending approvals',   value: approvals.length, accent: approvals.length > 0 ? 'violet' : 'white' },
    { label: 'Watchdog incidents',  value: incidents.length, accent: incidents.length > 0 ? 'amber' : 'white' },
    { label: 'Routine alerts',      value: alerts.length, accent: alerts.length > 0 ? 'red' : 'white' },
    { label: 'Self-healing actief', value: 'pg_cron', hint: 'health-sweep /5m', accent: 'emerald' },
  ]

  return (
    <div className="space-y-5">
      <KpiStrip items={kpis} />

      <section className="bg-white/[0.04] rounded-xl border border-white/[0.06] p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-xs font-medium text-white/70">Failed / paused runs</h2>
            <p className="text-[10px] text-white/40">Klik "Herstart" om een nieuwe run te enqueue'n met `parent_run_id` naar deze; oude wordt 'recovered'.</p>
          </div>
          <span className="text-[10px] text-white/40 tabular-nums">{failedRuns.length}</span>
        </div>

        {failedRuns.length === 0 ? (
          <div className="py-8 text-center text-[11px] text-emerald-300/70">✓ Geen failed of paused runs — alles draait.</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="text-left text-[9px] uppercase tracking-wide text-white/35">
                <th className="pb-2 font-medium">Routine</th>
                <th className="pb-2 font-medium">Status</th>
                <th className="pb-2 font-medium">Service</th>
                <th className="pb-2 font-medium">Fout</th>
                <th className="pb-2 font-medium text-right">Gestart</th>
                <th className="pb-2 font-medium text-right">Acties</th>
              </tr>
            </thead>
            <tbody>
              {failedRuns.map((r) => (
                <tr key={r.id} className="border-t border-white/[0.04] align-top">
                  <td className="py-1.5 text-[11px] text-white/85">
                    <Link href={`/dashboard/build-tracker/routines/${r.routine_id}`} className="hover:text-white">
                      {r.routines?.name ?? <span className="text-white/30 font-mono">{r.routine_id.slice(0, 8)}…</span>}
                    </Link>
                  </td>
                  <td className="py-1.5"><RunStatusBadge status={r.status} size="xs" /></td>
                  <td className="py-1.5 text-[10px] text-white/40 font-mono">{r.service_id ?? '—'}</td>
                  <td className="py-1.5 text-[10px] text-red-300/80 max-w-[280px] truncate font-mono">
                    {r.error && typeof r.error === 'object' && 'message' in r.error
                      ? String((r.error as { message?: unknown }).message)
                      : r.error ? JSON.stringify(r.error) : '—'}
                  </td>
                  <td className="py-1.5 text-right text-[10px] tabular-nums text-white/45">{fmtTime(r.started_at)}</td>
                  <td className="py-1.5">
                    <div className="flex justify-end gap-2">
                      <form action={restartRun}>
                        <input type="hidden" name="run_id" value={r.id} />
                        <button type="submit" className="px-2 py-0.5 text-[10px] bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-400/30 text-indigo-200 rounded">
                          ↻ Herstart
                        </button>
                      </form>
                      <form action={cancelRun}>
                        <input type="hidden" name="run_id" value={r.id} />
                        <button type="submit" className="px-2 py-0.5 text-[10px] bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-white/50 rounded">
                          ✕ Sluit
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="bg-white/[0.04] rounded-xl border border-white/[0.06] p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-xs font-medium text-white/70">Pending approvals</h2>
            <p className="text-[10px] text-white/40">Approval-stappen wachten op user-beslissing. Approve hervat de run, deny annuleert.</p>
          </div>
          <span className="text-[10px] text-white/40 tabular-nums">{approvals.length}</span>
        </div>

        {approvals.length === 0 ? (
          <div className="py-8 text-center text-[11px] text-white/40">Geen open approvals.</div>
        ) : (
          <ul className="space-y-2">
            {approvals.map((a) => (
              <li key={a.id} className="bg-white/[0.02] border border-white/[0.05] rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className="text-[11px] text-white/85 font-medium">
                      {a.routine_runs?.routines?.name ?? <span className="font-mono text-white/40">{a.run_id.slice(0, 8)}…</span>}
                    </div>
                    <div className="text-[10px] text-white/40 mt-0.5">
                      Aangevraagd {fmtTime(a.requested_at)} · run {a.run_id.slice(0, 8)} · step {a.step_id.slice(0, 8)}
                    </div>
                  </div>
                </div>
                <form className="flex flex-col gap-2 sm:flex-row">
                  <input
                    name="notes"
                    placeholder="notitie (optioneel)"
                    className="flex-1 bg-white/[0.04] border border-white/10 rounded px-2 py-1 text-[10.5px] text-white/80 focus:outline-none focus:border-white/30"
                  />
                  <input type="hidden" name="approval_id" value={a.id} />
                  <div className="flex gap-1.5">
                    <button formAction={approveStep} className="px-2.5 py-1 text-[10px] bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/30 text-emerald-200 rounded">
                      ✓ Approve
                    </button>
                    <button formAction={denyStep} className="px-2.5 py-1 text-[10px] bg-red-500/10 hover:bg-red-500/20 border border-red-400/30 text-red-200 rounded">
                      ✕ Deny
                    </button>
                    <button formAction={deferStep} className="px-2.5 py-1 text-[10px] bg-white/[0.06] hover:bg-white/[0.1] border border-white/10 text-white/65 rounded">
                      ⧖ Defer
                    </button>
                  </div>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <section className="bg-white/[0.04] rounded-xl border border-white/[0.06] p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-medium text-white/70">Watchdog incidents (open)</h2>
            <span className="text-[10px] text-white/40 tabular-nums">{incidents.length}</span>
          </div>

          {incidents.length === 0 ? (
            <div className="py-6 text-center text-[11px] text-emerald-300/70">✓ Geen open watchdog incidents.</div>
          ) : (
            <ul className="space-y-2">
              {incidents.map((i) => (
                <li key={`${i.deploy_id}-${i.host_id}`} className="bg-white/[0.02] border border-white/[0.05] rounded-lg p-2.5 text-[11px]">
                  <div className="flex items-center gap-2 mb-1">
                    <HealthStatusBadge status={i.failure_kind} />
                    <span className="text-white/80 font-medium">{i.service_name}</span>
                    <span className="ml-auto text-[10px] text-white/40">attempts: {i.attempts_made}</span>
                  </div>
                  {i.failure_summary && (
                    <p className="text-[10.5px] text-white/55 mt-1 leading-snug">{i.failure_summary}</p>
                  )}
                  <div className="text-[9px] text-white/30 mt-1.5 font-mono">
                    {i.service_id} · {i.host_id} · {fmtTime(i.opened_at)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="bg-white/[0.04] rounded-xl border border-white/[0.06] p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-medium text-white/70">Routine alerts</h2>
            <span className="text-[10px] text-white/40 tabular-nums">{alerts.length}</span>
          </div>

          {alerts.length === 0 ? (
            <div className="py-6 text-center text-[11px] text-white/40">Geen unack'd routine alerts.</div>
          ) : (
            <ul className="space-y-2">
              {alerts.map((a) => (
                <li key={a.id} className="bg-white/[0.02] border border-white/[0.05] rounded-lg p-2.5 text-[11px]">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`inline-flex items-center px-1.5 py-0.5 text-[9px] uppercase tracking-wide rounded border ${SEVERITY_STYLE[a.severity] ?? SEVERITY_STYLE.info}`}>
                      {a.severity}
                    </span>
                    <span className="text-white/80 font-medium flex-1 truncate">{a.title}</span>
                    <form action={dismissAlert} className="shrink-0">
                      <input type="hidden" name="id" value={a.id} />
                      <button type="submit" className="text-[10px] text-white/40 hover:text-white/70">ack</button>
                    </form>
                  </div>
                  <p className="text-[10.5px] text-white/55 mt-1 leading-snug">{a.message}</p>
                  <div className="text-[9px] text-white/30 mt-1.5 font-mono">
                    {a.alert_kind} · {fmtTime(a.detected_at)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
