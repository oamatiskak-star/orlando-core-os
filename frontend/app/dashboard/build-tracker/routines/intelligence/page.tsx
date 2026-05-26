import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { KpiStrip, type Kpi } from '@/components/executive/KpiStrip'
import { ackRecommendation, dismissAlert } from '../actions'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type RecRow = {
  id: string
  action_kind: string
  target_kind: string
  target_id: string | null
  priority: number
  rationale: string | null
  payload: Record<string, unknown>
  status: string
  created_at: string
}

type AlertRow = {
  id: string
  alert_kind: string
  severity: string
  target_kind: string
  target_id: string | null
  title: string
  message: string
  payload: Record<string, unknown>
  detected_at: string
  acknowledged_at: string | null
}

type TickLogRow = {
  id: number
  detail: { duplications?: number; bottlenecks?: number; dead_routines?: number; recovery_gaps?: number; at?: string }
  created_at: string
}

const SEVERITY_STYLE: Record<string, string> = {
  critical: 'bg-red-500/10 text-red-300 border-red-400/30',
  high:     'bg-orange-500/10 text-orange-300 border-orange-400/30',
  medium:   'bg-amber-500/10 text-amber-300 border-amber-400/30',
  low:      'bg-white/[0.04] text-white/50 border-white/10',
  info:     'bg-indigo-500/10 text-indigo-300 border-indigo-400/30',
}

const ACTION_STYLE: Record<string, string> = {
  dedupe_routines:      'bg-violet-500/10 text-violet-300 border-violet-400/30',
  archive_dead_routine: 'bg-amber-500/10 text-amber-300 border-amber-400/30',
}

function fmtTime(s: string): string {
  return new Date(s).toLocaleString('nl-NL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export default async function RoutinesIntelligencePage() {
  const supabase = await createClient()

  const [recsRes, alertsRes, ticksRes] = await Promise.all([
    supabase
      .from('executive_recommendations')
      .select('id, action_kind, target_kind, target_id, priority, rationale, payload, status, created_at')
      .eq('target_kind', 'routine')
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(50),

    supabase
      .from('executive_alerts')
      .select('id, alert_kind, severity, target_kind, target_id, title, message, payload, detected_at, acknowledged_at')
      .eq('target_kind', 'routine')
      .order('detected_at', { ascending: false })
      .limit(50),

    supabase
      .from('routine_audit_log')
      .select('id, detail, created_at')
      .eq('action', 'intelligence.tick')
      .order('created_at', { ascending: false })
      .limit(10),
  ])

  const recs   = (recsRes.data ?? []) as RecRow[]
  const alerts = (alertsRes.data ?? []) as AlertRow[]
  const ticks  = (ticksRes.data ?? []) as TickLogRow[]

  const pendingRecs = recs.filter(r => r.status === 'pending')
  const unackAlerts = alerts.filter(a => !a.acknowledged_at)
  const lastTick    = ticks[0]
  const lastTickStats = lastTick?.detail ?? {}

  const kpis: Kpi[] = [
    { label: 'Pending recs',     value: pendingRecs.length, accent: pendingRecs.length > 0 ? 'violet' : 'white' },
    { label: 'Unack alerts',     value: unackAlerts.length, accent: unackAlerts.length > 0 ? 'red' : 'white' },
    { label: 'Duplicaten',       value: lastTickStats.duplications ?? 0,  accent: 'indigo' },
    { label: 'Bottlenecks',      value: lastTickStats.bottlenecks ?? 0,   accent: 'amber' },
    { label: 'Dead routines',    value: lastTickStats.dead_routines ?? 0, accent: 'white' },
  ]

  return (
    <div className="space-y-5">
      <KpiStrip items={kpis} />

      <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-3 text-[10.5px] text-white/50 leading-relaxed">
        <strong className="text-white/70">Intelligence Engine</strong> — pg_cron <code className="font-mono text-white/65">routines_intelligence_tick</code> draait elke 15 min en detecteert:
        duplicaten (zelfde URL in &gt;1 routine), bottlenecks (avg duration &gt;30m), dead routines (active maar geen runs in 14d), recovery gaps (failed zonder retry).
        Bevindingen landen in <code className="font-mono text-white/65">executive_recommendations</code> (target_kind=&apos;routine&apos;) en <code className="font-mono text-white/65">executive_alerts</code>.
        {lastTick && (
          <span className="block mt-1 text-white/35">Laatste tick: {fmtTime(lastTick.created_at)}</span>
        )}
      </div>

      <section className="bg-white/[0.04] rounded-xl border border-white/[0.06] p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-medium text-white/70">Recommendations ({pendingRecs.length} pending / {recs.length} totaal)</h2>
        </div>

        {recs.length === 0 ? (
          <div className="py-8 text-center text-[11px] text-white/40">
            Geen aanbevelingen — Intelligence Engine heeft nog geen findings opgeleverd.
            <br/>Eerstvolgende cron-tick: ~elke 15 minuten op de klok.
          </div>
        ) : (
          <ul className="space-y-2">
            {recs.map((r) => {
              const style = ACTION_STYLE[r.action_kind] ?? 'bg-indigo-500/10 text-indigo-300 border-indigo-400/30'
              const isPending = r.status === 'pending'
              return (
                <li key={r.id} className={`bg-white/[0.02] border rounded-lg p-3 ${isPending ? 'border-white/[0.08]' : 'border-white/[0.04] opacity-60'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className={`inline-flex items-center px-1.5 py-0.5 text-[9px] uppercase tracking-wide rounded border ${style}`}>
                          {r.action_kind}
                        </span>
                        <span className="text-[9px] uppercase tracking-wide text-white/35">priority {r.priority}</span>
                        <span className="text-[9px] uppercase tracking-wide text-white/35">{r.status}</span>
                        {r.target_id && (
                          <Link href={`/dashboard/build-tracker/routines/${r.target_id}`} className="text-[10px] text-white/50 font-mono hover:text-white/80">
                            {r.target_id.slice(0, 8)}…
                          </Link>
                        )}
                      </div>
                      <p className="text-[11px] text-white/80 leading-snug">{r.rationale ?? '—'}</p>
                      {Object.keys(r.payload ?? {}).length > 0 && (
                        <details className="mt-1.5">
                          <summary className="text-[9.5px] text-white/35 cursor-pointer hover:text-white/55">Payload</summary>
                          <pre className="text-[10px] text-white/55 font-mono mt-1 leading-snug overflow-x-auto">{JSON.stringify(r.payload, null, 2)}</pre>
                        </details>
                      )}
                    </div>
                    {isPending && (
                      <form action={ackRecommendation} className="shrink-0">
                        <input type="hidden" name="id" value={r.id} />
                        <button type="submit" className="px-2.5 py-1 text-[10px] bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/30 text-emerald-200 rounded">
                          ✓ Ack
                        </button>
                      </form>
                    )}
                  </div>
                  <p className="text-[9px] text-white/30 mt-2 font-mono">created {fmtTime(r.created_at)}</p>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section className="bg-white/[0.04] rounded-xl border border-white/[0.06] p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-medium text-white/70">Alerts ({unackAlerts.length} unack / {alerts.length} totaal)</h2>
        </div>

        {alerts.length === 0 ? (
          <div className="py-8 text-center text-[11px] text-white/40">Geen routine-alerts. (Mooi.)</div>
        ) : (
          <ul className="space-y-2">
            {alerts.map((a) => {
              const isUnack = !a.acknowledged_at
              return (
                <li key={a.id} className={`bg-white/[0.02] border rounded-lg p-3 ${isUnack ? 'border-white/[0.08]' : 'border-white/[0.04] opacity-60'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className={`inline-flex items-center px-1.5 py-0.5 text-[9px] uppercase tracking-wide rounded border ${SEVERITY_STYLE[a.severity] ?? SEVERITY_STYLE.info}`}>
                          {a.severity}
                        </span>
                        <span className="text-[9px] uppercase tracking-wide text-white/35">{a.alert_kind}</span>
                        {a.target_id && (
                          <Link href={`/dashboard/build-tracker/routines/${a.target_id}`} className="text-[10px] text-white/50 font-mono hover:text-white/80">
                            {a.target_id.slice(0, 8)}…
                          </Link>
                        )}
                      </div>
                      <div className="text-[11px] text-white/85 font-medium">{a.title}</div>
                      <p className="text-[10.5px] text-white/55 mt-1 leading-snug">{a.message}</p>
                      {Object.keys(a.payload ?? {}).length > 0 && (
                        <details className="mt-1.5">
                          <summary className="text-[9.5px] text-white/35 cursor-pointer hover:text-white/55">Payload</summary>
                          <pre className="text-[10px] text-white/55 font-mono mt-1 leading-snug overflow-x-auto">{JSON.stringify(a.payload, null, 2)}</pre>
                        </details>
                      )}
                    </div>
                    {isUnack && (
                      <form action={dismissAlert} className="shrink-0">
                        <input type="hidden" name="id" value={a.id} />
                        <button type="submit" className="px-2.5 py-1 text-[10px] bg-white/[0.06] hover:bg-white/[0.1] border border-white/10 text-white/65 rounded">
                          ack
                        </button>
                      </form>
                    )}
                  </div>
                  <p className="text-[9px] text-white/30 mt-2 font-mono">detected {fmtTime(a.detected_at)}</p>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section className="bg-white/[0.04] rounded-xl border border-white/[0.06] p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-medium text-white/70">Tick history (laatste 10)</h2>
        </div>

        {ticks.length === 0 ? (
          <p className="text-[11px] text-white/40 py-4">pg_cron heeft nog niet gedraaid.</p>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="text-left text-[9px] uppercase tracking-wide text-white/35">
                <th className="pb-2 font-medium">Tijd</th>
                <th className="pb-2 font-medium text-right">Dups</th>
                <th className="pb-2 font-medium text-right">Bottle</th>
                <th className="pb-2 font-medium text-right">Dead</th>
                <th className="pb-2 font-medium text-right">Recov</th>
              </tr>
            </thead>
            <tbody>
              {ticks.map((t) => (
                <tr key={t.id} className="border-t border-white/[0.04]">
                  <td className="py-1.5 text-[10px] text-white/55 tabular-nums">{fmtTime(t.created_at)}</td>
                  <td className="py-1.5 text-right text-[10px] tabular-nums text-violet-300/80">{t.detail.duplications ?? 0}</td>
                  <td className="py-1.5 text-right text-[10px] tabular-nums text-amber-300/80">{t.detail.bottlenecks ?? 0}</td>
                  <td className="py-1.5 text-right text-[10px] tabular-nums text-white/55">{t.detail.dead_routines ?? 0}</td>
                  <td className="py-1.5 text-right text-[10px] tabular-nums text-red-300/80">{t.detail.recovery_gaps ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}
