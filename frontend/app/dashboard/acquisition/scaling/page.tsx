import { Maximize2, Bot, Zap, AlertCircle } from 'lucide-react'
import { getAcqAgents, getAcqScanJobs } from '@/lib/supabase/acquisition'

const STATUS_COLORS: Record<string, string> = {
  idle: 'text-white/40 bg-white/5',
  running: 'text-emerald-400 bg-emerald-500/10',
  error: 'text-red-400 bg-red-500/10',
  disabled: 'text-white/20 bg-white/3',
}

export default async function ScalingPage() {
  const [agents, jobs] = await Promise.all([
    getAcqAgents(),
    getAcqScanJobs(50),
  ])

  const queuedJobs = jobs.filter(j => j.status === 'queued').length
  const runningJobs = jobs.filter(j => j.status === 'running').length
  const failedJobs = jobs.filter(j => j.status === 'failed').length
  const doneJobs = jobs.filter(j => j.status === 'done').length

  const jobsLastHour = jobs.filter(j => {
    const age = Date.now() - new Date(j.created_at).getTime()
    return age < 3600000
  })
  const scanSpeed = jobsLastHour.filter(j => j.status === 'done').length

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
          <Maximize2 size={16} className="text-white/50" />
        </div>
        <div>
          <h1 className="text-base font-semibold text-white">Scaling Engine</h1>
          <p className="text-xs text-white/50">Worker management en infrastructuur scaling voor acquisition agents</p>
        </div>
      </div>

      {/* Live metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Queue (gepland)', value: queuedJobs, color: 'text-amber-400' },
          { label: 'Actief (running)', value: runningJobs, color: 'text-emerald-400' },
          { label: 'Voltooid', value: doneJobs, color: 'text-white/60' },
          { label: 'Scan snelheid/uur', value: scanSpeed, color: 'text-sky-400' },
        ].map(m => (
          <div key={m.label} className="bg-white/[0.03] border border-white/5 rounded-xl p-4">
            <p className="text-[11px] text-white/40">{m.label}</p>
            <p className={`text-2xl font-bold mt-1 ${m.color}`}>{m.value}</p>
          </div>
        ))}
      </div>

      {/* Worker grid */}
      <div>
        <p className="text-xs text-white/50 font-medium uppercase tracking-wide mb-3">Acquisition Agents — Worker Status</p>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          {agents.map(agent => (
            <div key={agent.id} className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Bot size={13} className="text-white/40" />
                  <p className="text-xs font-medium text-white">{agent.name}</p>
                </div>
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${STATUS_COLORS[agent.status] ?? 'text-white/40 bg-white/5'}`}>
                  {agent.status}
                </span>
              </div>
              <p className="text-[10px] text-white/30 mb-2">{agent.agent_type}</p>
              <div className="flex items-center gap-3 text-[11px]">
                <span className="text-white/40">✓ {agent.tasks_done} klaar</span>
                {agent.tasks_failed > 0 && <span className="text-red-400/60">✗ {agent.tasks_failed} fouten</span>}
              </div>
              {agent.last_heartbeat && (
                <p className="text-[10px] text-white/20 mt-2">
                  Heartbeat: {new Date(agent.last_heartbeat).toLocaleString('nl-NL')}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Scan jobs log */}
      <div>
        <p className="text-xs text-white/50 font-medium uppercase tracking-wide mb-3">Recente Scan Jobs</p>
        <div className="bg-white/[0.02] border border-white/5 rounded-xl overflow-hidden">
          {jobs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2">
              <Zap size={13} className="text-white/20" />
              <p className="text-xs text-white/30">Geen scan jobs</p>
            </div>
          ) : (
            <div className="divide-y divide-white/[0.04]">
              {jobs.slice(0, 20).map(job => (
                <div key={job.id} className="flex items-center justify-between px-4 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] text-white/70 truncate">{job.agent_name} — {job.job_type}</p>
                    <p className="text-[10px] text-white/30">{new Date(job.created_at).toLocaleString('nl-NL')}</p>
                  </div>
                  <div className="flex items-center gap-3 ml-3 shrink-0">
                    {job.result_count > 0 && <span className="text-[10px] text-white/40">{job.result_count} resultaten</span>}
                    {job.error_msg && <span className="text-[9px] text-red-400/60 truncate max-w-[80px]" title={job.error_msg}><AlertCircle size={11} className="text-red-400/60 inline" /></span>}
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                      job.status === 'done' ? 'text-emerald-400 bg-emerald-500/10' :
                      job.status === 'running' ? 'text-amber-400 bg-amber-500/10' :
                      job.status === 'failed' ? 'text-red-400 bg-red-500/10' :
                      'text-white/40 bg-white/5'
                    }`}>{job.status}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
