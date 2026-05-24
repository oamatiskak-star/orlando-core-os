import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getActiveCompany } from '@/lib/active-company-server'
import { RoutineStatusBadge } from '@/lib/routines/badges'
import type { RoutineRow } from '@/lib/routines/types'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type RoutineWithCounts = RoutineRow & {
  step_count: number
  trigger_count: number
  last_run_at: string | null
  last_run_status: string | null
}

function fmtTimeAgo(s: string | null): string {
  if (!s) return 'nooit'
  const diff = Date.now() - new Date(s).getTime()
  if (diff < 60_000)     return 'zojuist'
  if (diff < 3_600_000)  return `${Math.floor(diff / 60_000)}m`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}u`
  return new Date(s).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })
}

export default async function RoutinesWorkflowsPage() {
  const company = await getActiveCompany()
  const supabase = await createClient()

  const { data: companyRow } = await supabase.from('companies').select('id').eq('slug', company.id).maybeSingle()
  const companyId = companyRow?.id ?? null

  // We willen 'workflow' kind specifiek tonen
  const baseQuery = supabase
    .from('routines')
    .select('id, company_id, slug, name, description, kind, status, owner_user_id, created_at, updated_at')
    .eq('kind', 'workflow')

  const routinesQuery = companyId
    ? baseQuery.or(`company_id.eq.${companyId},company_id.is.null`).order('updated_at', { ascending: false })
    : baseQuery.is('company_id', null).order('updated_at', { ascending: false })

  const { data: routines } = await routinesQuery

  // Fetch counts + last run per routine
  const ids = (routines ?? []).map(r => r.id)
  const [stepsRes, triggersRes, lastRunsRes] = await Promise.all([
    ids.length > 0
      ? supabase.from('routine_steps').select('routine_id').in('routine_id', ids)
      : Promise.resolve({ data: [] as { routine_id: string }[] }),
    ids.length > 0
      ? supabase.from('routine_triggers').select('routine_id').in('routine_id', ids)
      : Promise.resolve({ data: [] as { routine_id: string }[] }),
    ids.length > 0
      ? supabase
          .from('routine_runs')
          .select('routine_id, status, started_at')
          .in('routine_id', ids)
          .order('started_at', { ascending: false })
      : Promise.resolve({ data: [] as { routine_id: string; status: string; started_at: string }[] }),
  ])

  const stepCount   = new Map<string, number>()
  ;(stepsRes.data ?? []).forEach(s => stepCount.set(s.routine_id, (stepCount.get(s.routine_id) ?? 0) + 1))

  const triggerCount = new Map<string, number>()
  ;(triggersRes.data ?? []).forEach(t => triggerCount.set(t.routine_id, (triggerCount.get(t.routine_id) ?? 0) + 1))

  const lastRun = new Map<string, { status: string; started_at: string }>()
  ;(lastRunsRes.data ?? []).forEach(r => {
    if (!lastRun.has(r.routine_id)) lastRun.set(r.routine_id, { status: r.status, started_at: r.started_at })
  })

  const rows: RoutineWithCounts[] = (routines ?? []).map(r => ({
    ...(r as RoutineRow),
    step_count:      stepCount.get(r.id) ?? 0,
    trigger_count:   triggerCount.get(r.id) ?? 0,
    last_run_at:     lastRun.get(r.id)?.started_at ?? null,
    last_run_status: lastRun.get(r.id)?.status ?? null,
  }))

  return (
    <div className="space-y-5">
      <div className="bg-white/[0.04] rounded-xl border border-white/[0.06] p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-xs font-medium text-white/70">Workflows (kind = workflow)</h2>
            <p className="text-[10px] text-white/40">Multi-step routines met chaining van action / condition / approval / fallback.</p>
          </div>
          <Link
            href="/dashboard/build-tracker/routines/builder"
            className="px-3 py-1.5 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/30 text-emerald-200 rounded-lg text-[11px] font-medium"
          >
            + Nieuwe workflow
          </Link>
        </div>

        {rows.length === 0 ? (
          <div className="py-12 text-center text-[11px] text-white/40">
            Geen workflows voor {company.short}.
            <br/>Maak één aan via Builder → kies kind=workflow.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {rows.map(r => (
              <Link
                key={r.id}
                href={`/dashboard/build-tracker/routines/${r.id}`}
                className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-3 hover:border-white/15 transition-colors"
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <RoutineStatusBadge status={r.status} size="xs" />
                  <span className="text-[10px] text-white/35 font-mono">{r.slug}</span>
                </div>
                <p className="text-[13px] text-white/90 font-medium leading-tight">{r.name}</p>
                {r.description && (
                  <p className="text-[10.5px] text-white/50 mt-1 leading-snug line-clamp-2">{r.description}</p>
                )}
                <div className="mt-2 grid grid-cols-3 gap-2 text-[10px]">
                  <div>
                    <p className="text-white/35 uppercase tracking-wide">Steps</p>
                    <p className="text-white/70 tabular-nums">{r.step_count}</p>
                  </div>
                  <div>
                    <p className="text-white/35 uppercase tracking-wide">Triggers</p>
                    <p className="text-white/70 tabular-nums">{r.trigger_count}</p>
                  </div>
                  <div>
                    <p className="text-white/35 uppercase tracking-wide">Laatste run</p>
                    <p className="text-white/70">{fmtTimeAgo(r.last_run_at)}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
