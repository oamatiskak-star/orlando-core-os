import { createClient } from '@/lib/supabase/server'
import { KpiStrip, type Kpi } from '@/components/executive/KpiStrip'
import { HealthStatusBadge } from '@/lib/routines/badges'
import type { SystemHealthRow } from '@/lib/routines/types'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const SOURCE_LABEL: Record<string, { name: string; color: string }> = {
  acq:          { name: 'Acquisition agents', color: '#6366f1' },
  executive:    { name: 'Executive LLM agents', color: '#a855f7' },
  watchdog:     { name: 'Watchdog services',  color: '#06b6d4' },
  orchestrator: { name: 'Orchestrator executors', color: '#f59e0b' },
  routines:     { name: 'Routine run states',  color: '#10b981' },
}

function fmtTimeAgo(s: string | null): string {
  if (!s) return 'nooit'
  const diff = Date.now() - new Date(s).getTime()
  if (diff < 60_000) return 'zojuist'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}u`
  return new Date(s).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })
}

export default async function RoutinesAgentsPage() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('v_system_health')
    .select('source, id, label, kind, status, last_seen, ok_count, fail_count, note')

  const rows = (data ?? []) as SystemHealthRow[]

  const grouped = rows.reduce<Record<string, SystemHealthRow[]>>((acc, r) => {
    (acc[r.source] ??= []).push(r)
    return acc
  }, {})

  const totalAgents = (grouped.acq?.length ?? 0) + (grouped.executive?.length ?? 0)
  const idleCount = rows.filter(r => r.status === 'idle' || r.status === 'empty').length
  const failedCount = rows.filter(r => ['failed', 'crashed', 'errored', 'disabled'].includes(r.status.toLowerCase())).length
  const totalOk = rows.reduce((acc, r) => acc + (r.ok_count ?? 0), 0)
  const totalFail = rows.reduce((acc, r) => acc + (r.fail_count ?? 0), 0)

  const kpis: Kpi[] = [
    { label: 'Total agents',   value: totalAgents,   hint: 'acq + executive', accent: 'violet' },
    { label: 'Idle / empty',   value: idleCount,     accent: 'white' },
    { label: 'Failed / off',   value: failedCount,   accent: failedCount > 0 ? 'red' : 'white' },
    { label: 'Tasks done',     value: totalOk,       accent: 'emerald' },
    { label: 'Tasks failed',   value: totalFail,     accent: totalFail > 0 ? 'red' : 'white' },
  ]

  return (
    <div className="space-y-5">
      <KpiStrip items={kpis} />

      {error && (
        <div className="bg-red-500/10 border border-red-400/30 rounded-xl p-4 text-[11px] text-red-300">
          v_system_health niet beschikbaar — {error.message}
        </div>
      )}

      {Object.entries(grouped).map(([source, items]) => {
        const meta = SOURCE_LABEL[source] ?? { name: source, color: '#ffffff' }
        return (
          <section key={source} className="bg-white/[0.04] rounded-xl border border-white/[0.06] p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: meta.color }} />
              <h2 className="text-xs font-medium text-white/80">{meta.name}</h2>
              <span className="text-[10px] text-white/40 tabular-nums">{items.length}</span>
            </div>
            <table className="w-full">
              <thead>
                <tr className="text-left text-[9px] uppercase tracking-wide text-white/35">
                  <th className="pb-2 font-medium">Naam</th>
                  <th className="pb-2 font-medium">Type</th>
                  <th className="pb-2 font-medium">Status</th>
                  <th className="pb-2 font-medium text-right">Done</th>
                  <th className="pb-2 font-medium text-right">Fail</th>
                  <th className="pb-2 font-medium text-right">Last seen</th>
                </tr>
              </thead>
              <tbody>
                {items.map((r) => (
                  <tr key={`${source}-${r.id}`} className="border-t border-white/[0.04]">
                    <td className="py-1.5 text-[11px] text-white/85">
                      {r.label}
                      {r.note && <div className="text-[9px] text-white/35 mt-0.5 font-mono truncate max-w-[260px]">{r.note}</div>}
                    </td>
                    <td className="py-1.5 text-[10px] text-white/50 font-mono">{r.kind ?? '—'}</td>
                    <td className="py-1.5"><HealthStatusBadge status={r.status} /></td>
                    <td className="py-1.5 text-right text-[10px] tabular-nums text-emerald-300/80">{r.ok_count ?? 0}</td>
                    <td className="py-1.5 text-right text-[10px] tabular-nums text-red-300/80">{r.fail_count ?? 0}</td>
                    <td className="py-1.5 text-right text-[10px] text-white/45">{fmtTimeAgo(r.last_seen)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )
      })}

      {rows.length === 0 && !error && (
        <div className="py-16 text-center bg-white/[0.02] border border-dashed border-white/10 rounded-xl">
          <p className="text-[12px] text-white/40">Geen agent/health data beschikbaar</p>
          <p className="text-[10px] text-white/25 mt-1">v_system_health view bevat geen rijen — verifieer migratie 089</p>
        </div>
      )}
    </div>
  )
}
