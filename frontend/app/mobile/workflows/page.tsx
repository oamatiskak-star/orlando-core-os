import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import StatusPill from '@/components/mobile/StatusPill'
import { GitBranch, Activity, CheckCircle, XCircle, Clock, Play, Pause } from 'lucide-react'

export const metadata: Metadata = { title: 'Workflows' }
export const dynamic = 'force-dynamic'
export const revalidate = 0

function timeAgo(iso: string | null): string {
  if (!iso) return '—'
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 1) return 'Nu'
  if (m < 60) return `${m}m geleden`
  if (m < 1440) return `${Math.floor(m / 60)}u geleden`
  return `${Math.floor(m / 1440)}d geleden`
}

function duration(start: string | null, end: string | null): string {
  if (!start) return '—'
  const ms = (end ? new Date(end).getTime() : Date.now()) - new Date(start).getTime()
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s`
  return `${Math.floor(s / 60)}m ${s % 60}s`
}

export default async function MobileWorkflowsPage() {
  const supabase = await createClient()

  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const [
    workflowsRes,
    runs24hRes,
    failedRunsRes,
    recentRunsRes,
  ] = await Promise.allSettled([
    supabase.from('oc_workflows').select('id,naam,status,trigger_type,last_run_at,description').order('status').order('naam'),
    supabase.from('oc_workflow_runs').select('id', { count: 'exact', head: true }).gte('started_at', since24h),
    supabase.from('oc_workflow_runs').select('id', { count: 'exact', head: true }).gte('started_at', since24h).eq('status', 'failed'),
    supabase.from('oc_workflow_runs')
      .select('id,workflow_id,status,started_at,finished_at,error_message')
      .order('started_at', { ascending: false })
      .limit(15),
  ])

  const workflows   = workflowsRes.status    === 'fulfilled' ? (workflowsRes.value.data    ?? []) : []
  const runs24h     = runs24hRes.status       === 'fulfilled' ? (runs24hRes.value.count     ?? 0) : 0
  const failedRuns  = failedRunsRes.status    === 'fulfilled' ? (failedRunsRes.value.count  ?? 0) : 0
  const recentRuns  = recentRunsRes.status    === 'fulfilled' ? (recentRunsRes.value.data   ?? []) : []

  const activeWf  = workflows.filter((w: any) => w.status === 'actief').length
  const pausedWf  = workflows.filter((w: any) => w.status !== 'actief').length
  const successRuns = runs24h - failedRuns

  // Map workflow id → naam for run display
  const wfMap = Object.fromEntries(workflows.map((w: any) => [w.id, w.naam]))

  return (
    <div className="max-w-lg mx-auto px-4 py-5 space-y-6"
      style={{ paddingTop: 'calc(1.25rem + env(safe-area-inset-top))' }}>

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
          <GitBranch size={16} className="text-emerald-400" />
        </div>
        <div>
          <h1 className="text-base font-bold text-white">Workflow Engine</h1>
          <p className="text-[11px] text-white/40">Automatisering & jobs</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2.5">
        <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-4">
          <Play size={14} className="text-emerald-400 mb-2" />
          <p className="text-xl font-bold text-emerald-400">{activeWf}</p>
          <p className="text-[10px] text-white/40 mt-0.5">Actieve workflows</p>
        </div>
        <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-4">
          <Activity size={14} className="text-sky-400 mb-2" />
          <p className="text-xl font-bold text-sky-400">{runs24h}</p>
          <p className="text-[10px] text-white/40 mt-0.5">Runs (24u)</p>
        </div>
        <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-4">
          <CheckCircle size={14} className="text-indigo-400 mb-2" />
          <p className="text-xl font-bold text-indigo-400">{successRuns}</p>
          <p className="text-[10px] text-white/40 mt-0.5">Geslaagd</p>
        </div>
        <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-4">
          <XCircle size={14} className={`mb-2 ${failedRuns > 0 ? 'text-red-400' : 'text-white/30'}`} />
          <p className={`text-xl font-bold ${failedRuns > 0 ? 'text-red-400' : 'text-white/30'}`}>{failedRuns}</p>
          <p className="text-[10px] text-white/40 mt-0.5">Mislukt (24u)</p>
        </div>
      </div>

      {/* Workflows list */}
      {workflows.length > 0 && (
        <section>
          <h2 className="text-[11px] text-white/38 font-semibold uppercase tracking-wider mb-3">Workflows</h2>
          <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl divide-y divide-white/[0.04]">
            {workflows.map((wf: any) => (
              <div key={wf.id} className="flex items-center gap-3 px-4 py-3">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${wf.status === 'actief' ? 'bg-emerald-400' : 'bg-white/20'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] text-white/75 font-medium truncate">{wf.naam}</p>
                  <p className="text-[10px] text-white/35 truncate">
                    {wf.trigger_type ?? '—'}
                    {wf.last_run_at ? ` · ${timeAgo(wf.last_run_at)}` : ''}
                  </p>
                </div>
                <StatusPill status={wf.status === 'actief' ? 'online' : 'offline'} size="xs" />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Recent runs */}
      {recentRuns.length > 0 && (
        <section>
          <h2 className="text-[11px] text-white/38 font-semibold uppercase tracking-wider mb-3">Recente runs</h2>
          <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl divide-y divide-white/[0.04]">
            {recentRuns.map((run: any) => (
              <div key={run.id} className="flex items-center gap-3 px-4 py-3">
                {run.status === 'success' ? (
                  <CheckCircle size={13} className="text-emerald-400 flex-shrink-0" />
                ) : run.status === 'failed' ? (
                  <XCircle size={13} className="text-red-400 flex-shrink-0" />
                ) : (
                  <Clock size={13} className="text-sky-400 flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] text-white/70 font-medium truncate">
                    {wfMap[run.workflow_id] ?? run.workflow_id ?? 'Onbekend'}
                  </p>
                  {run.error_message && (
                    <p className="text-[10px] text-red-400/70 truncate">{run.error_message}</p>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-[10px] text-white/35">{timeAgo(run.started_at)}</p>
                  <p className="text-[10px] text-white/25">{duration(run.started_at, run.finished_at)}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {workflows.length === 0 && (
        <div className="text-center py-12">
          <GitBranch size={32} className="text-white/15 mx-auto mb-3" />
          <p className="text-sm text-white/30">Geen workflows gevonden</p>
        </div>
      )}
    </div>
  )
}
