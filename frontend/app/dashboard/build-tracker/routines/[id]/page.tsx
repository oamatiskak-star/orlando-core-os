import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { RoutineStatusBadge, RunStatusBadge } from '@/lib/routines/badges'
import type { RoutineRow, RoutineRunRow, StepType, TriggerKind } from '@/lib/routines/types'
import {
  runRoutineNow,
  pauseRoutine,
  resumeRoutine,
  addStep,
  setTrigger,
  cancelRun,
} from '../actions'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type StepRow = {
  id: string
  routine_id: string
  order_idx: number
  type: StepType
  config: Record<string, unknown>
  on_failure_step_id: string | null
}

type TriggerRow = {
  id: string
  routine_id: string
  kind: TriggerKind
  config: Record<string, unknown>
  enabled: boolean
  next_run_at: string | null
  last_run_at: string | null
}

function fmtTime(s: string | null): string {
  if (!s) return '—'
  return new Date(s).toLocaleString('nl-NL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function fmtDuration(start: string, end: string | null): string {
  const ms = (end ? new Date(end).getTime() : Date.now()) - new Date(start).getTime()
  if (ms < 1000) return `${ms}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m`
  return `${Math.floor(ms / 3_600_000)}h ${Math.floor((ms % 3_600_000) / 60_000)}m`
}

export default async function RoutineDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const [routineRes, stepsRes, triggersRes, runsRes] = await Promise.all([
    supabase.from('routines').select('id, company_id, slug, name, description, kind, status, owner_user_id, created_at, updated_at').eq('id', id).maybeSingle(),
    supabase.from('routine_steps').select('id, routine_id, order_idx, type, config, on_failure_step_id').eq('routine_id', id).order('order_idx'),
    supabase.from('routine_triggers').select('id, routine_id, kind, config, enabled, next_run_at, last_run_at').eq('routine_id', id),
    supabase.from('routine_runs').select('id, routine_id, parent_run_id, status, trigger_kind, trigger_payload, service_id, claimed_by, claimed_at, started_at, heartbeat_at, ended_at, error, cost_cents').eq('routine_id', id).order('started_at', { ascending: false }).limit(50),
  ])

  const routine = routineRes.data as RoutineRow | null
  if (!routine) notFound()

  const steps    = (stepsRes.data ?? []) as StepRow[]
  const triggers = (triggersRes.data ?? []) as TriggerRow[]
  const runs     = (runsRes.data ?? []) as RoutineRunRow[]

  const isActive = routine.status === 'active'
  const completedRuns = runs.filter(r => r.status === 'completed').length
  const failedRuns    = runs.filter(r => r.status === 'failed').length
  const successRate   = runs.length > 0 ? ((completedRuns / runs.length) * 100).toFixed(0) : '—'

  return (
    <div className="space-y-5">
      <section className="bg-white/[0.04] rounded-xl border border-white/[0.06] p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-[10px] uppercase tracking-wide text-white/35">{routine.kind}</span>
              <RoutineStatusBadge status={routine.status} size="xs" />
              <span className="text-[10px] text-white/30 font-mono">{routine.slug}</span>
            </div>
            <h1 className="text-base font-semibold text-white/95">{routine.name}</h1>
            {routine.description && (
              <p className="text-[12px] text-white/55 mt-1 leading-relaxed">{routine.description}</p>
            )}
            <div className="mt-2 flex gap-4 text-[10px] text-white/40 flex-wrap">
              <span>Aangemaakt {fmtTime(routine.created_at)}</span>
              <span>Bijgewerkt {fmtTime(routine.updated_at)}</span>
              <span>Runs: <span className="tabular-nums text-white/60">{runs.length}</span></span>
              <span>Success: <span className="tabular-nums text-emerald-300/80">{successRate}%</span></span>
              <span>Failed: <span className="tabular-nums text-red-300/80">{failedRuns}</span></span>
            </div>
          </div>

          <div className="flex flex-col gap-2 shrink-0">
            <form action={runRoutineNow}>
              <input type="hidden" name="routine_id" value={routine.id} />
              <button
                type="submit"
                disabled={!isActive}
                className="w-full px-3 py-1.5 bg-emerald-500/15 hover:bg-emerald-500/25 disabled:bg-white/[0.04] disabled:cursor-not-allowed border border-emerald-400/30 disabled:border-white/10 text-emerald-200 disabled:text-white/30 rounded-lg text-[11px] font-medium transition-colors"
              >
                ▶ Run now
              </button>
            </form>
            {isActive ? (
              <form action={pauseRoutine}>
                <input type="hidden" name="routine_id" value={routine.id} />
                <button type="submit" className="w-full px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-400/30 text-amber-200 rounded-lg text-[11px] font-medium transition-colors">
                  ⏸ Pauseer
                </button>
              </form>
            ) : (
              <form action={resumeRoutine}>
                <input type="hidden" name="routine_id" value={routine.id} />
                <button type="submit" className="w-full px-3 py-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-400/30 text-indigo-200 rounded-lg text-[11px] font-medium transition-colors">
                  ▶ Activeer
                </button>
              </form>
            )}
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <section className="bg-white/[0.04] rounded-xl border border-white/[0.06] p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-medium text-white/70">Steps ({steps.length})</h2>
          </div>

          {steps.length === 0 ? (
            <p className="text-[11px] text-white/40 py-4">Geen stappen — voeg er één toe hieronder.</p>
          ) : (
            <ol className="space-y-2">
              {steps.map((s) => (
                <li key={s.id} className="bg-white/[0.02] border border-white/[0.05] rounded-lg p-2.5 text-[11px]">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-white/40 tabular-nums">{s.order_idx + 1}.</span>
                    <span className="uppercase tracking-wide text-white/65 font-medium">{s.type}</span>
                  </div>
                  <pre className="text-[10px] text-white/55 font-mono leading-snug overflow-x-auto">{JSON.stringify(s.config, null, 2)}</pre>
                </li>
              ))}
            </ol>
          )}

          <form action={addStep} className="mt-3 space-y-2 border-t border-white/[0.05] pt-3">
            <input type="hidden" name="routine_id" value={routine.id} />
            <div className="grid grid-cols-2 gap-2">
              <select name="type" required defaultValue="action" className="bg-white/[0.04] border border-white/10 rounded px-2 py-1.5 text-[11px] text-white/85 focus:outline-none focus:border-white/30">
                <option value="action">action</option>
                <option value="condition">condition</option>
                <option value="approval">approval</option>
                <option value="fallback">fallback</option>
                <option value="delay">delay</option>
              </select>
              <button type="submit" className="px-3 py-1.5 bg-white/[0.06] hover:bg-white/[0.1] border border-white/10 rounded text-[11px] text-white/80">
                + Step
              </button>
            </div>
            <textarea
              name="config"
              rows={3}
              placeholder='{"type": "http", "url": "https://...", "method": "POST"}'
              className="w-full bg-white/[0.04] border border-white/10 rounded px-2 py-1.5 text-[10.5px] font-mono text-white/80 focus:outline-none focus:border-white/30 resize-none"
            />
          </form>
        </section>

        <section className="bg-white/[0.04] rounded-xl border border-white/[0.06] p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-medium text-white/70">Triggers ({triggers.length})</h2>
          </div>

          {triggers.length === 0 ? (
            <p className="text-[11px] text-white/40 py-4">Geen triggers — voeg er één toe.</p>
          ) : (
            <ul className="space-y-2">
              {triggers.map((t) => (
                <li key={t.id} className="bg-white/[0.02] border border-white/[0.05] rounded-lg p-2.5 text-[11px]">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="uppercase tracking-wide text-white/65 font-medium">{t.kind}</span>
                    <span className={t.enabled ? 'text-emerald-300/80 text-[9px] uppercase' : 'text-white/30 text-[9px] uppercase'}>
                      {t.enabled ? 'enabled' : 'disabled'}
                    </span>
                    {t.next_run_at && (
                      <span className="ml-auto text-[10px] text-white/40 tabular-nums">
                        next: {fmtTime(t.next_run_at)}
                      </span>
                    )}
                  </div>
                  <pre className="text-[10px] text-white/55 font-mono leading-snug overflow-x-auto">{JSON.stringify(t.config, null, 2)}</pre>
                </li>
              ))}
            </ul>
          )}

          <form action={setTrigger} className="mt-3 space-y-2 border-t border-white/[0.05] pt-3">
            <input type="hidden" name="routine_id" value={routine.id} />
            <div className="grid grid-cols-3 gap-2">
              <select name="kind" required defaultValue="manual" className="bg-white/[0.04] border border-white/10 rounded px-2 py-1.5 text-[11px] text-white/85 focus:outline-none focus:border-white/30">
                <option value="cron">cron</option>
                <option value="event">event</option>
                <option value="webhook">webhook</option>
                <option value="manual">manual</option>
              </select>
              <label className="flex items-center gap-1.5 text-[11px] text-white/65">
                <input type="checkbox" name="enabled" defaultChecked className="accent-emerald-500" />
                Enabled
              </label>
              <button type="submit" className="px-3 py-1.5 bg-white/[0.06] hover:bg-white/[0.1] border border-white/10 rounded text-[11px] text-white/80">
                + Trigger
              </button>
            </div>
            <textarea
              name="config"
              rows={3}
              placeholder='{"cron": "0 8 * * *"} of {"event": "watchdog_failure"}'
              className="w-full bg-white/[0.04] border border-white/10 rounded px-2 py-1.5 text-[10.5px] font-mono text-white/80 focus:outline-none focus:border-white/30 resize-none"
            />
          </form>
        </section>
      </div>

      <section className="bg-white/[0.04] rounded-xl border border-white/[0.06] p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-medium text-white/70">Runs (laatste 50)</h2>
        </div>

        {runs.length === 0 ? (
          <p className="text-[11px] text-white/40 py-4">Nog geen runs. Klik "Run now" om er één te starten.</p>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="text-left text-[9px] uppercase tracking-wide text-white/35">
                <th className="pb-2 font-medium">Gestart</th>
                <th className="pb-2 font-medium">Status</th>
                <th className="pb-2 font-medium">Trigger</th>
                <th className="pb-2 font-medium">Service</th>
                <th className="pb-2 font-medium text-right">Duur</th>
                <th className="pb-2 font-medium text-right">Actie</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => {
                const canCancel = ['queued', 'running', 'paused', 'awaiting_approval'].includes(r.status)
                return (
                  <tr key={r.id} className="border-t border-white/[0.04]">
                    <td className="py-1.5 text-[10px] text-white/55 tabular-nums">{fmtTime(r.started_at)}</td>
                    <td className="py-1.5"><RunStatusBadge status={r.status} size="xs" /></td>
                    <td className="py-1.5 text-[10px] text-white/55 font-mono uppercase tracking-wide">{r.trigger_kind}</td>
                    <td className="py-1.5 text-[10px] text-white/40 font-mono">{r.service_id ?? '—'}</td>
                    <td className="py-1.5 text-right text-[10px] tabular-nums text-white/55">{fmtDuration(r.started_at, r.ended_at)}</td>
                    <td className="py-1.5 text-right">
                      {canCancel ? (
                        <form action={cancelRun}>
                          <input type="hidden" name="run_id" value={r.id} />
                          <button type="submit" className="text-[10px] text-red-300/80 hover:text-red-300 underline-offset-2 hover:underline">
                            Annuleer
                          </button>
                        </form>
                      ) : (
                        <span className="text-[10px] text-white/20">—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </section>

      <div className="text-[10px] text-white/30">
        <Link href="/dashboard/build-tracker/routines" className="hover:text-white/60">← Terug naar Routines Overview</Link>
      </div>
    </div>
  )
}
