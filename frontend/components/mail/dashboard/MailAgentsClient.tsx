'use client'

import { useState } from 'react'
import { Bot, Plus, ChevronDown, ChevronUp, Save, ToggleLeft, ToggleRight, Trash2 } from 'lucide-react'

type Agent = {
  id: string
  name: string
  agent_type: string
  model: string
  description: string | null
  system_prompt_override: string | null
  enabled: boolean
  config: Record<string, unknown>
  stats: { processed?: number; errors?: number; last_run?: string | null }
}

const MODEL_OPTIONS = [
  'claude-opus-4-7',
  'claude-sonnet-4-6',
  'claude-haiku-4-5-20251001',
]

const DEFAULT_AGENT: Omit<Agent, 'id'> = {
  name: '',
  agent_type: '',
  model: 'claude-sonnet-4-6',
  description: '',
  system_prompt_override: '',
  enabled: true,
  config: {},
  stats: {},
}

export default function MailAgentsClient({ initialAgents }: { initialAgents: Agent[] }) {
  const [agents, setAgents] = useState(initialAgents)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [editing, setEditing] = useState<Record<string, Partial<Agent>>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [newAgent, setNewAgent] = useState<Omit<Agent, 'id'>>(DEFAULT_AGENT)
  const [creating, setCreating] = useState(false)

  function edit(id: string, field: keyof Agent, value: unknown) {
    setEditing(e => ({ ...e, [id]: { ...e[id], [field]: value } }))
  }

  function getVal<K extends keyof Agent>(id: string, field: K, fallback: Agent[K]): Agent[K] {
    return (editing[id]?.[field] as Agent[K]) ?? fallback
  }

  async function saveAgent(id: string) {
    const changes = editing[id]
    if (!changes || Object.keys(changes).length === 0) return
    setSaving(id)
    try {
      const res = await fetch(`/api/mail/agents/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(changes),
      })
      if (res.ok) {
        setAgents(a => a.map(ag => ag.id === id ? { ...ag, ...changes } : ag))
        setEditing(e => { const n = { ...e }; delete n[id]; return n })
      }
    } finally {
      setSaving(null)
    }
  }

  async function toggleAgent(id: string, enabled: boolean) {
    setSaving(id)
    try {
      await fetch(`/api/mail/agents/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      })
      setAgents(a => a.map(ag => ag.id === id ? { ...ag, enabled } : ag))
    } finally {
      setSaving(null)
    }
  }

  async function createAgent() {
    if (!newAgent.name || !newAgent.agent_type) return
    setCreating(true)
    try {
      const res = await fetch('/api/mail/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newAgent),
      })
      if (res.ok) {
        const data = await res.json()
        setAgents(a => [...a, data])
        setNewAgent(DEFAULT_AGENT)
        setShowNew(false)
      }
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
          <Bot size={16} className="text-cyan-400" />
        </div>
        <div>
          <h1 className="text-base font-semibold text-white">Mail Agents</h1>
          <p className="text-xs text-white/50">Configureer AI-agents — model, prompt, instellingen per type</p>
        </div>
        <button
          onClick={() => setShowNew(s => !s)}
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600/20 border border-indigo-500/30 rounded-lg text-[11px] text-indigo-300 hover:bg-indigo-600/30 transition-colors"
        >
          <Plus size={12} /> Nieuwe Agent
        </button>
      </div>

      {/* Nieuwe agent form */}
      {showNew && (
        <div className="bg-white/[0.04] border border-indigo-500/20 rounded-xl p-4 space-y-3">
          <p className="text-[12px] font-medium text-indigo-300">Nieuwe Agent aanmaken</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-white/40 block mb-1">Naam</label>
              <input value={newAgent.name} onChange={e => setNewAgent(n => ({ ...n, name: e.target.value }))}
                className="w-full bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-2 text-[12px] text-white outline-none focus:border-indigo-500/50"
                placeholder="bijv. Contract Analyzer" />
            </div>
            <div>
              <label className="text-[10px] text-white/40 block mb-1">Agent Type (uniek)</label>
              <input value={newAgent.agent_type} onChange={e => setNewAgent(n => ({ ...n, agent_type: e.target.value.toLowerCase().replace(/\s/g, '_') }))}
                className="w-full bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-2 text-[12px] text-white outline-none focus:border-indigo-500/50"
                placeholder="bijv. contract_analyzer" />
            </div>
          </div>
          <div>
            <label className="text-[10px] text-white/40 block mb-1">Model</label>
            <select value={newAgent.model} onChange={e => setNewAgent(n => ({ ...n, model: e.target.value }))}
              className="w-full bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-2 text-[12px] text-white outline-none focus:border-indigo-500/50">
              {MODEL_OPTIONS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] text-white/40 block mb-1">Beschrijving</label>
            <input value={newAgent.description ?? ''} onChange={e => setNewAgent(n => ({ ...n, description: e.target.value }))}
              className="w-full bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-2 text-[12px] text-white outline-none focus:border-indigo-500/50"
              placeholder="Wat doet deze agent?" />
          </div>
          <div>
            <label className="text-[10px] text-white/40 block mb-1">Systeem Prompt (optioneel)</label>
            <textarea value={newAgent.system_prompt_override ?? ''} onChange={e => setNewAgent(n => ({ ...n, system_prompt_override: e.target.value }))}
              rows={4}
              className="w-full bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-2 text-[12px] text-white outline-none focus:border-indigo-500/50 resize-none"
              placeholder="Optioneel: overschrijf de standaard systeem prompt..." />
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowNew(false)} className="px-3 py-1.5 text-[11px] text-white/40 hover:text-white/60 transition-colors">
              Annuleer
            </button>
            <button onClick={createAgent} disabled={creating || !newAgent.name || !newAgent.agent_type}
              className="px-4 py-1.5 bg-indigo-600 rounded-lg text-[11px] text-white font-medium hover:bg-indigo-700 transition-colors disabled:opacity-40">
              {creating ? 'Aanmaken...' : 'Agent aanmaken'}
            </button>
          </div>
        </div>
      )}

      {/* Agents lijst */}
      <div className="space-y-2">
        {agents.map(agent => {
          const isExpanded = expanded === agent.id
          const hasChanges = Object.keys(editing[agent.id] ?? {}).length > 0
          const stats = agent.stats as { processed?: number; errors?: number; last_run?: string | null }

          return (
            <div key={agent.id} className={`bg-white/[0.04] border rounded-xl transition-colors ${agent.enabled ? 'border-white/[0.06]' : 'border-white/[0.03] opacity-60'}`}>
              <div className="flex items-center gap-3 p-4">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${agent.enabled ? 'bg-emerald-400' : 'bg-white/20'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-white">{agent.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-white/35 font-mono">{agent.agent_type}</span>
                    <span className="text-[10px] text-white/25">·</span>
                    <span className="text-[10px] text-white/35">{agent.model}</span>
                    {(stats?.processed ?? 0) > 0 && (
                      <>
                        <span className="text-[10px] text-white/25">·</span>
                        <span className="text-[10px] text-white/30">{stats.processed} verwerkt</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {hasChanges && (
                    <button onClick={() => saveAgent(agent.id)} disabled={saving === agent.id}
                      className="flex items-center gap-1 px-2.5 py-1 bg-indigo-600/20 border border-indigo-500/30 rounded-lg text-[10px] text-indigo-300 hover:bg-indigo-600/30 transition-colors disabled:opacity-40">
                      <Save size={10} />
                      {saving === agent.id ? 'Opslaan...' : 'Opslaan'}
                    </button>
                  )}
                  <button onClick={() => toggleAgent(agent.id, !agent.enabled)} disabled={saving === agent.id}
                    className="text-white/30 hover:text-white/60 transition-colors disabled:opacity-40">
                    {agent.enabled ? <ToggleRight size={20} className="text-emerald-400" /> : <ToggleLeft size={20} />}
                  </button>
                  <button onClick={() => setExpanded(isExpanded ? null : agent.id)}
                    className="text-white/30 hover:text-white/60 transition-colors">
                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
                </div>
              </div>

              {isExpanded && (
                <div className="px-4 pb-4 pt-0 border-t border-white/[0.05] mt-0 space-y-3">
                  {agent.description && (
                    <p className="text-[11px] text-white/40 pt-3">{agent.description}</p>
                  )}
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="text-[10px] text-white/35 block mb-1">Naam</label>
                      <input
                        value={getVal(agent.id, 'name', agent.name)}
                        onChange={e => edit(agent.id, 'name', e.target.value)}
                        className="w-full bg-white/[0.04] border border-white/[0.06] rounded-lg px-3 py-2 text-[12px] text-white outline-none focus:border-indigo-500/40"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-white/35 block mb-1">Model</label>
                      <select
                        value={getVal(agent.id, 'model', agent.model)}
                        onChange={e => edit(agent.id, 'model', e.target.value)}
                        className="w-full bg-white/[0.04] border border-white/[0.06] rounded-lg px-3 py-2 text-[12px] text-white outline-none focus:border-indigo-500/40"
                      >
                        {MODEL_OPTIONS.map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] text-white/35 block mb-1">Systeem Prompt Override</label>
                    <textarea
                      value={getVal(agent.id, 'system_prompt_override', agent.system_prompt_override) ?? ''}
                      onChange={e => edit(agent.id, 'system_prompt_override', e.target.value || null)}
                      rows={6}
                      placeholder="Leeg = gebruik standaard systeem prompt..."
                      className="w-full bg-white/[0.04] border border-white/[0.06] rounded-lg px-3 py-2 text-[11px] text-white/80 outline-none focus:border-indigo-500/40 resize-none leading-relaxed"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-white/35 block mb-1">Config (JSON)</label>
                    <textarea
                      value={JSON.stringify(getVal(agent.id, 'config', agent.config), null, 2)}
                      onChange={e => {
                        try { edit(agent.id, 'config', JSON.parse(e.target.value)) } catch { /* ignore */ }
                      }}
                      rows={4}
                      className="w-full bg-white/[0.04] border border-white/[0.06] rounded-lg px-3 py-2 text-[10px] text-white/60 font-mono outline-none focus:border-indigo-500/40 resize-none"
                    />
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
