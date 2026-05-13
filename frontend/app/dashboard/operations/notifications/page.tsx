import { createClient } from '@/lib/supabase/server'
import { Bell, AlertCircle, CheckCircle2, Info } from 'lucide-react'

type Suggestion = {
  id: string
  company: string
  type: string
  title: string
  description: string
  impact: string
  status: string
  created_at: string
}

type FailedRun = {
  id: string
  workflow_id: string | null
  error_message: string | null
  started_at: string
  oc_workflows: { naam: string } | { naam: string }[] | null
}

export default async function NotificationsPage() {
  const supabase = await createClient()

  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const [
    { data: suggestions },
    { data: failedRuns },
    { count: pendingJobs },
  ] = await Promise.all([
    supabase.from('oc_ai_suggestions')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(20),
    supabase.from('oc_workflow_runs')
      .select('id, workflow_id, error_message, started_at, oc_workflows(naam)')
      .eq('status', 'failed')
      .gte('started_at', since24h)
      .order('started_at', { ascending: false })
      .limit(10),
    supabase.from('oc_queue_jobs')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'failed'),
  ])

  const total = (suggestions?.length ?? 0) + (failedRuns?.length ?? 0) + (pendingJobs ?? 0)

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
          <Bell size={16} className="text-violet-400" />
        </div>
        <div>
          <h1 className="text-base font-semibold text-white">Notificaties</h1>
          <p className="text-xs text-white/50">Systeemmeldingen, fouten, aanbevelingen en queue-alerts</p>
        </div>
      </div>

      {total === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 bg-white/[0.02] border border-white/5 rounded-xl">
          <div className="w-12 h-12 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center">
            <CheckCircle2 size={20} className="text-green-400" />
          </div>
          <p className="text-sm font-medium text-white">Geen meldingen</p>
          <p className="text-xs text-white/45">Alles is in orde</p>
        </div>
      ) : (
        <div className="space-y-3">
          {(failedRuns?.length ?? 0) > 0 && (
            <div className="bg-white/[0.06] border border-red-500/20 rounded-xl overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5 bg-red-500/5">
                <AlertCircle size={13} className="text-red-400" />
                <h3 className="text-xs font-semibold text-white">Workflow Fouten (24u)</h3>
                <span className="ml-auto px-1.5 py-0.5 rounded bg-red-500/20 text-[10px] text-red-400">{failedRuns?.length}</span>
              </div>
              <div className="divide-y divide-white/[0.03]">
                {(failedRuns as FailedRun[]).map(run => (
                  <div key={run.id} className="px-4 py-3 flex items-center gap-3">
                    <AlertCircle size={12} className="text-red-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-white">{(Array.isArray(run.oc_workflows) ? run.oc_workflows[0]?.naam : run.oc_workflows?.naam) ?? 'Onbekende workflow'} mislukt</p>
                      {run.error_message && <p className="text-[10px] text-red-400/70 mt-0.5 truncate font-mono">{run.error_message}</p>}
                    </div>
                    <span className="text-[10px] text-white/30 flex-shrink-0">
                      {new Date(run.started_at).toLocaleString('nl-NL', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(pendingJobs ?? 0) > 0 && (
            <div className="flex items-center gap-3 px-4 py-3 bg-white/[0.06] border border-orange-500/20 rounded-xl">
              <AlertCircle size={13} className="text-orange-400 flex-shrink-0" />
              <div>
                <p className="text-xs text-white">{pendingJobs} queue jobs mislukt</p>
                <p className="text-[10px] text-white/45">Controleer de Queue Monitor voor details</p>
              </div>
            </div>
          )}

          {(suggestions?.length ?? 0) > 0 && (
            <div className="bg-white/[0.06] border border-indigo-500/20 rounded-xl overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5 bg-indigo-500/5">
                <Info size={13} className="text-indigo-400" />
                <h3 className="text-xs font-semibold text-white">AI Aanbevelingen</h3>
                <span className="ml-auto px-1.5 py-0.5 rounded bg-indigo-500/20 text-[10px] text-indigo-400">{suggestions?.length}</span>
              </div>
              <div className="divide-y divide-white/[0.03]">
                {(suggestions as Suggestion[]).map(s => (
                  <div key={s.id} className="px-4 py-3 flex items-start gap-3">
                    <Info size={12} className="text-indigo-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-xs text-white">{s.title}</p>
                      <p className="text-[10px] text-white/50 mt-0.5">{s.description}</p>
                    </div>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] flex-shrink-0 ${s.impact === 'high' ? 'bg-red-500/10 text-red-400' : s.impact === 'medium' ? 'bg-amber-500/10 text-amber-400' : 'bg-white/5 text-white/38'}`}>
                      {s.impact}
                    </span>
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
