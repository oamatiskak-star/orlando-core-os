import Link from 'next/link'
import { Bot, Clock, Zap, Activity, GitMerge } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getActiveCompany } from '@/lib/active-company-server'
import { KpiStrip, type Kpi } from '@/components/executive/KpiStrip'
import { RoutineStatusBadge } from '@/lib/routines/badges'
import type { RoutineRow, RoutineKind, RoutineStatus, SystemHealthRow } from '@/lib/routines/types'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const KIND_ICON: Record<RoutineKind, typeof Bot> = {
  agent:    Bot,
  workflow: GitMerge,
  cron:     Clock,
  reactive: Zap,
}

function fmtTimeAgo(s: string | null): string {
  if (!s) return '—'
  const t = new Date(s).getTime()
  const diff = Date.now() - t
  if (diff < 60_000) return 'zojuist'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m geleden`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}u geleden`
  return new Date(s).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })
}

export default async function RoutinesHubPage() {
  const company = await getActiveCompany()
  const supabase = await createClient()

  const companyRow = await supabase.from('companies').select('id').eq('slug', company.id).maybeSingle()
  const companyId = companyRow.data?.id ?? null

  const baseQuery = supabase
    .from('routines')
    .select('id, company_id, slug, name, description, kind, status, owner_user_id, created_at, updated_at')

  const routinesQuery = companyId
    ? baseQuery.or(`company_id.eq.${companyId},company_id.is.null`).order('updated_at', { ascending: false })
    : baseQuery.is('company_id', null).order('updated_at', { ascending: false })

  const [routinesRes, healthRes, activeRunsRes] = await Promise.all([
    routinesQuery,
    supabase.from('v_system_health').select('source, status, ok_count, fail_count'),
    supabase
      .from('routine_runs')
      .select('id, status')
      .in('status', ['queued', 'running', 'paused', 'awaiting_approval']),
  ])

  const routines: RoutineRow[] = (routinesRes.data ?? []) as RoutineRow[]
  const health: Pick<SystemHealthRow, 'source' | 'status' | 'ok_count' | 'fail_count'>[] =
    (healthRes.data ?? []) as never[]
  const activeRuns = activeRunsRes.data ?? []

  const byStatus = routines.reduce<Record<RoutineStatus, number>>(
    (acc, r) => {
      acc[r.status] = (acc[r.status] ?? 0) + 1
      return acc
    },
    { active: 0, paused: 0, disabled: 0, draft: 0 },
  )

  const totalAgents = health.filter(h => h.source === 'acq' || h.source === 'executive').length
  const queueOpen = health
    .filter(h => h.source === 'orchestrator')
    .reduce((acc, h) => acc + (h.ok_count ?? 0) + (h.fail_count ?? 0), 0)
  const watchdogServices = health.filter(h => h.source === 'watchdog').length

  const kpis: Kpi[] = [
    { label: 'Active routines',  value: byStatus.active,   accent: byStatus.active > 0 ? 'emerald' : 'white' },
    { label: 'Active runs',      value: activeRuns.length, accent: activeRuns.length > 0 ? 'indigo' : 'white' },
    { label: 'Paused / draft',   value: byStatus.paused + byStatus.draft,                                    accent: byStatus.paused > 0 ? 'amber' : 'white' },
    { label: 'Agent registry',   value: totalAgents,       hint: 'acq + executive', accent: 'violet' },
    { label: 'Watchdog (1h)',    value: watchdogServices,  hint: watchdogServices > 0 ? 'events' : 'quiet', accent: watchdogServices > 5 ? 'red' : 'white' },
  ]

  return (
    <div className="space-y-5">
      <KpiStrip items={kpis} />

      <div className="bg-white/[0.04] rounded-xl border border-white/[0.06] p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-xs font-medium text-white/70">Routines voor {company.short}</h2>
            <p className="text-[10px] text-white/40">Gefilterd op company slug — globale routines (geen company) tonen ook</p>
          </div>
          <div className="text-[10px] text-white/40 tabular-nums">{routines.length} routine{routines.length === 1 ? '' : 's'}</div>
        </div>

        {routines.length === 0 ? (
          <div className="py-12 text-center">
            <Activity size={24} className="text-white/15 mx-auto mb-3" />
            <p className="text-[12px] text-white/50">Nog geen routines gedefinieerd</p>
            <p className="text-[10px] text-white/30 mt-1">
              Routines worden aangemaakt via Builder (komt in Fase 2) of via Supabase insert
            </p>
            <p className="text-[10px] text-white/30 mt-1">
              Queue depth: <span className="tabular-nums text-white/50">{queueOpen}</span> · Agent registry:{' '}
              <span className="tabular-nums text-white/50">{totalAgents}</span>
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {routines.map((r) => {
              const Icon = KIND_ICON[r.kind]
              return (
                <div key={r.id} className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-3 hover:border-white/15 transition-colors">
                  <div className="flex items-center gap-2 mb-1.5">
                    <Icon size={12} className="text-white/40" />
                    <span className="text-[10px] uppercase tracking-wide text-white/35">{r.kind}</span>
                    <span className="text-white/15">·</span>
                    <RoutineStatusBadge status={r.status} size="xs" />
                  </div>
                  <p className="text-[13px] text-white/90 font-medium leading-tight">{r.name}</p>
                  {r.description && (
                    <p className="text-[10.5px] text-white/50 mt-1 leading-snug line-clamp-2">{r.description}</p>
                  )}
                  <div className="mt-2 flex items-center justify-between text-[10px] text-white/40">
                    <span className="font-mono">{r.slug}</span>
                    <span>updated {fmtTimeAgo(r.updated_at)}</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="text-[10px] text-white/30">
        Volgende fases:{' '}
        <Link href="#" aria-disabled className="text-white/35 cursor-not-allowed">Builder (F2)</Link> ·{' '}
        <Link href="#" aria-disabled className="text-white/35 cursor-not-allowed">Recovery (F4)</Link> ·{' '}
        <Link href="#" aria-disabled className="text-white/35 cursor-not-allowed">Intelligence (F5)</Link>
      </div>
    </div>
  )
}
