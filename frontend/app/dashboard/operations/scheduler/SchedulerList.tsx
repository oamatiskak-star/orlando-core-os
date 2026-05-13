'use client'

import { useState } from 'react'
import { Clock, Plus, X, Pause, Trash2 } from 'lucide-react'
import { createSchedulerTask, toggleSchedulerTask, deleteSchedulerTask } from './actions'

type SchedulerTask = {
  id: string
  naam: string
  company: string
  schedule: string
  task_type: string
  task_config: Record<string, unknown>
  status: string
  timezone: string
  last_run_at: string | null
  next_run_at: string | null
  run_count: number
}

const STATUS_COLORS: Record<string, string> = {
  actief: 'text-green-400 bg-green-500/10',
  gepauzeerd: 'text-amber-400 bg-amber-500/10',
  uitgeschakeld: 'text-white/25 bg-white/5',
}

const TASK_TYPES = ['workflow', 'routine', 'agent', 'api_call', 'email', 'report', 'cleanup', 'backup', 'notification']
const COMPANIES = ['MODIWÉ', 'MEDIA', 'STRKBEHEER', 'STRKBOUW', 'PROFFS']
const CRON_PRESETS = [
  { label: 'Dagelijks 07:00', value: '0 7 * * *' },
  { label: 'Dagelijks 08:00', value: '0 8 * * *' },
  { label: 'Dagelijks 18:00', value: '0 18 * * *' },
  { label: 'Elk uur', value: '0 * * * *' },
  { label: 'Elke 30 min', value: '*/30 * * * *' },
  { label: 'Wekelijks maandag', value: '0 9 * * 1' },
  { label: 'Maandelijks 1e dag', value: '0 9 1 * *' },
]

function TaskRow({ task }: { task: SchedulerTask }) {
  const [toggling, setToggling] = useState(false)

  async function handleToggle() {
    setToggling(true)
    await toggleSchedulerTask(task.id, task.status)
    setToggling(false)
  }

  const lastRun = task.last_run_at
    ? new Date(task.last_run_at).toLocaleString('nl-NL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    : '—'
  const nextRun = task.next_run_at
    ? new Date(task.next_run_at).toLocaleString('nl-NL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    : '—'

  return (
    <div className="flex items-center gap-4 px-4 py-3 bg-white/[0.06] border border-white/5 rounded-xl hover:bg-white/[0.08] transition-colors">
      <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center flex-shrink-0">
        <Clock size={13} className="text-sky-400" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-white truncate">{task.naam}</span>
          <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${STATUS_COLORS[task.status] ?? 'text-white/50 bg-white/5'}`}>
            {task.status}
          </span>
          <span className="px-1.5 py-0.5 rounded bg-white/5 text-[10px] text-white/38 flex-shrink-0">{task.task_type}</span>
        </div>
        <div className="flex items-center gap-3 mt-0.5">
          <code className="text-[10px] text-white/45 font-mono">{task.schedule}</code>
          <span className="text-[10px] text-white/30">{task.timezone}</span>
        </div>
      </div>

      <div className="hidden md:flex items-center gap-6 text-[11px] text-white/45 flex-shrink-0">
        <div className="text-center">
          <p className="text-[10px] text-white/30 mb-0.5">Bedrijf</p>
          <span className="text-white/55">{task.company}</span>
        </div>
        <div className="text-center">
          <p className="text-[10px] text-white/30 mb-0.5">Laatste run</p>
          <span className="text-white/55">{lastRun}</span>
        </div>
        <div className="text-center">
          <p className="text-[10px] text-white/30 mb-0.5">Volgende run</p>
          <span className="text-sky-400">{nextRun}</span>
        </div>
        <div className="text-center">
          <p className="text-[10px] text-white/30 mb-0.5">Runs</p>
          <span className="text-white/55">{task.run_count}</span>
        </div>
      </div>

      <div className="flex items-center gap-1.5 flex-shrink-0">
        <button onClick={handleToggle} disabled={toggling}
          className="w-7 h-7 rounded-lg border border-white/10 flex items-center justify-center text-white/65 hover:text-amber-400 hover:border-amber-500/30 transition-colors disabled:opacity-30"
          title={task.status === 'actief' ? 'Pauzeren' : 'Activeren'}>
          <Pause size={10} />
        </button>
        <button onClick={() => { if (confirm(`"${task.naam}" verwijderen?`)) deleteSchedulerTask(task.id) }}
          className="w-7 h-7 rounded-lg border border-white/10 flex items-center justify-center text-white/65 hover:text-red-400 hover:border-red-500/30 transition-colors"
          title="Verwijderen">
          <Trash2 size={10} />
        </button>
      </div>
    </div>
  )
}

function NieuweTaskModal({ onClose }: { onClose: () => void }) {
  const [pending, setPending] = useState(false)
  const [taskType, setTaskType] = useState('workflow')
  const [configJson, setConfigJson] = useState('{}')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setPending(true)
    const fd = new FormData(e.currentTarget)
    fd.set('task_type', taskType)
    fd.set('task_config', configJson)
    await createSchedulerTask(fd)
    setPending(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[#181830] border border-white/10 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 sticky top-0 bg-[#181830] z-10">
          <h2 className="text-sm font-semibold text-white">Nieuwe Scheduler Taak</h2>
          <button onClick={onClose} className="text-white/50 hover:text-white transition-colors"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs text-white/50 mb-1">Naam *</label>
            <input name="naam" required placeholder="bijv. Dagelijkse rapportage"
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
              <label className="block text-xs text-white/50 mb-1">Task Type</label>
              <select value={taskType} onChange={e => setTaskType(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-indigo-500/60 transition-colors">
                {TASK_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-white/50 mb-1">Schedule *</label>
              <select name="schedule" required className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-indigo-500/60 transition-colors">
                {CRON_PRESETS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-white/50 mb-1">Timezone</label>
              <select name="timezone" className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-indigo-500/60 transition-colors">
                <option value="Europe/Amsterdam">Europe/Amsterdam</option>
                <option value="UTC">UTC</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs text-white/50 mb-1">Task Config (JSON)</label>
            <textarea value={configJson} onChange={e => setConfigJson(e.target.value)} rows={3}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white font-mono placeholder-white/20 outline-none focus:border-indigo-500/60 transition-colors resize-none" />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={pending}
              className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium py-2.5 rounded-lg transition-colors">
              {pending ? 'Aanmaken...' : 'Taak aanmaken'}
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

export default function SchedulerList({ tasks }: { tasks: SchedulerTask[] }) {
  const [showNew, setShowNew] = useState(false)

  return (
    <>
      <div className="flex items-center justify-between">
        <p className="text-xs text-white/50">{tasks.length} geplande taken</p>
        <button onClick={() => setShowNew(true)}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium px-4 py-2 rounded-lg transition-colors">
          <Plus size={13} />
          Nieuwe taak
        </button>
      </div>

      <div className="space-y-2">
        {tasks.map(t => <TaskRow key={t.id} task={t} />)}
        {tasks.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-3 bg-white/[0.02] border border-white/5 rounded-xl">
            <Clock size={24} className="text-white/20" />
            <p className="text-sm text-white/50">Geen geplande taken</p>
            <button onClick={() => setShowNew(true)} className="text-xs text-indigo-400 hover:text-indigo-300">
              Plan je eerste taak in
            </button>
          </div>
        )}
      </div>

      {showNew && <NieuweTaskModal onClose={() => setShowNew(false)} />}
    </>
  )
}
