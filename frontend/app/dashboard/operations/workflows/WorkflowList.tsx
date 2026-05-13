'use client'

import { useState } from 'react'
import { Play, Pause, Trash2, Plus, X, ChevronDown, ChevronRight } from 'lucide-react'
import { createWorkflow, triggerWorkflow, toggleWorkflowStatus, deleteWorkflow } from './actions'

type Step = { type: string; label: string }

type Workflow = {
  id: string
  naam: string
  omschrijving: string | null
  company: string
  category: string | null
  trigger_type: string
  trigger_config: Record<string, string>
  steps: Step[]
  status: string
  last_run_at: string | null
  last_run_status: string | null
  run_count: number
  success_count: number
  failure_count: number
}

const STATUS_COLORS: Record<string, string> = {
  actief: 'bg-green-500/10 text-green-400',
  gepauzeerd: 'bg-amber-500/10 text-amber-400',
  uitgeschakeld: 'bg-white/5 text-white/45',
}

const RUN_STATUS_COLORS: Record<string, string> = {
  success: 'text-green-400',
  failed: 'text-red-400',
  running: 'text-indigo-400',
}

const STEP_TYPE_ICONS: Record<string, string> = {
  bash: '⚡',
  telegram: '📨',
  mail: '✉️',
  api_call: '🔗',
  ai_classify: '🤖',
  ai_score: '🎯',
  crm_update: '👤',
  scrape: '🔍',
  db_insert: '💾',
  db_upsert: '💾',
  webhook: '🪝',
  delay: '⏳',
  condition: '❓',
  http: '🌐',
}

const COMPANIES = ['MODIWÉ', 'MEDIA', 'STRKBEHEER', 'STRKBOUW', 'PROFFS']
const TRIGGER_TYPES = ['manual', 'cron', 'webhook', 'event']
const CATEGORIES = ['automation', 'reporting', 'integration', 'notification', 'data', 'monitoring', 'finance']
const CRON_PRESETS = [
  { label: 'Elke 5 min', value: '*/5 * * * *' },
  { label: 'Elk uur', value: '0 * * * *' },
  { label: 'Dagelijks 08:00', value: '0 8 * * *' },
  { label: 'Dagelijks 09:00', value: '0 9 * * *' },
  { label: 'Wekelijks maandag', value: '0 9 * * 1' },
  { label: 'Maandelijks 1e dag', value: '0 9 1 * *' },
]

function WorkflowRow({ wf }: { wf: Workflow }) {
  const [expanded, setExpanded] = useState(false)
  const [triggering, setTriggering] = useState(false)
  const [toggling, setToggling] = useState(false)

  async function handleTrigger() {
    setTriggering(true)
    await triggerWorkflow(wf.id)
    setTriggering(false)
  }

  async function handleToggle() {
    setToggling(true)
    await toggleWorkflowStatus(wf.id, wf.status)
    setToggling(false)
  }

  const triggerLabel = wf.trigger_config?.label ?? wf.trigger_config?.schedule ?? wf.trigger_type
  const lastRun = wf.last_run_at
    ? new Date(wf.last_run_at).toLocaleString('nl-NL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    : '—'

  return (
    <div className="border border-white/5 rounded-xl overflow-hidden">
      <div
        className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.02] cursor-pointer transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <button
          className="text-white/45 hover:text-white/50 transition-colors flex-shrink-0"
          onClick={e => { e.stopPropagation(); setExpanded(!expanded) }}
        >
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-white truncate">{wf.naam}</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium flex-shrink-0 ${STATUS_COLORS[wf.status] ?? 'bg-white/5 text-white/50'}`}>
              {wf.status}
            </span>
            {wf.category && (
              <span className="px-1.5 py-0.5 rounded bg-white/5 text-[10px] text-white/38 flex-shrink-0">{wf.category}</span>
            )}
          </div>
          {wf.omschrijving && <p className="text-[11px] text-white/50 mt-0.5 truncate">{wf.omschrijving}</p>}
        </div>

        <div className="hidden sm:flex items-center gap-4 text-[11px] text-white/50 flex-shrink-0">
          <span className="px-2 py-0.5 bg-white/5 rounded text-[10px]">{wf.company}</span>
          <span className="font-mono text-[10px]">{triggerLabel}</span>
          <span className={wf.last_run_status ? (RUN_STATUS_COLORS[wf.last_run_status] ?? 'text-white/50') : 'text-white/38'}>
            {lastRun}
          </span>
          <span className="text-white/38">{wf.run_count}x</span>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0" onClick={e => e.stopPropagation()}>
          {wf.status !== 'uitgeschakeld' && (
            <button
              onClick={handleTrigger}
              disabled={triggering || wf.status === 'gepauzeerd'}
              className="w-7 h-7 rounded-lg border border-white/10 flex items-center justify-center text-white/65 hover:text-green-400 hover:border-green-500/30 transition-colors disabled:opacity-30"
              title="Handmatig triggeren"
            >
              {triggering ? <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" /> : <Play size={10} />}
            </button>
          )}
          <button
            onClick={handleToggle}
            disabled={toggling}
            className="w-7 h-7 rounded-lg border border-white/10 flex items-center justify-center text-white/65 hover:text-amber-400 hover:border-amber-500/30 transition-colors disabled:opacity-30"
            title={wf.status === 'actief' ? 'Pauzeren' : 'Activeren'}
          >
            <Pause size={10} />
          </button>
          <button
            onClick={() => { if (confirm(`"${wf.naam}" uitschakelen?`)) deleteWorkflow(wf.id) }}
            className="w-7 h-7 rounded-lg border border-white/10 flex items-center justify-center text-white/65 hover:text-red-400 hover:border-red-500/30 transition-colors"
            title="Uitschakelen"
          >
            <Trash2 size={10} />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 border-t border-white/5 bg-white/[0.01]">
          <div className="pt-3 space-y-3">
            <div className="flex gap-6 text-[10px] text-white/50">
              <span>Geslaagd: <span className="text-green-400">{wf.success_count}</span></span>
              <span>Mislukt: <span className="text-red-400">{wf.failure_count}</span></span>
              <span>Totaal: <span className="text-white/70">{wf.run_count}</span></span>
            </div>
            <p className="text-[10px] font-semibold text-white/50 uppercase tracking-wider">Stappen</p>
            <div className="flex flex-wrap gap-2">
              {wf.steps.map((step, i) => (
                <div key={i} className="flex items-center gap-2 bg-white/5 border border-white/[0.08] rounded-lg px-3 py-1.5">
                  <span className="text-sm">{STEP_TYPE_ICONS[step.type] ?? '⚙️'}</span>
                  <div>
                    <p className="text-xs text-white/70 font-medium">{step.label}</p>
                    <p className="text-[10px] text-white/45">{step.type}</p>
                  </div>
                  {i < wf.steps.length - 1 && <span className="text-white/38 ml-1">→</span>}
                </div>
              ))}
              {wf.steps.length === 0 && <p className="text-xs text-white/38">Geen stappen geconfigureerd</p>}
            </div>
            {wf.trigger_type === 'webhook' && wf.trigger_config?.webhook_secret && (
              <div className="bg-white/5 rounded-lg px-3 py-2">
                <p className="text-[10px] text-white/50 mb-1">Webhook secret</p>
                <code className="text-xs text-indigo-300 font-mono">{wf.trigger_config.webhook_secret}</code>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function NieuweWorkflowModal({ onClose }: { onClose: () => void }) {
  const [pending, setPending] = useState(false)
  const [triggerType, setTriggerType] = useState('cron')
  const [steps, setSteps] = useState<Step[]>([{ type: 'api_call', label: 'API aanroepen' }])
  const STEP_TYPES = Object.keys(STEP_TYPE_ICONS)

  function addStep() { setSteps(s => [...s, { type: 'api_call', label: 'Nieuwe stap' }]) }
  function removeStep(i: number) { setSteps(s => s.filter((_, idx) => idx !== i)) }
  function updateStep(i: number, field: string, value: string) {
    setSteps(s => s.map((step, idx) => idx === i ? { ...step, [field]: value } : step))
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setPending(true)
    const fd = new FormData(e.currentTarget)
    fd.set('steps', JSON.stringify(steps))
    await createWorkflow(fd)
    setPending(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[#181830] border border-white/10 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 sticky top-0 bg-[#181830] z-10">
          <h2 className="text-sm font-semibold text-white">Nieuwe Workflow</h2>
          <button onClick={onClose} className="text-white/50 hover:text-white transition-colors"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs text-white/50 mb-1">Naam *</label>
            <input name="naam" required placeholder="bijv. Dagelijkse rapport workflow"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-indigo-500/60 transition-colors" />
          </div>
          <div>
            <label className="block text-xs text-white/50 mb-1">Omschrijving</label>
            <input name="omschrijving" placeholder="Wat doet deze workflow?"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-indigo-500/60 transition-colors" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-white/50 mb-1">Bedrijf</label>
              <select name="company" className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-indigo-500/60 transition-colors">
                {COMPANIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-white/50 mb-1">Trigger type</label>
              <select name="trigger_type" value={triggerType} onChange={e => setTriggerType(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-indigo-500/60 transition-colors">
                {TRIGGER_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs text-white/50 mb-1">Categorie</label>
            <select name="category" className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-indigo-500/60 transition-colors">
              <option value="">— geen —</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          {triggerType === 'cron' && (
            <div>
              <label className="block text-xs text-white/50 mb-1">Schedule</label>
              <select name="schedule" className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-indigo-500/60 transition-colors">
                {CRON_PRESETS.map(p => <option key={p.value} value={p.value}>{p.label} ({p.value})</option>)}
              </select>
            </div>
          )}
          {triggerType === 'event' && (
            <div>
              <label className="block text-xs text-white/50 mb-1">Event naam</label>
              <input name="event_name" placeholder="bijv. new_email, new_deal"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-indigo-500/60 transition-colors" />
            </div>
          )}

          <div className="space-y-2 pt-1 border-t border-white/5">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold text-white/50 uppercase tracking-wider">Stappen</p>
              <button type="button" onClick={addStep} className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
                <Plus size={11} /> Stap toevoegen
              </button>
            </div>
            {steps.map((step, i) => (
              <div key={i} className="flex items-center gap-2 bg-white/[0.06] border border-white/5 rounded-lg p-2">
                <span className="text-white/50 text-xs w-5 flex-shrink-0">{i + 1}.</span>
                <select value={step.type} onChange={e => updateStep(i, 'type', e.target.value)}
                  className="bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white outline-none focus:border-indigo-500/60">
                  {STEP_TYPES.map(t => <option key={t} value={t}>{STEP_TYPE_ICONS[t]} {t}</option>)}
                </select>
                <input value={step.label} onChange={e => updateStep(i, 'label', e.target.value)}
                  className="flex-1 bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white outline-none focus:border-indigo-500/60" />
                <button type="button" onClick={() => removeStep(i)} className="text-white/38 hover:text-red-400 transition-colors flex-shrink-0">
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={pending}
              className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium py-2.5 rounded-lg transition-colors">
              {pending ? 'Aanmaken...' : 'Workflow aanmaken'}
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

export default function WorkflowList({ workflows }: { workflows: Workflow[] }) {
  const [showNew, setShowNew] = useState(false)
  const [filter, setFilter] = useState<string>('all')

  const filtered = filter === 'all' ? workflows : workflows.filter(w => w.status === filter)
  const actief = workflows.filter(w => w.status === 'actief').length
  const gepauzeerd = workflows.filter(w => w.status === 'gepauzeerd').length

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-white/50">
            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-green-500" />{actief} actief</span>
            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-amber-500" />{gepauzeerd} gepauzeerd</span>
          </div>
          <div className="flex gap-1">
            {['all', 'actief', 'gepauzeerd', 'uitgeschakeld'].map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-2.5 py-1 rounded-md text-[11px] transition-colors ${filter === f ? 'bg-indigo-500/20 text-indigo-400' : 'text-white/45 hover:text-white/70'}`}>
                {f === 'all' ? 'Alle' : f}
              </button>
            ))}
          </div>
        </div>
        <button onClick={() => setShowNew(true)}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium px-4 py-2 rounded-lg transition-colors">
          <Plus size={13} />
          Nieuwe workflow
        </button>
      </div>

      <div className="space-y-2">
        {filtered.map(wf => <WorkflowRow key={wf.id} wf={wf} />)}
        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-3 bg-white/[0.02] border border-white/5 rounded-xl">
            <p className="text-sm text-white/50">Geen workflows gevonden</p>
            <button onClick={() => setShowNew(true)} className="text-xs text-indigo-400 hover:text-indigo-300">
              Maak je eerste workflow aan
            </button>
          </div>
        )}
      </div>

      {showNew && <NieuweWorkflowModal onClose={() => setShowNew(false)} />}
    </>
  )
}
