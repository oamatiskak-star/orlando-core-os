import { Bot, Zap, Clock, CheckCircle2, XCircle, AlertCircle } from 'lucide-react'
import { getAcqAgents, getAcqScanJobs } from '@/lib/supabase/acquisition'

const AGENT_DESCRIPTIONS: Record<string, { desc: string; color: string; tasks: string[] }> = {
  DealHunter: {
    desc: 'Scant Funda, Kadaster en andere bronnen op nieuwe dealflow',
    color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
    tasks: ['Scan publieke woningdata', 'Detecteer prijsdalingen', 'Analyseer nieuw aanbod'],
  },
  OffMarketAI: {
    desc: 'Detecteert leegstand, faillissementen en onderbenutte objecten',
    color: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
    tasks: ['Leegstandsdetectie', 'Faillissementenmonitor', 'Energielabel-scan'],
  },
  PermitAI: {
    desc: 'Monitort omgevingsloket.nl en gemeentelijke vergunningportalen',
    color: 'text-violet-400 bg-violet-500/10 border-violet-500/20',
    tasks: ['Omgevingsvergunning scan', 'Bestemmingsplan wijzigingen', 'Bezwaarperiode alerts'],
  },
  MunicipalityAI: {
    desc: 'Analyseert gemeentelijk beleid, woningbouwprogramma\'s en groeigebieden',
    color: 'text-sky-400 bg-sky-500/10 border-sky-500/20',
    tasks: ['Beleidsdocument analyse', 'Woningbouwprogramma', 'Politieke samenstelling'],
  },
  InvestorAI: {
    desc: 'Koppelt deals automatisch aan investeerders op basis van profiel matching',
    color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    tasks: ['Profiel matching', 'ROI berekening', 'Investor alerts'],
  },
  OutreachAI: {
    desc: 'Genereert contactstrategieën en beheert outreach sequences',
    color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
    tasks: ['Contact suggesties', 'Sequence beheer', 'Follow-up planning'],
  },
  RiskAI: {
    desc: 'Beoordeelt risico\'s per deal en genereert risicoprofielen',
    color: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    tasks: ['Risicobeoordeling', 'Juridische check', 'Marktrisico analyse'],
  },
  AcquisitionDirectorAI: {
    desc: 'Overkoepelende AI director die alle agents coördineert en prioriteert',
    color: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
    tasks: ['Agent coördinatie', 'Prioriteitsstelling', 'Strategische sturing'],
  },
}

const STATUS_ICON: Record<string, React.ComponentType<{size?: number; className?: string}>> = {
  idle: Clock,
  running: Zap,
  error: AlertCircle,
  disabled: XCircle,
}

export default async function AgentsPage() {
  const [agents, allJobs] = await Promise.all([
    getAcqAgents(),
    getAcqScanJobs(100),
  ])

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
          <Bot size={16} className="text-white/50" />
        </div>
        <div>
          <h1 className="text-base font-semibold text-white">Acquisition Agents</h1>
          <p className="text-xs text-white/50">AI agents voor automatische acquisitie intelligence — {agents.length} agents</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {agents.map(agent => {
          const meta = AGENT_DESCRIPTIONS[agent.name] ?? { desc: 'Acquisition agent', color: 'text-white/40 bg-white/5 border-white/10', tasks: [] }
          const agentJobs = allJobs.filter(j => j.agent_name === agent.name)
          const StatusIcon = STATUS_ICON[agent.status] ?? Clock

          return (
            <div key={agent.id} className={`bg-white/[0.02] border rounded-xl p-4 ${meta.color.split(' ')[2] ?? 'border-white/5'}`}>
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-start gap-2.5">
                  <div className={`w-8 h-8 rounded-xl border flex items-center justify-center shrink-0 ${
                    meta.color.split(' ').slice(1).join(' ')
                  }`}>
                    <Bot size={13} className={meta.color.split(' ')[0]} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">{agent.name}</p>
                    <p className="text-[11px] text-white/40">{meta.desc}</p>
                  </div>
                </div>
                <div className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium ${
                  agent.status === 'running' ? 'text-emerald-400 bg-emerald-500/10' :
                  agent.status === 'error' ? 'text-red-400 bg-red-500/10' :
                  agent.status === 'idle' ? 'text-white/40 bg-white/5' :
                  'text-white/20 bg-white/3'
                }`}>
                  <StatusIcon size={9} />
                  {agent.status}
                </div>
              </div>

              {/* Tasks */}
              <div className="flex flex-wrap gap-1 mb-3">
                {meta.tasks.map(task => (
                  <span key={task} className="px-1.5 py-0.5 bg-white/[0.04] text-white/30 rounded text-[10px]">{task}</span>
                ))}
              </div>

              {/* Stats */}
              <div className="flex items-center gap-4 text-[11px] mb-3">
                <span className="text-white/40">✓ {agent.tasks_done} klaar</span>
                {agent.tasks_failed > 0 && <span className="text-red-400/60">✗ {agent.tasks_failed} fouten</span>}
                {agent.last_heartbeat && (
                  <span className="text-white/20">Heartbeat {new Date(agent.last_heartbeat).toLocaleTimeString('nl-NL')}</span>
                )}
              </div>

              {/* Recent jobs */}
              {agentJobs.length > 0 && (
                <div className="border-t border-white/[0.04] pt-2.5 space-y-1">
                  <p className="text-[10px] text-white/30 mb-1.5">Recente jobs</p>
                  {agentJobs.slice(0, 3).map(job => (
                    <div key={job.id} className="flex items-center justify-between text-[10px]">
                      <span className="text-white/40 truncate">{job.job_type}</span>
                      <div className="flex items-center gap-2">
                        {job.result_count > 0 && <span className="text-white/30">{job.result_count}×</span>}
                        <span className={`${
                          job.status === 'done' ? 'text-emerald-400/60' :
                          job.status === 'running' ? 'text-amber-400/60' :
                          job.status === 'failed' ? 'text-red-400/60' :
                          'text-white/20'
                        }`}>{job.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {agentJobs.length === 0 && (
                <div className="border-t border-white/[0.04] pt-2.5">
                  <p className="text-[10px] text-white/20">Nog niet geactiveerd — configureer via Acquisition Settings</p>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
