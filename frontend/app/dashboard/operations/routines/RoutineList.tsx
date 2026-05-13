'use client'

import { useState } from 'react'
import { Play, Pause, Trash2, Plus, X } from 'lucide-react'
import { createRoutine, runRoutine, toggleRoutineStatus, deleteRoutine } from './actions'

type RoutineStep = { type: string; label: string }

type Routine = {
  id: string
  naam: string
  omschrijving: string | null
  company: string
  category: string | null
  schedule: string
  steps: RoutineStep[]
  status: string
  last_run_at: string | null
  last_run_status: string | null
  next_run_at: string | null
  run_count: number
}

const STATUS_COLORS: Record<string, string> = {
  actief: 'bg-green-500/10 text-green-400',
  gepauzeerd: 'bg-amber-500/10 text-amber-400',
  uitgeschakeld: 'bg-white/5 text-white/45',
}

const RUN_STATUS_COLORS: Record<string, string> = {
  success: 'text-green-400',
  failed: 'text-red-400',
  running: 'text-indigo-400 animate-pulse',
}

const COMPANIES = ['MODIWÉ', 'MEDIA', 'STRKBEHEER', 'STRKBOUW', 'PROFFS']
const CATEGORIES = ['dagelijks', 'wekelijks', 'maandelijks', 'finance', 'reporting', 'onderhoud', 'notificatie']
const CRON_PRESETS = [
  { label: 'Dagelijks 07:00', value: '0 7 * * *' },
  { label: 'Dagelijks 08:00', value: '0 8 * * *' },
  { label: 'Dagelijks 09:00', value: '0 9 * * *' },
  { label: 'Dagelijks 18:00', value: '0 18 * * *' },
  { label: 'Elk uur', value: '0 * * * *' },
  { label: 'Wekelijks maandag 09:00', value: '0 9 * * 1' },
  { label: 'Wekelijks vrijdag 17:00', value: '0 17 * * 5' },
  { label: 'Maandelijks 1e dag', value: '0 9 1 * *' },
  { label: 'Maandelijks laatste dag', value: '0 9 28 * *' },
]

function RoutineRow({ routine }: { routine: Routine }) {
  const [running, setRunning] = useState(false)
  const [toggling, setToggling] = useState(false)

  async function handleRun() {
    setRunning(true)
    await runRoutine(routine.id)
    setRunning(false)
  }

  async function handleToggle() {
    setToggling(true)
    await toggleRoutineStatus(routine.id, routine.status)
    setToggling(false)
  }

  const lastRun = routine.last_run_at
    ? new Date(routine.last_run_at).toLocaleString('nl-NL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    : '—'
  const nextRun = routine.next_run_at
    ? new Date(routine.next_run_at).toLocaleString('nl-NL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    : '—'

  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-white/[0.06] border border-white/5 rounded-xl hover:bg-white/[0.08] transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-white truncate">{routine.naam}</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium flex-shrink-0 ${STATUS_COLORS[routine.status] ?? 'bg-white/5 text-white/50'}`}>
            {routine.status}
          </span>
          {routine.category && (
            <span className="px-1.5 py-0.5 rounded bg-white/5 text-[10px] text-white/38 flex-shrink-0">{routine.category}</span>
          )}
        </div>
        {routine.omschrijving && <p className="text-[11px] text-white/50 mt-0.5 truncate">{routine.omschrijving}</p>}
      </div>

      <div className="hidden md:flex items-center gap-5 text-[11px] text-white/45 flex-shrink-0">
        <div>
          <p className="text-[10px] text-white/30 mb-0.5">Schedule</p>
          <code className="text-[10px] text-white/60 font-mono">{routine.schedule}</code>
        </div>
        <div>
          <p className="text-[10px] text-white/30 mb-0.5">Laatste run</p>
          <span className={routine.last_run_status ? (RUN_STATUS_COLORS[routine.last_run_status] ?? 'text-white/50') : 'text-white/38'}>{lastRun}</span>
        </div>
        <div>
          <p className="text-[10px] text-white/30 mb-0.5">Volgende run</p>
          <span className="text-white/50">{nextRun}</span>
        </div>
        <span className="text-white/38">{routine.run_count}x</span>
      </div>

      <div className="flex items-center gap-1.5 flex-shrink-0">
        {routine.status !== 'uitgeschakeld' && (
          <button onClick={handleRun} disabled={running}
            className="w-7 h-7 rounded-lg border border-white/10 flex items-center justify-center text-white/65 hover:text-green-400 hover:border-green-500/30 transition-colors disabled:opacity-30"
            title="Nu uitvoeren">
            {running ? <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" /> : <Play size={10} />}
          </button>
        )}
        <button onClick={handleToggle} disabled={toggling}
          className="w-7 h-7 rounded-lg border border-white/10 flex items-center justify-center text-white/65 hover:text-amber-400 hover:border-amber-500/30 transition-colors disabled:opacity-30"
          title={routine.status === 'actief' ? 'Pauzeren' : 'Activeren'}>
          <Pause size={10} />
        </button>
        <button onClick={() => { if (confirm(`"${routine.naam}" uitschakelen?`)) deleteRoutine(routine.id) }}
          className="w-7 h-7 rounded-lg border border-white/10 flex items-center justify-center text-white/65 hover:text-red-400 hover:border-red-500/30 transition-colors"
          title="Uitschakelen">
          <Trash2 size={10} />
        </button>
      </div>
    </div>
  )
}

function NieuweRoutineModal({ onClose }: { onClose: () => void }) {
  const [pending, setPending] = useState(false)
  const [steps, setSteps] = useState<RoutineStep[]>([{ type: 'api_call', label: 'Stap uitvoeren' }])

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
    await createRoutine(fd)
    setPending(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[#181830] border border-white/10 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 sticky top-0 bg-[#181830] z-10">
          <h2 className="text-sm font-semibold text-white">Nieuwe Routine</h2>
          <button onClick={onClose} className="text-white/50 hover:text-white transition-colors"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs text-white/50 mb-1">Naam *</label>
            <input name="naam" required placeholder="bijv. Dagelijkse backup"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-indigo-500/60 transition-colors" />
          </div>
          <div>
            <label className="block text-xs text-white/50 mb-1">Omschrijving</label>
            <input name="omschrijving" placeholder="Wat doet deze routine?"
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
              <label className="block text-xs text-white/50 mb-1">Categorie</label>
              <select name="category" className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-indigo-500/60 transition-colors">
                <option value="">— geen —</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs text-white/50 mb-1">Schedule *</label>
            <select name="schedule" required className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-indigo-500/60 transition-colors">
              {CRON_PRESETS.map(p => <option key={p.value} value={p.value}>{p.label} — {p.value}</option>)}
            </select>
          </div>

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
                <input value={step.type} onChange={e => updateStep(i, 'type', e.target.value)} placeholder="type"
                  className="w-28 bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white outline-none focus:border-indigo-500/60" />
                <input value={step.label} onChange={e => updateStep(i, 'label', e.target.value)} placeholder="label"
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
              {pending ? 'Aanmaken...' : 'Routine aanmaken'}
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

export default function RoutineList({ routines }: { routines: Routine[] }) {
  const [showNew, setShowNew] = useState(false)

  return (
    <>
      <div className="flex items-center justify-between">
        <p className="text-xs text-white/50">{routines.length} routines</p>
        <button onClick={() => setShowNew(true)}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium px-4 py-2 rounded-lg transition-colors">
          <Plus size={13} />
          Nieuwe routine
        </button>
      </div>

      <div className="space-y-2">
        {routines.map(r => <RoutineRow key={r.id} routine={r} />)}
        {routines.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-3 bg-white/[0.02] border border-white/5 rounded-xl">
            <p className="text-sm text-white/50">Geen routines gevonden</p>
            <button onClick={() => setShowNew(true)} className="text-xs text-indigo-400 hover:text-indigo-300">
              Maak je eerste routine aan
            </button>
          </div>
        )}
      </div>

      {showNew && <NieuweRoutineModal onClose={() => setShowNew(false)} />}
    </>
  )
}
