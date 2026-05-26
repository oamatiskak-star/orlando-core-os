import { AlertCircle, FileWarning, XCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getActiveCompany } from '@/lib/active-company-server'
import { resolveHumanAction } from '../actions'
import { HUMAN_ACTION_LABEL, type HumanActionRow } from '@/lib/affiliate-programs/types'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type FailedRun = { id: string; program_id: string | null; run_kind: string; error: unknown; ended_at: string | null }
type ProgramName = { id: string; name: string }

function fmt(s: string | null): string {
  if (!s) return '—'
  return new Date(s).toLocaleString('nl-NL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export default async function RequiresActionPage() {
  const company = await getActiveCompany()
  const supabase = await createClient()

  const companyRow = await supabase.from('companies').select('id').eq('slug', company.id).maybeSingle()
  const companyId = companyRow.data?.id ?? null

  let progQuery = supabase.from('affiliate_programs').select('id, name')
  progQuery = companyId
    ? progQuery.or(`company_id.eq.${companyId},company_id.is.null`)
    : progQuery.is('company_id', null)
  const { data: progData } = await progQuery
  const programs: ProgramName[] = (progData ?? []) as ProgramName[]
  const programIds = programs.map(p => p.id)
  const nameById = new Map(programs.map(p => [p.id, p.name]))

  const empty = programIds.length === 0

  const [actionsRes, failedRes] = await Promise.all([
    empty
      ? Promise.resolve({ data: [] })
      : supabase
          .from('account_setup_human_actions')
          .select('id, program_id, run_id, action_kind, title, description, status, assigned_to, due_at, resolved_at, created_at, updated_at')
          .in('program_id', programIds)
          .in('status', ['open', 'in_progress'])
          .order('due_at', { ascending: true, nullsFirst: false }),
    empty
      ? Promise.resolve({ data: [] })
      : supabase
          .from('account_setup_runs')
          .select('id, program_id, run_kind, error, ended_at')
          .in('program_id', programIds)
          .eq('status', 'failed')
          .order('ended_at', { ascending: false })
          .limit(50),
  ])

  const actions: HumanActionRow[] = (actionsRes.data ?? []) as HumanActionRow[]
  const failedRuns: FailedRun[] = (failedRes.data ?? []) as FailedRun[]

  return (
    <div className="space-y-5">
      {/* Human Action Center */}
      <div className="bg-white/[0.04] rounded-xl border border-white/[0.06] p-4">
        <div className="flex items-center gap-2 mb-3">
          <AlertCircle size={14} className="text-amber-300" />
          <h2 className="text-xs font-medium text-white/70">Human Action Center</h2>
          <span className="ml-auto text-[10px] text-white/40 tabular-nums">{actions.length} open</span>
        </div>

        {actions.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-[11px] text-white/40">Geen openstaande menselijke acties.</p>
            <p className="text-[10px] text-white/25 mt-1">KYC-uploads, SMS-verificaties, captcha&apos;s en tax forms verschijnen hier zodra de agent ze aanmaakt.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {actions.map((a) => (
              <div key={a.id} className="flex items-start gap-3 bg-white/[0.02] border border-white/[0.05] rounded-lg p-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] uppercase tracking-wide px-1.5 py-0.5 rounded border border-amber-400/30 bg-amber-500/10 text-amber-300">
                      {HUMAN_ACTION_LABEL[a.action_kind]}
                    </span>
                    <span className="text-[12px] text-white/85 font-medium truncate">{a.title}</span>
                  </div>
                  <div className="text-[10px] text-white/45 mt-0.5">
                    {nameById.get(a.program_id ?? '') ?? 'Onbekend programma'}
                    {a.due_at && <span className="text-amber-300/70"> · due {fmt(a.due_at)}</span>}
                  </div>
                  {a.description && <p className="text-[10.5px] text-white/55 mt-1 leading-snug">{a.description}</p>}
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <form action={resolveHumanAction}>
                    <input type="hidden" name="action_id" value={a.id} />
                    <input type="hidden" name="decision" value="resolved" />
                    <button type="submit" className="px-2 py-1 text-[10px] bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/30 rounded text-emerald-200">
                      Resolved
                    </button>
                  </form>
                  <form action={resolveHumanAction}>
                    <input type="hidden" name="action_id" value={a.id} />
                    <input type="hidden" name="decision" value="dismissed" />
                    <button type="submit" className="px-2 py-1 text-[10px] bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 rounded text-white/55">
                      Dismiss
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Failed runs */}
      <div className="bg-white/[0.04] rounded-xl border border-white/[0.06] p-4">
        <div className="flex items-center gap-2 mb-3">
          <XCircle size={14} className="text-red-300" />
          <h2 className="text-xs font-medium text-white/70">Mislukte runs</h2>
          <span className="ml-auto text-[10px] text-white/40 tabular-nums">{failedRuns.length}</span>
        </div>
        {failedRuns.length === 0 ? (
          <div className="py-6 text-center">
            <FileWarning size={20} className="text-white/15 mx-auto mb-2" />
            <p className="text-[11px] text-white/40">Geen mislukte runs.</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {failedRuns.map((r) => (
              <div key={r.id} className="flex items-center gap-3 text-[10.5px] bg-white/[0.02] border border-white/[0.05] rounded-lg px-3 py-2">
                <span className="font-mono text-white/40">{r.id.slice(0, 8)}</span>
                <span className="text-white/70">{nameById.get(r.program_id ?? '') ?? '—'}</span>
                <span className="text-white/40 font-mono">{r.run_kind}</span>
                <span className="ml-auto text-white/35 tabular-nums">{fmt(r.ended_at)}</span>
                <span className="text-red-300/80 font-mono truncate max-w-[240px]">
                  {typeof r.error === 'object' && r.error ? JSON.stringify(r.error) : String(r.error ?? '')}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
