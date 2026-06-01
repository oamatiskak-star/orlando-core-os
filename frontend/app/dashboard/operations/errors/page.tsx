import { createClient } from '@/lib/supabase/server'
import { AlertCircle, GitBranch, Package, Bot } from 'lucide-react'
import ErrorJobRetry from './ErrorJobRetry'

type FailedRun = {
  id: string
  workflow_id: string | null
  company: string | null
  status: string
  error_message: string | null
  trigger_source: string | null
  duration_ms: number | null
  started_at: string
  oc_workflows: { naam: string } | { naam: string }[] | null
}

type FailedJob = {
  id: string
  queue_name: string
  company: string
  job_type: string
  error_message: string | null
  retry_count: number
  max_retries: number
  created_at: string
}

type FailedAgentRun = {
  id: string
  agent_id: string
  status: string
  error_message: string | null
  started_at: string
  oc_ai_agents: { naam: string } | { naam: string }[] | null
}

export default async function ErrorsPage() {
  const supabase = await createClient()

  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const [
    { data: failedRuns },
    { data: failedJobs },
    { data: failedAgentRuns },
  ] = await Promise.all([
    supabase.from('oc_workflow_runs')
      .select('id, workflow_id, company, status, error_message, trigger_source, duration_ms, started_at, oc_workflows(naam)')
      .eq('status', 'failed')
      .gte('started_at', since)
      .order('started_at', { ascending: false })
      .limit(50),
    supabase.from('oc_queue_jobs')
      .select('id, queue_name, company, job_type, error_message, retry_count, max_retries, created_at')
      .eq('status', 'failed')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(50),
    supabase.from('oc_agent_runs')
      .select('id, agent_id, status, error_message, started_at, oc_ai_agents(naam)')
      .eq('status', 'failed')
      .gte('started_at', since)
      .order('started_at', { ascending: false })
      .limit(50),
  ])

  const totalErrors = (failedRuns?.length ?? 0) + (failedJobs?.length ?? 0) + (failedAgentRuns?.length ?? 0)

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
          <AlertCircle size={16} className="text-red-400" />
        </div>
        <div>
          <h1 className="text-base font-semibold text-white">Errors</h1>
          <p className="text-xs text-white/50">Mislukte runs, jobs en agent-uitvoeringen — laatste 7 dagen</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Workflow Fouten', value: failedRuns?.length ?? 0, icon: GitBranch, color: 'text-red-400', border: 'border-red-500/20' },
          { label: 'Queue Fouten', value: failedJobs?.length ?? 0, icon: Package, color: 'text-orange-400', border: 'border-orange-500/20' },
          { label: 'Agent Fouten', value: failedAgentRuns?.length ?? 0, icon: Bot, color: 'text-pink-400', border: 'border-pink-500/20' },
        ].map(s => {
          const Icon = s.icon
          return (
            <div key={s.label} className={`bg-white/[0.06] border ${s.border} rounded-xl p-4`}>
              <Icon size={13} className={`${s.color} mb-2`} />
              <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-[11px] text-white/50 mt-0.5">{s.label}</p>
            </div>
          )
        })}
      </div>

      {totalErrors === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 bg-white/[0.02] border border-white/5 rounded-xl">
          <div className="w-12 h-12 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center">
            <AlertCircle size={20} className="text-green-400" />
          </div>
          <p className="text-sm font-medium text-white">Geen fouten gevonden</p>
          <p className="text-xs text-white/45">Alle systemen draaien correct in de afgelopen 7 dagen</p>
        </div>
      ) : (
        <div className="space-y-4">
          {(failedRuns?.length ?? 0) > 0 && (
            <div className="bg-white/[0.06] border border-white/5 rounded-xl overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5">
                <GitBranch size={13} className="text-red-400" />
                <h3 className="text-xs font-semibold text-white">Workflow Runs Mislukt</h3>
                <span className="ml-auto px-1.5 py-0.5 rounded bg-red-500/10 text-[10px] text-red-400">{failedRuns?.length}</span>
              </div>
              <div className="divide-y divide-white/[0.03]">
                {(failedRuns as FailedRun[]).map(run => (
                  <div key={run.id} className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-white">{Array.isArray(run.oc_workflows) ? run.oc_workflows[0]?.naam : run.oc_workflows?.naam ?? run.workflow_id?.slice(0, 8)}</span>
                      <span className="text-[10px] text-white/38 font-mono">{run.trigger_source ?? 'manual'}</span>
                      {run.duration_ms != null && <span className="text-[10px] text-white/30">{run.duration_ms}ms</span>}
                      <span className="ml-auto text-[10px] text-white/30">
                        {new Date(run.started_at).toLocaleString('nl-NL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    {run.error_message && (
                      <p className="text-[11px] text-red-400/80 mt-1 font-mono">{run.error_message}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {(failedJobs?.length ?? 0) > 0 && (
            <div className="bg-white/[0.06] border border-white/5 rounded-xl overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5">
                <Package size={13} className="text-orange-400" />
                <h3 className="text-xs font-semibold text-white">Queue Jobs Mislukt</h3>
                <span className="ml-auto px-1.5 py-0.5 rounded bg-orange-500/10 text-[10px] text-orange-400">{failedJobs?.length}</span>
              </div>
              <div className="divide-y divide-white/[0.03]">
                {(failedJobs as FailedJob[]).map(job => (
                  <div key={job.id} className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-white font-mono">{job.job_type}</span>
                      <span className="px-1.5 py-0.5 rounded bg-white/5 text-[10px] text-white/38">{job.queue_name}</span>
                      <span className="text-[10px] text-white/38">{job.company}</span>
                      {job.retry_count > 0 && <span className="text-[10px] text-amber-400">retry {job.retry_count}/{job.max_retries}</span>}
                      <span className="ml-auto text-[10px] text-white/30">
                        {new Date(job.created_at).toLocaleString('nl-NL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <ErrorJobRetry id={job.id} />
                    </div>
                    {job.error_message && (
                      <p className="text-[11px] text-red-400/80 mt-1 font-mono">{job.error_message}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {(failedAgentRuns?.length ?? 0) > 0 && (
            <div className="bg-white/[0.06] border border-white/5 rounded-xl overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5">
                <Bot size={13} className="text-pink-400" />
                <h3 className="text-xs font-semibold text-white">Agent Runs Mislukt</h3>
                <span className="ml-auto px-1.5 py-0.5 rounded bg-pink-500/10 text-[10px] text-pink-400">{failedAgentRuns?.length}</span>
              </div>
              <div className="divide-y divide-white/[0.03]">
                {(failedAgentRuns as FailedAgentRun[]).map(run => (
                  <div key={run.id} className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-white">{Array.isArray(run.oc_ai_agents) ? run.oc_ai_agents[0]?.naam : run.oc_ai_agents?.naam ?? run.agent_id.slice(0, 8)}</span>
                      <span className="ml-auto text-[10px] text-white/30">
                        {new Date(run.started_at).toLocaleString('nl-NL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    {run.error_message && (
                      <p className="text-[11px] text-red-400/80 mt-1 font-mono">{run.error_message}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
