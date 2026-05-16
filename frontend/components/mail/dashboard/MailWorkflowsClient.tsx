'use client'

import { useState } from 'react'
import { GitMerge, Plus, ChevronDown, ChevronUp, Save, ToggleLeft, ToggleRight, Play, Clock } from 'lucide-react'

type WorkflowStep = { step: number; action: string; agent?: string; condition?: string; channel?: string }

type Workflow = {
  id: string
  name: string
  description: string | null
  trigger_type: string
  steps: WorkflowStep[]
  enabled: boolean
  priority: number
  run_count: number
  last_run_at: string | null
}

const TRIGGER_OPTIONS = ['routing_rule', 'default', 'has_attachment', 'cron', 'webhook', 'manual']

const DEFAULT_WORKFLOW: Omit<Workflow, 'id'> = {
  name: '', description: '', trigger_type: 'routing_rule',
  steps: [{ step: 1, action: '' }], enabled: true, priority: 50,
  run_count: 0, last_run_at: null,
}

function fmtDate(str: string | null) {
  if (!str) return 'Nooit'
  return new Date(str).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export default function MailWorkflowsClient({ initialWorkflows }: { initialWorkflows: Workflow[] }) {
  const [workflows, setWorkflows] = useState(initialWorkflows)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [editing, setEditing] = useState<Record<string, Partial<Workflow>>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [newWf, setNewWf] = useState<Omit<Workflow, 'id'>>(DEFAULT_WORKFLOW)
  const [creating, setCreating] = useState(false)

  function edit(id: string, field: keyof Workflow, value: unknown) {
    setEditing(e => ({ ...e, [id]: { ...e[id], [field]: value } }))
  }

  function getVal<K extends keyof Workflow>(id: string, field: K, fallback: Workflow[K]): Workflow[K] {
    return (editing[id]?.[field] as Workflow[K]) ?? fallback
  }

  async function saveWorkflow(id: string) {
    const changes = editing[id]
    if (!changes || Object.keys(changes).length === 0) return
    setSaving(id)
    try {
      const res = await fetch(`/api/mail/workflows/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(changes),
      })
      if (res.ok) {
        setWorkflows(w => w.map(wf => wf.id === id ? { ...wf, ...changes } : wf))
        setEditing(e => { const n = { ...e }; delete n[id]; return n })
      }
    } finally { setSaving(null) }
  }

  async function toggleWorkflow(id: string, enabled: boolean) {
    setSaving(id)
    try {
      await fetch(`/api/mail/workflows/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      })
      setWorkflows(w => w.map(wf => wf.id === id ? { ...wf, enabled } : wf))
    } finally { setSaving(null) }
  }

  async function createWorkflow() {
    if (!newWf.name) return
    setCreating(true)
    try {
      const res = await fetch('/api/mail/workflows', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newWf),
      })
      if (res.ok) {
        const data = await res.json()
        setWorkflows(w => [...w, data])
        setNewWf(DEFAULT_WORKFLOW)
        setShowNew(false)
      }
    } finally { setCreating(false) }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
          <GitMerge size={16} className="text-emerald-400" />
        </div>
        <div>
          <h1 className="text-base font-semibold text-white">Mail Workflows</h1>
          <p className="text-xs text-white/50">Pipelines — meerdere acties per mailtype, in volgorde uitgevoerd</p>
        </div>
        <button onClick={() => setShowNew(s => !s)}
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600/20 border border-indigo-500/30 rounded-lg text-[11px] text-indigo-300 hover:bg-indigo-600/30 transition-colors">
          <Plus size={12} /> Nieuwe Workflow
        </button>
      </div>

      {/* Nieuwe workflow form */}
      {showNew && (
        <div className="bg-white/[0.04] border border-indigo-500/20 rounded-xl p-4 space-y-3">
          <p className="text-[12px] font-medium text-indigo-300">Nieuwe Workflow aanmaken</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-white/40 block mb-1">Naam</label>
              <input value={newWf.name} onChange={e => setNewWf(n => ({ ...n, name: e.target.value }))}
                className="w-full bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-2 text-[12px] text-white outline-none focus:border-indigo-500/50"
                placeholder="bijv. Spoed Incasso Pipeline" />
            </div>
            <div>
              <label className="text-[10px] text-white/40 block mb-1">Trigger Type</label>
              <select value={newWf.trigger_type} onChange={e => setNewWf(n => ({ ...n, trigger_type: e.target.value }))}
                className="w-full bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-2 text-[12px] text-white outline-none focus:border-indigo-500/50">
                {TRIGGER_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-[10px] text-white/40 block mb-1">Beschrijving</label>
            <input value={newWf.description ?? ''} onChange={e => setNewWf(n => ({ ...n, description: e.target.value }))}
              className="w-full bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-2 text-[12px] text-white outline-none focus:border-indigo-500/50"
              placeholder="Wat doet deze workflow?" />
          </div>
          <div>
            <label className="text-[10px] text-white/40 block mb-1">Stappen (JSON)</label>
            <textarea
              value={JSON.stringify(newWf.steps, null, 2)}
              onChange={e => { try { setNewWf(n => ({ ...n, steps: JSON.parse(e.target.value) })) } catch { /* ignore */ } }}
              rows={6}
              className="w-full bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-2 text-[11px] text-white/70 font-mono outline-none focus:border-indigo-500/50 resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-white/40 block mb-1">Prioriteit (hoog = eerder)</label>
              <input type="number" value={newWf.priority} onChange={e => setNewWf(n => ({ ...n, priority: Number(e.target.value) }))}
                className="w-full bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-2 text-[12px] text-white outline-none focus:border-indigo-500/50" />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowNew(false)} className="px-3 py-1.5 text-[11px] text-white/40 hover:text-white/60 transition-colors">Annuleer</button>
            <button onClick={createWorkflow} disabled={creating || !newWf.name}
              className="px-4 py-1.5 bg-indigo-600 rounded-lg text-[11px] text-white font-medium hover:bg-indigo-700 transition-colors disabled:opacity-40">
              {creating ? 'Aanmaken...' : 'Workflow aanmaken'}
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {workflows.map(wf => {
          const isExpanded = expanded === wf.id
          const hasChanges = Object.keys(editing[wf.id] ?? {}).length > 0

          return (
            <div key={wf.id} className={`bg-white/[0.04] border rounded-xl transition-all ${wf.enabled ? 'border-white/[0.06]' : 'border-white/[0.03] opacity-60'}`}>
              <div className="flex items-center gap-3 p-4">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${wf.enabled ? 'bg-emerald-400' : 'bg-white/20'}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-[13px] font-medium text-white">{wf.name}</p>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/[0.06] text-white/40 font-mono">{wf.trigger_type}</span>
                    <span className="text-[9px] text-white/25">p{wf.priority}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-white/30">{(wf.steps as WorkflowStep[]).length} stappen</span>
                    <span className="text-[10px] text-white/20">·</span>
                    <Clock size={9} className="text-white/25" />
                    <span className="text-[10px] text-white/25">{fmtDate(wf.last_run_at)}</span>
                    {wf.run_count > 0 && <span className="text-[10px] text-white/25">· {wf.run_count}×</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {hasChanges && (
                    <button onClick={() => saveWorkflow(wf.id)} disabled={saving === wf.id}
                      className="flex items-center gap-1 px-2.5 py-1 bg-indigo-600/20 border border-indigo-500/30 rounded-lg text-[10px] text-indigo-300 hover:bg-indigo-600/30 transition-colors disabled:opacity-40">
                      <Save size={10} />
                      {saving === wf.id ? 'Opslaan...' : 'Opslaan'}
                    </button>
                  )}
                  <button onClick={() => toggleWorkflow(wf.id, !wf.enabled)} disabled={saving === wf.id}
                    className="text-white/30 hover:text-white/60 transition-colors disabled:opacity-40">
                    {wf.enabled ? <ToggleRight size={20} className="text-emerald-400" /> : <ToggleLeft size={20} />}
                  </button>
                  <button onClick={() => setExpanded(isExpanded ? null : wf.id)}
                    className="text-white/30 hover:text-white/60 transition-colors">
                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
                </div>
              </div>

              {isExpanded && (
                <div className="px-4 pb-4 border-t border-white/[0.05] space-y-3">
                  {wf.description && <p className="text-[11px] text-white/40 pt-3">{wf.description}</p>}

                  {/* Stappen visualisatie */}
                  <div className="pt-2">
                    <p className="text-[10px] text-white/35 mb-2">Pipeline stappen</p>
                    <div className="flex flex-wrap gap-2">
                      {(getVal(wf.id, 'steps', wf.steps) as WorkflowStep[]).map((step, i) => (
                        <div key={i} className="flex items-center gap-1">
                          <div className="px-2.5 py-1.5 bg-indigo-500/10 border border-indigo-500/20 rounded-lg">
                            <p className="text-[9px] text-indigo-400/60 font-mono">{step.step}</p>
                            <p className="text-[11px] text-indigo-300 font-mono">{step.action}</p>
                            {step.agent && <p className="text-[9px] text-white/30 font-mono">{step.agent}</p>}
                          </div>
                          {i < (getVal(wf.id, 'steps', wf.steps) as WorkflowStep[]).length - 1 && (
                            <span className="text-white/20 text-sm">→</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] text-white/35 block mb-1">Naam</label>
                      <input value={getVal(wf.id, 'name', wf.name)}
                        onChange={e => edit(wf.id, 'name', e.target.value)}
                        className="w-full bg-white/[0.04] border border-white/[0.06] rounded-lg px-3 py-2 text-[12px] text-white outline-none focus:border-indigo-500/40" />
                    </div>
                    <div>
                      <label className="text-[10px] text-white/35 block mb-1">Trigger Type</label>
                      <select value={getVal(wf.id, 'trigger_type', wf.trigger_type)}
                        onChange={e => edit(wf.id, 'trigger_type', e.target.value)}
                        className="w-full bg-white/[0.04] border border-white/[0.06] rounded-lg px-3 py-2 text-[12px] text-white outline-none focus:border-indigo-500/40">
                        {TRIGGER_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] text-white/35 block mb-1">Stappen (JSON)</label>
                    <textarea
                      value={JSON.stringify(getVal(wf.id, 'steps', wf.steps), null, 2)}
                      onChange={e => { try { edit(wf.id, 'steps', JSON.parse(e.target.value)) } catch { /* ignore */ } }}
                      rows={8}
                      className="w-full bg-white/[0.04] border border-white/[0.06] rounded-lg px-3 py-2 text-[10px] text-white/60 font-mono outline-none focus:border-indigo-500/40 resize-none"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-white/35 block mb-1">Prioriteit</label>
                    <input type="number" value={getVal(wf.id, 'priority', wf.priority)}
                      onChange={e => edit(wf.id, 'priority', Number(e.target.value))}
                      className="w-32 bg-white/[0.04] border border-white/[0.06] rounded-lg px-3 py-2 text-[12px] text-white outline-none focus:border-indigo-500/40" />
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
