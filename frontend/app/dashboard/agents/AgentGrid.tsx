'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Play, Square, Zap, Clock, Inbox, X } from 'lucide-react'
import { dispatchAgentTask, updateAgentStatus } from './actions'
import clsx from 'clsx'

type Agent = {
  id: string
  naam: string
  slug: string
  company: string
  company_color: string
  role: string
  status: string
  current_task: string | null
  queue_size: number
  last_run_at: string | null
  run_count: number
}

const STATUS_DOT: Record<string, string> = {
  online: 'bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.6)]',
  processing: 'bg-indigo-400 shadow-[0_0_6px_rgba(129,140,248,0.6)] animate-pulse',
  idle: 'bg-amber-400',
  offline: 'bg-white/20',
}

const STATUS_LABEL: Record<string, string> = {
  online: 'online',
  processing: 'actief',
  idle: 'idle',
  offline: 'offline',
}

const TASK_TYPES = [
  { value: 'sync', label: 'Sync uitvoeren' },
  { value: 'fetch_data', label: 'Data ophalen' },
  { value: 'generate_report', label: 'Rapport genereren' },
  { value: 'send_notification', label: 'Notificatie sturen' },
  { value: 'analyze_document', label: 'Document analyseren' },
  { value: 'process_queue', label: 'Queue verwerken' },
  { value: 'health_check', label: 'Health check' },
]

function DispatchModal({ agent, onClose }: { agent: Agent; onClose: () => void }) {
  const [taskType, setTaskType] = useState('sync')
  const [loading, setLoading] = useState(false)

  async function handleDispatch() {
    setLoading(true)
    await dispatchAgentTask(agent.id, taskType)
    setLoading(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#0d0d1a] border border-white/10 rounded-2xl w-full max-w-sm p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Taak dispatcheren</h2>
          <button onClick={onClose} className="text-white/50 hover:text-white transition-colors">
            <X size={16} />
          </button>
        </div>
        <div className="bg-white/[0.06] border border-white/5 rounded-lg px-3 py-2">
          <p className="text-[11px] text-white/65">Agent</p>
          <p className="text-xs text-white font-medium">{agent.naam}</p>
        </div>
        <div className="space-y-1.5">
          <label className="text-[11px] text-white/65">Taaktype</label>
          <select
            value={taskType}
            onChange={e => setTaskType(e.target.value)}
            className="w-full bg-white/[0.09] border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-indigo-500/50"
          >
            {TASK_TYPES.map(t => (
              <option key={t.value} value={t.value} className="bg-[#0d0d1a]">{t.label}</option>
            ))}
          </select>
        </div>
        <div className="flex gap-2 pt-1">
          <button
            onClick={handleDispatch}
            disabled={loading}
            className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-medium py-2 rounded-lg transition-colors"
          >
            {loading ? 'Dispatching…' : 'Dispatch'}
          </button>
          <button
            onClick={onClose}
            className="px-4 border border-white/10 text-white/50 hover:text-white text-xs font-medium py-2 rounded-lg transition-colors"
          >
            Annuleer
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AgentGrid({ initialAgents }: { initialAgents: Agent[] }) {
  const [agents, setAgents] = useState<Agent[]>(initialAgents)
  const [dispatchTarget, setDispatchTarget] = useState<Agent | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel('oc_agents_live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'oc_agents' }, payload => {
        if (payload.eventType === 'UPDATE') {
          setAgents(prev => prev.map(a => a.id === (payload.new as Agent).id ? { ...a, ...(payload.new as Agent) } : a))
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  async function handleToggle(agent: Agent) {
    setTogglingId(agent.id)
    const newStatus = agent.status === 'offline' ? 'idle' : agent.status === 'idle' ? 'online' : 'idle'
    await updateAgentStatus(agent.id, newStatus)
    setAgents(prev => prev.map(a => a.id === agent.id ? { ...a, status: newStatus } : a))
    setTogglingId(null)
  }

  return (
    <>
      {dispatchTarget && (
        <DispatchModal agent={dispatchTarget} onClose={() => setDispatchTarget(null)} />
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {agents.map(agent => (
          <div key={agent.id} className="bg-white/[0.06] border border-white/5 rounded-xl p-4 flex flex-col gap-3 hover:border-white/10 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={clsx('w-2 h-2 rounded-full flex-shrink-0', STATUS_DOT[agent.status] ?? 'bg-white/20')} />
                <span className="text-sm font-medium text-white">{agent.naam}</span>
              </div>
              <span
                className="px-2 py-0.5 rounded-full text-[10px] font-medium"
                style={{ backgroundColor: (agent.company_color || '#6366f1') + '20', color: agent.company_color || '#6366f1' }}
              >
                {agent.company}
              </span>
            </div>

            <div className="flex items-center gap-3 text-[11px] text-white/50">
              <div className="flex items-center gap-1">
                <span className="text-[9px] font-mono bg-white/5 px-1.5 py-0.5 rounded text-white/38">{agent.role}</span>
              </div>
              {agent.last_run_at && (
                <div className="flex items-center gap-1">
                  <Clock size={10} />
                  <span>{new Date(agent.last_run_at).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              )}
              {(agent.queue_size ?? 0) > 0 && (
                <div className="flex items-center gap-1">
                  <Inbox size={10} />
                  <span>{agent.queue_size}</span>
                </div>
              )}
            </div>

            {agent.current_task && (
              <p className="text-[10px] text-indigo-400/70 font-mono truncate">↳ {agent.current_task}</p>
            )}

            <div className="flex items-center gap-2 mt-auto pt-1">
              <button
                onClick={() => setDispatchTarget(agent)}
                disabled={agent.status === 'offline'}
                className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 disabled:cursor-not-allowed text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
              >
                <Zap size={10} />
                Dispatch
              </button>
              <button
                onClick={() => handleToggle(agent)}
                disabled={togglingId === agent.id}
                className="flex items-center gap-1.5 border border-white/10 hover:border-white/20 text-white/50 hover:text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
              >
                {agent.status === 'offline' ? <Play size={10} /> : <Square size={10} />}
                {STATUS_LABEL[agent.status] === 'offline' ? 'Start' : STATUS_LABEL[agent.status]}
              </button>
              <span className="ml-auto text-[10px] text-white/50 font-mono">{agent.run_count ?? 0} runs</span>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
