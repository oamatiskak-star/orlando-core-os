'use client'

import { useState } from 'react'
import { Bot, Play, Pause, Trash2, Plus, X, Zap } from 'lucide-react'
import { createAgent, runAgent, toggleAgentStatus, deleteAgent } from './actions'

type Agent = {
  id: string
  naam: string
  type: string
  company: string
  status: string
  model: string
  system_prompt: string | null
  capabilities: string[]
  queue_name: string | null
  last_active_at: string | null
  run_count: number
  success_count: number
  failure_count: number
}

const STATUS_COLORS: Record<string, string> = {
  idle: 'bg-white/5 text-white/50',
  running: 'bg-indigo-500/10 text-indigo-400',
  error: 'bg-red-500/10 text-red-400',
  disabled: 'bg-white/5 text-white/25',
}

const TYPE_ICONS: Record<string, string> = {
  architect: '🏗️',
  builder: '🔨',
  executor: '⚡',
  monteur: '🔧',
  analyst: '📊',
  writer: '✍️',
  researcher: '🔍',
  reviewer: '👁️',
  notifier: '📣',
}

const COMPANIES = ['MODIWÉ', 'MEDIA', 'STRKBEHEER', 'STRKBOUW', 'PROFFS']
const AGENT_TYPES = Object.keys(TYPE_ICONS)
const MODELS = ['gpt-4o', 'gpt-4o-mini', 'claude-sonnet-4-5', 'claude-haiku-3-5', 'gemini-1.5-pro']
const CAPABILITY_OPTIONS = ['web_search', 'code_execution', 'file_read', 'file_write', 'api_calls', 'email', 'database', 'pdf_analysis', 'image_analysis']

function AgentCard({ agent }: { agent: Agent }) {
  const [running, setRunning] = useState(false)
  const [toggling, setToggling] = useState(false)
  const [showRun, setShowRun] = useState(false)
  const [input, setInput] = useState('')

  async function handleRun() {
    setRunning(true)
    await runAgent(agent.id, input)
    setRunning(false)
    setShowRun(false)
    setInput('')
  }

  async function handleToggle() {
    setToggling(true)
    await toggleAgentStatus(agent.id, agent.status)
    setToggling(false)
  }

  const lastActive = agent.last_active_at
    ? new Date(agent.last_active_at).toLocaleString('nl-NL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    : '—'

  const successRate = agent.run_count > 0 ? Math.round((agent.success_count / agent.run_count) * 100) : 0

  return (
    <div className="bg-white/[0.06] border border-white/5 rounded-xl p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-lg">
            {TYPE_ICONS[agent.type] ?? '🤖'}
          </div>
          <div>
            <p className="text-sm font-semibold text-white">{agent.naam}</p>
            <p className="text-[10px] text-white/45">{agent.type} · {agent.company}</p>
          </div>
        </div>
        <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${STATUS_COLORS[agent.status] ?? 'bg-white/5 text-white/50'}`}>
          {agent.status}
        </span>
      </div>

      <div className="text-[10px] text-white/38 font-mono bg-white/5 rounded px-2 py-1">{agent.model}</div>

      {agent.capabilities.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {agent.capabilities.map(cap => (
            <span key={cap} className="px-1.5 py-0.5 bg-indigo-500/10 border border-indigo-500/20 rounded text-[10px] text-indigo-400">{cap}</span>
          ))}
        </div>
      )}

      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-sm font-bold text-white">{agent.run_count}</p>
          <p className="text-[9px] text-white/38">Runs</p>
        </div>
        <div>
          <p className="text-sm font-bold text-green-400">{successRate}%</p>
          <p className="text-[9px] text-white/38">Succes</p>
        </div>
        <div>
          <p className="text-[10px] text-white/50">{lastActive}</p>
          <p className="text-[9px] text-white/38">Laatste actief</p>
        </div>
      </div>

      {agent.queue_name && (
        <div className="text-[10px] text-white/38">
          Queue: <span className="text-white/55 font-mono">{agent.queue_name}</span>
        </div>
      )}

      {showRun && (
        <div className="space-y-2 border-t border-white/5 pt-3">
          <input value={input} onChange={e => setInput(e.target.value)} placeholder="Input voor agent..."
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-white/20 outline-none focus:border-indigo-500/60 transition-colors" />
          <div className="flex gap-2">
            <button onClick={handleRun} disabled={running}
              className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs py-1.5 rounded-lg transition-colors">
              {running ? 'Running...' : 'Uitvoeren'}
            </button>
            <button onClick={() => setShowRun(false)} className="px-3 border border-white/10 text-white/50 text-xs rounded-lg hover:text-white transition-colors">
              Annuleren
            </button>
          </div>
        </div>
      )}

      <div className="flex gap-2 pt-1 border-t border-white/5">
        {agent.status !== 'disabled' && !showRun && (
          <button onClick={() => setShowRun(true)}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-white/10 text-white/60 hover:text-green-400 hover:border-green-500/30 text-xs transition-colors">
            <Play size={10} /> Run
          </button>
        )}
        <button onClick={handleToggle} disabled={toggling}
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-white/10 text-white/60 hover:text-amber-400 hover:border-amber-500/30 text-xs transition-colors disabled:opacity-30">
          <Pause size={10} /> {agent.status === 'idle' ? 'Disable' : 'Enable'}
        </button>
        <button onClick={() => { if (confirm(`"${agent.naam}" verwijderen?`)) deleteAgent(agent.id) }}
          className="w-8 flex items-center justify-center py-1.5 rounded-lg border border-white/10 text-white/60 hover:text-red-400 hover:border-red-500/30 text-xs transition-colors">
          <Trash2 size={10} />
        </button>
      </div>
    </div>
  )
}

function NieuweAgentModal({ onClose }: { onClose: () => void }) {
  const [pending, setPending] = useState(false)
  const [selectedCaps, setSelectedCaps] = useState<string[]>([])

  function toggleCap(cap: string) {
    setSelectedCaps(prev => prev.includes(cap) ? prev.filter(c => c !== cap) : [...prev, cap])
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setPending(true)
    const fd = new FormData(e.currentTarget)
    fd.set('capabilities', JSON.stringify(selectedCaps))
    await createAgent(fd)
    setPending(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[#181830] border border-white/10 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 sticky top-0 bg-[#181830] z-10">
          <h2 className="text-sm font-semibold text-white">Nieuwe AI Agent</h2>
          <button onClick={onClose} className="text-white/50 hover:text-white transition-colors"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs text-white/50 mb-1">Naam *</label>
            <input name="naam" required placeholder="bijv. Deal Analyst Agent"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-indigo-500/60 transition-colors" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-white/50 mb-1">Type</label>
              <select name="type" className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-indigo-500/60 transition-colors">
                {AGENT_TYPES.map(t => <option key={t} value={t}>{TYPE_ICONS[t]} {t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-white/50 mb-1">Bedrijf</label>
              <select name="company" className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-indigo-500/60 transition-colors">
                {COMPANIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-white/50 mb-1">Model</label>
              <select name="model" className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-indigo-500/60 transition-colors">
                {MODELS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-white/50 mb-1">Queue naam</label>
              <input name="queue_name" placeholder="bijv. agent-queue"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-indigo-500/60 transition-colors" />
            </div>
          </div>
          <div>
            <label className="block text-xs text-white/50 mb-1">System Prompt</label>
            <textarea name="system_prompt" rows={3} placeholder="Jij bent een AI agent die..."
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-indigo-500/60 transition-colors resize-none" />
          </div>
          <div>
            <label className="block text-xs text-white/50 mb-2">Capabilities</label>
            <div className="flex flex-wrap gap-2">
              {CAPABILITY_OPTIONS.map(cap => (
                <button key={cap} type="button" onClick={() => toggleCap(cap)}
                  className={`px-2.5 py-1 rounded-md text-[11px] border transition-colors ${selectedCaps.includes(cap) ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-400' : 'bg-white/5 border-white/10 text-white/45 hover:text-white/70'}`}>
                  {cap}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={pending}
              className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium py-2.5 rounded-lg transition-colors">
              {pending ? 'Aanmaken...' : 'Agent aanmaken'}
            </button>
            <button type="button" onClick={onClose}
              className="px-4 border border-white/10 text-white/50 hover:text-white text-sm rounded-lg transition-colors">
              Annuleren
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function AgentGrid({ agents }: { agents: Agent[] }) {
  const [showNew, setShowNew] = useState(false)

  const running = agents.filter(a => a.status === 'running').length
  const idle = agents.filter(a => a.status === 'idle').length

  return (
    <>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 text-xs text-white/50">
          <span className="flex items-center gap-1"><Zap size={11} className="text-indigo-400" />{running} running</span>
          <span className="flex items-center gap-1"><Bot size={11} className="text-white/38" />{idle} idle</span>
        </div>
        <button onClick={() => setShowNew(true)}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium px-4 py-2 rounded-lg transition-colors">
          <Plus size={13} />
          Nieuwe agent
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {agents.map(agent => <AgentCard key={agent.id} agent={agent} />)}
        {agents.length === 0 && (
          <div className="col-span-3 flex flex-col items-center justify-center py-16 gap-3 bg-white/[0.02] border border-white/5 rounded-xl">
            <Bot size={24} className="text-white/20" />
            <p className="text-sm text-white/50">Geen agents geconfigureerd</p>
            <button onClick={() => setShowNew(true)} className="text-xs text-indigo-400 hover:text-indigo-300">
              Maak je eerste agent aan
            </button>
          </div>
        )}
      </div>

      {showNew && <NieuweAgentModal onClose={() => setShowNew(false)} />}
    </>
  )
}
