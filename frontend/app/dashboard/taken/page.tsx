'use client'

import { useState, useEffect, useCallback } from 'react'
import { CheckSquare, Plus, X, AlertTriangle, GitBranch, RefreshCw, Play, Edit2, GitFork, ArrowDown } from 'lucide-react'
import clsx from 'clsx'

type PlanningItem = {
  id: string
  titel: string
  type: string
  status: 'open' | 'bezig' | 'gereed' | 'geblokkeerd'
  priority: 'laag' | 'normaal' | 'hoog' | 'urgent'
  toegewezen: string | null
  due_date: string | null
  beschrijving: string | null
  project: { id: string; name: string } | null
  company: { id: string; name: string } | null
  completed_at: string | null
  orchestrator_task_id?: string | null
  notes?: string | null
}

type OrchestratorLog = {
  id: string
  level: 'info' | 'warn' | 'error'
  message: string
  payload: Record<string, unknown> | null
  created_at: string
}

type OrchestratorTaskDetail = {
  id: string
  status: string
  priority: number
  priority_band: string
  attempts: number
  started_at: string | null
  finished_at: string | null
  error: string | null
  result_summary: string | null
  objective?: string[]
  payload?: Record<string, unknown> | null
  parent_task_id?: string | null
}

type ChainStep = {
  id: string
  step_order: number
  persona_name: string
  status: 'pending' | 'dispatched' | 'completed' | 'failed' | 'skipped'
  child_task_id: string | null
  started_at: string | null
  finished_at: string | null
}

type PersonaOption = { name: string; persona_type: string; role: string }

type Project = { id: string; name: string }

const PRIORITY_COLORS: Record<string, string> = {
  urgent: 'bg-red-500/10 text-red-400',
  hoog:   'bg-orange-500/10 text-orange-400',
  normaal:'bg-amber-500/10 text-amber-400',
  laag:   'bg-white/5 text-white/50',
}

const STATUS_COLORS: Record<string, string> = {
  gereed:     'bg-green-500/10 text-green-400',
  bezig:      'bg-amber-500/10 text-amber-400',
  geblokkeerd:'bg-red-500/10 text-red-400',
  open:       'bg-white/[0.08] text-white/65',
}

const STATUS_LABELS: Record<string, string> = {
  open: 'Open', bezig: 'Bezig', gereed: 'Gereed', geblokkeerd: 'Geblokkeerd',
}

function isToday(dateStr: string | null) {
  if (!dateStr) return false
  return new Date(dateStr).toDateString() === new Date().toDateString()
}

function isThisWeek(dateStr: string | null) {
  if (!dateStr) return false
  const d = new Date(dateStr)
  const now = new Date()
  const end = new Date(now); end.setDate(now.getDate() + 7)
  return d >= now && d <= end
}

function isOverdue(item: PlanningItem) {
  if (!item.due_date || item.status === 'gereed') return false
  return new Date(item.due_date) < new Date()
}

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('nl-NL', { day: '2-digit', month: 'short' })
}

function todayISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const PROJECT_TYPES = [
  { value: 'renovation',   label: 'Renovatie' },
  { value: 'construction', label: 'Bouw' },
  { value: 'real_estate',  label: 'Vastgoed' },
  { value: 'development',  label: 'Ontwikkeling' },
  { value: 'saas',         label: 'SaaS' },
] as const

const emptyForm = () => ({
  titel: '', type: 'taak', priority: 'normaal', status: 'open',
  toegewezen: '', due_date: todayISO(), beschrijving: '', project_id: '',
})

export default function TakenPage() {
  const [items, setItems] = useState<PlanningItem[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [activeTab, setActiveTab] = useState('Alle')
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<PlanningItem | null>(null)
  const [form, setForm] = useState(emptyForm())
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')
  const [syncing, setSyncing]     = useState(false)
  const [syncMsg, setSyncMsg]     = useState('')

  const [showNewProject, setShowNewProject] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const [newProjectType, setNewProjectType] = useState<string>('renovation')
  const [creatingProject, setCreatingProject] = useState(false)
  const [projectError, setProjectError] = useState('')

  // Detail modal state
  const [detailItem, setDetailItem] = useState<PlanningItem | null>(null)
  const [detailTask, setDetailTask] = useState<OrchestratorTaskDetail | null>(null)
  const [detailLogs, setDetailLogs] = useState<OrchestratorLog[]>([])
  const [detailChain, setDetailChain] = useState<ChainStep[]>([])
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailEditing, setDetailEditing] = useState(false)
  const [detailNewBeschrijving, setDetailNewBeschrijving] = useState('')
  const [rerunning, setRerunning] = useState(false)
  const [dispatching, setDispatching] = useState(false)
  const [dispatchMsg, setDispatchMsg] = useState('')

  // Chain modal state
  const [showChainBuilder, setShowChainBuilder] = useState(false)
  const [chainPersonas, setChainPersonas] = useState<PersonaOption[]>([])
  const [chainSelection, setChainSelection] = useState<string[]>([])
  const [chainSaving, setChainSaving] = useState(false)
  const [chainError, setChainError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/planning')
      if (res.ok) {
        const j = await res.json()
        setItems(j.items ?? [])
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    fetch('/api/projects').then(r => r.ok ? r.json() : { projects: [] }).then(j => setProjects(j.projects ?? []))
  }, [])

  const filtered = items.filter(i => {
    if (activeTab === 'Open')      return i.status === 'open'
    if (activeTab === 'Urgent')    return i.priority === 'urgent' || i.priority === 'hoog'
    if (activeTab === 'Vandaag')   return isToday(i.due_date)
    if (activeTab === 'Deze week') return isThisWeek(i.due_date)
    if (activeTab === 'Afgerond')  return i.status === 'gereed'
    return true
  })

  const stats = {
    open:      items.filter(i => i.status === 'open').length,
    urgent:    items.filter(i => i.priority === 'urgent').length,
    week:      items.filter(i => isThisWeek(i.due_date) && i.status !== 'gereed').length,
    afgerond:  items.filter(i => i.status === 'gereed').length,
  }

  async function syncGitHub() {
    setSyncing(true); setSyncMsg('')
    try {
      const res  = await fetch('/api/github/sync-projects', { method: 'POST' })
      const data = await res.json()
      setSyncMsg(`${data.synced} repo's gesynchroniseerd`)
      fetch('/api/projects').then(r => r.ok ? r.json() : { projects: [] }).then(j => setProjects(j.projects ?? []))
    } finally {
      setSyncing(false)
    }
  }

  function openNew() {
    setEditing(null)
    setForm(emptyForm())
    setError('')
    setShowNewProject(false)
    setNewProjectName('')
    setProjectError('')
    setShowModal(true)
  }

  function openEdit(item: PlanningItem) {
    setEditing(item)
    setForm({
      titel:       item.titel,
      type:        item.type,
      priority:    item.priority,
      status:      item.status,
      toegewezen:  item.toegewezen ?? '',
      due_date:    item.due_date ?? '',
      beschrijving:item.beschrijving ?? '',
      project_id:  item.project?.id ?? '',
    })
    setError('')
    setShowModal(true)
  }

  async function save() {
    if (!form.titel.trim()) { setError('Titel is verplicht'); return }
    setSaving(true); setError('')
    try {
      const body = {
        titel:        form.titel.trim(),
        type:         form.type,
        priority:     form.priority,
        status:       form.status,
        toegewezen:   form.toegewezen || null,
        due_date:     form.due_date || null,
        beschrijving: form.beschrijving || null,
        project_id:   form.project_id || null,
      }
      let res: Response
      if (editing) {
        res = await fetch(`/api/planning/${editing.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      } else {
        res = await fetch('/api/planning', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      }
      if (!res.ok) { const j = await res.json(); setError(j.error ?? 'Fout'); return }
      setShowModal(false)
      await load()
    } finally {
      setSaving(false)
    }
  }

  async function del(id: string) {
    if (!confirm('Taak verwijderen?')) return
    await fetch(`/api/planning/${id}`, { method: 'DELETE' })
    await load()
  }

  async function quickStatusChange(id: string, newStatus: string) {
    // Optimistic UI update
    setItems(prev => prev.map(i =>
      i.id === id ? { ...i, status: newStatus as PlanningItem['status'] } : i
    ))
    const res = await fetch(`/api/planning/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    if (!res.ok) {
      await load()
    }
  }

  async function createProject() {
    if (!newProjectName.trim()) { setProjectError('Naam vereist'); return }
    setCreatingProject(true); setProjectError('')
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newProjectName.trim(), type: newProjectType }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        setProjectError(j.error ?? 'Aanmaken faalde')
        return
      }
      const j = await res.json()
      const created: Project | undefined = j.project
      const fresh = await fetch('/api/projects').then(r => r.ok ? r.json() : { projects: [] })
      setProjects(fresh.projects ?? [])
      if (created?.id) setForm(f => ({ ...f, project_id: created.id }))
      setNewProjectName('')
      setShowNewProject(false)
    } finally {
      setCreatingProject(false)
    }
  }

  const tabs = ['Alle', 'Open', 'Urgent', 'Vandaag', 'Deze week', 'Afgerond']

  async function openDetail(item: PlanningItem) {
    setDetailItem(item)
    setDetailTask(null)
    setDetailLogs([])
    setDetailChain([])
    setDetailEditing(false)
    setDetailNewBeschrijving(item.beschrijving ?? '')
    if (item.orchestrator_task_id) {
      setDetailLoading(true)
      try {
        const res = await fetch(`/api/orchestrator/tasks/${item.orchestrator_task_id}`)
        if (res.ok) {
          const j = await res.json()
          const task = j.task as OrchestratorTaskDetail | null
          setDetailTask(task ?? null)
          setDetailLogs((j.logs ?? []) as OrchestratorLog[])
          // Als deze task een chain heeft (parent of root), haal alle steps op
          const rootId = task?.parent_task_id ?? task?.id
          if (rootId) {
            const cr = await fetch(`/api/orchestrator/task-chain?root=${rootId}`)
            if (cr.ok) {
              const cj = await cr.json()
              setDetailChain((cj.steps ?? []) as ChainStep[])
            }
          }
        }
      } finally {
        setDetailLoading(false)
      }
    }
  }

  function closeDetail() {
    setDetailItem(null)
    setDetailTask(null)
    setDetailLogs([])
    setDetailChain([])
    setDetailEditing(false)
    setDetailNewBeschrijving('')
    setDispatchMsg('')
  }

  async function openChainBuilder() {
    if (!detailItem) return
    setChainError('')
    setChainSelection([])
    if (chainPersonas.length === 0) {
      const res = await fetch('/api/agents/personas')
      if (res.ok) {
        const j = await res.json()
        setChainPersonas((j.personas ?? []).map((p: PersonaOption) => ({
          name: p.name, persona_type: p.persona_type, role: p.role,
        })))
      }
    }
    setShowChainBuilder(true)
  }

  async function saveChain() {
    if (!detailItem || chainSelection.length === 0) return
    setChainSaving(true); setChainError('')
    try {
      const res = await fetch(`/api/planning/${detailItem.id}/chain`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chain: chainSelection,
          beschrijving: detailNewBeschrijving || detailItem.beschrijving || undefined,
        }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        setChainError(j.error ?? 'Chain aanmaken faalde')
        return
      }
      setShowChainBuilder(false)
      closeDetail()
      await load()
    } finally {
      setChainSaving(false)
    }
  }

  async function rerunTask() {
    if (!detailItem) return
    setRerunning(true)
    try {
      const res = await fetch(`/api/planning/${detailItem.id}/rerun`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ beschrijving: detailNewBeschrijving }),
      })
      if (res.ok) {
        closeDetail()
        await load()
      }
    } finally {
      setRerunning(false)
    }
  }

  async function dispatchTask(item?: PlanningItem) {
    const target = item ?? detailItem
    if (!target) return
    setDispatching(true)
    setDispatchMsg('')
    try {
      const res = await fetch(`/api/planning/${target.id}/dispatch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ persona: 'ai' }),
      })
      const j = await res.json()
      if (res.ok) {
        setDispatchMsg('Gedispatcht')
        if (!item) closeDetail()
        await load()
      } else {
        setDispatchMsg(j.error ?? 'Dispatch mislukt')
      }
    } finally {
      setDispatching(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center">
            <CheckSquare size={16} className="text-yellow-400" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-white">Taken</h1>
            <p className="text-xs text-white/50">Openstaande taken, acties en prioriteiten over alle BV&apos;s.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={syncGitHub}
            disabled={syncing}
            title="GitHub repo's synchroniseren als projecten"
            className="flex items-center gap-2 bg-white/[0.06] border border-white/10 hover:bg-white/10 text-white/70 text-xs font-medium px-3 py-2 rounded-lg transition-colors disabled:opacity-50"
          >
            {syncing ? <RefreshCw size={13} className="animate-spin" /> : <GitBranch size={13} />}
            {syncMsg || 'Sync GitHub'}
          </button>
          <button
            onClick={openNew}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <Plus size={13} /> Nieuwe taak
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Open',       value: stats.open,     color: 'text-white' },
          { label: 'Urgent',     value: stats.urgent,   color: 'text-red-400' },
          { label: 'Deze week',  value: stats.week,     color: 'text-amber-400' },
          { label: 'Afgerond',   value: stats.afgerond, color: 'text-green-400' },
        ].map((s) => {
          const active = activeTab === s.label
          return (
            <button
              key={s.label}
              type="button"
              onClick={() => setActiveTab(s.label)}
              className={clsx(
                'text-left rounded-xl p-4 transition-colors border',
                active
                  ? 'bg-indigo-500/10 border-indigo-500/40 ring-1 ring-indigo-500/30'
                  : 'bg-white/[0.06] border-white/5 hover:bg-white/[0.10]',
              )}
            >
              <p className="text-[11px] text-white/50 mb-1">{s.label}</p>
              <p className={`text-2xl font-semibold ${s.color}`}>{loading ? '…' : s.value}</p>
            </button>
          )
        })}
      </div>

      <div className="flex items-center gap-1 p-1 bg-white/[0.06] border border-white/5 rounded-xl w-fit">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={clsx(
              'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
              activeTab === tab ? 'bg-indigo-600 text-white' : 'text-white/65 hover:text-white/70'
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="bg-white/[0.06] border border-white/5 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-xs text-white/40">Laden…</div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-xs text-white/40">Geen taken gevonden</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="px-4 py-2.5 text-left text-[10px] font-medium text-white/50 uppercase tracking-wider">Prioriteit</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-medium text-white/50 uppercase tracking-wider">Taak</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-medium text-white/50 uppercase tracking-wider">Project</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-medium text-white/50 uppercase tracking-wider">Toegewezen</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-medium text-white/50 uppercase tracking-wider">Deadline</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-medium text-white/50 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr
                    key={row.id}
                    onClick={() => openDetail(row)}
                    className={clsx(
                      'border-b border-white/5 hover:bg-white/[0.04] transition-colors cursor-pointer',
                      isOverdue(row) && 'border-l-2 border-l-red-500/40',
                      row.status === 'gereed' && 'opacity-50'
                    )}
                  >
                    <td className="px-4 py-3">
                      <span className={clsx('px-2 py-0.5 rounded-full text-[10px] font-semibold', PRIORITY_COLORS[row.priority] ?? PRIORITY_COLORS.laag)}>
                        {row.priority.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3 max-w-[260px]">
                      <span className={clsx('text-xs text-white/80', row.status === 'gereed' && 'line-through text-white/40')}>
                        {isOverdue(row) && <AlertTriangle size={10} className="inline text-red-400 mr-1" />}
                        {row.titel}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-white/65">{row.project?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-white/50">{row.toegewezen ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-white/50 whitespace-nowrap">{fmtDate(row.due_date)}</td>
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <select
                        value={row.status}
                        onChange={e => quickStatusChange(row.id, e.target.value)}
                        className={clsx(
                          'px-2 py-0.5 rounded-full text-[10px] font-medium border-0 appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500/50',
                          STATUS_COLORS[row.status],
                        )}
                        title="Klik om status te wijzigen"
                      >
                        {(['open','bezig','gereed','geblokkeerd'] as const).map(s => (
                          <option key={s} value={s} className="bg-[#0f1117] text-white">
                            {STATUS_LABELS[s]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-2">
                        {row.status !== 'gereed' && (
                          <button
                            onClick={() => dispatchTask(row)}
                            disabled={dispatching}
                            title="Voer uit met AI"
                            className="text-[11px] text-indigo-400/70 hover:text-indigo-300 transition-colors disabled:opacity-40"
                          >
                            ▶
                          </button>
                        )}
                        <button onClick={() => openEdit(row)} className="text-[11px] text-white/40 hover:text-white transition-colors">Bewerk</button>
                        <button onClick={() => del(row.id)} className="text-[11px] text-red-400/60 hover:text-red-400 transition-colors">✕</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {detailItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#0f1117] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-white/5">
              <div className="flex items-center gap-3">
                <span className={clsx('px-2 py-0.5 rounded-full text-[10px] font-semibold', PRIORITY_COLORS[detailItem.priority] ?? PRIORITY_COLORS.laag)}>
                  {detailItem.priority.toUpperCase()}
                </span>
                <h2 className="text-sm font-semibold text-white">{detailItem.titel}</h2>
                <span className={clsx('px-2 py-0.5 rounded-full text-[10px] font-medium', STATUS_COLORS[detailItem.status])}>
                  {STATUS_LABELS[detailItem.status]}
                </span>
              </div>
              <button onClick={closeDetail}><X size={16} className="text-white/50 hover:text-white" /></button>
            </div>

            <div className="p-5 space-y-5">
              <div className="grid grid-cols-3 gap-3 text-xs">
                <div>
                  <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Project</p>
                  <p className="text-white/80">{detailItem.project?.name ?? '—'}</p>
                </div>
                <div>
                  <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Deadline</p>
                  <p className="text-white/80">{fmtDate(detailItem.due_date)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Toegewezen</p>
                  <p className="text-white/80">{detailItem.toegewezen ?? '—'}</p>
                </div>
              </div>

              <div>
                <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1.5">Beschrijving</p>
                {detailEditing ? (
                  <textarea
                    rows={4}
                    className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-indigo-500 resize-none"
                    value={detailNewBeschrijving}
                    onChange={e => setDetailNewBeschrijving(e.target.value)}
                    placeholder="Geef de AI een duidelijke instructie…"
                  />
                ) : (
                  <p className="text-xs text-white/80 whitespace-pre-wrap">
                    {detailItem.beschrijving ?? <span className="text-white/40">Geen beschrijving</span>}
                  </p>
                )}
              </div>

              <div>
                <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1.5">Wat heeft de AI uitgevoerd?</p>
                {!detailItem.orchestrator_task_id ? (
                  <p className="text-xs text-white/40 italic">Deze taak is niet via AI uitgevoerd.</p>
                ) : detailLoading ? (
                  <p className="text-xs text-white/40">Laden…</p>
                ) : (
                  <div className="space-y-3">
                    {detailTask?.result_summary && (
                      <div className="bg-green-500/5 border-l-2 border-green-500/40 rounded-r px-3 py-2.5">
                        <p className="text-[10px] text-green-400 uppercase tracking-wider mb-1">Samenvatting</p>
                        <p className="text-xs text-white/85 whitespace-pre-wrap">{detailTask.result_summary}</p>
                      </div>
                    )}
                    {detailTask?.error && (
                      <div className="bg-red-500/5 border-l-2 border-red-500/40 rounded-r px-3 py-2.5">
                        <p className="text-[10px] text-red-400 uppercase tracking-wider mb-1">Fout</p>
                        <p className="text-xs text-white/85 whitespace-pre-wrap">{detailTask.error}</p>
                      </div>
                    )}
                    {detailLogs.length > 0 && (
                      <div className="bg-white/[0.03] border border-white/5 rounded-lg p-3">
                        <p className="text-[10px] text-white/40 uppercase tracking-wider mb-2">Tijdlijn</p>
                        <ol className="space-y-1.5">
                          {detailLogs.map((log) => (
                            <li key={log.id} className="flex gap-2 text-[11px]">
                              <span className="text-white/30 font-mono shrink-0">
                                {new Date(log.created_at).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                              </span>
                              <span className={clsx(
                                'shrink-0 font-semibold uppercase text-[9px] mt-0.5',
                                log.level === 'error' ? 'text-red-400' :
                                log.level === 'warn'  ? 'text-amber-400' : 'text-white/40',
                              )}>
                                {log.level}
                              </span>
                              <div className="flex-1 min-w-0">
                                <p className="text-white/75">{log.message}</p>
                                {log.payload && typeof log.payload === 'object' && 'summary' in log.payload && typeof log.payload.summary === 'string' && log.payload.summary && (
                                  <p className="text-white/50 italic mt-0.5 whitespace-pre-wrap">{log.payload.summary as string}</p>
                                )}
                              </div>
                            </li>
                          ))}
                        </ol>
                      </div>
                    )}
                    {detailTask && detailLogs.length === 0 && !detailTask.result_summary && (
                      <p className="text-xs text-white/40 italic">Nog geen output beschikbaar.</p>
                    )}
                  </div>
                )}
              </div>

              {detailChain.length > 0 && (
                <div>
                  <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1.5">Agent chain</p>
                  <ol className="space-y-1.5">
                    {detailChain.map((step) => (
                      <li key={step.id} className="flex items-center gap-3 bg-white/[0.04] border border-white/5 rounded-lg px-3 py-2">
                        <span className="text-[10px] text-white/40 font-mono w-6">#{step.step_order + 1}</span>
                        <span className="text-xs text-white/85 flex-1">{step.persona_name}</span>
                        <span className={clsx(
                          'px-2 py-0.5 rounded-full text-[10px] font-medium',
                          step.status === 'completed'  ? 'bg-green-500/10 text-green-400' :
                          step.status === 'dispatched' ? 'bg-amber-500/10 text-amber-400' :
                          step.status === 'failed'     ? 'bg-red-500/10 text-red-400' :
                          step.status === 'skipped'    ? 'bg-white/[0.06] text-white/40' :
                                                         'bg-white/[0.08] text-white/65',
                        )}>{step.status}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {detailItem.notes && (
                <div>
                  <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1.5">Geschiedenis</p>
                  <pre className="text-[11px] text-white/55 whitespace-pre-wrap font-sans bg-white/[0.03] border border-white/5 rounded-lg p-3">{detailItem.notes}</pre>
                </div>
              )}

              {dispatchMsg && (
                <p className={`text-xs px-1 ${dispatchMsg === 'Gedispatcht' ? 'text-green-400' : 'text-red-400'}`}>
                  {dispatchMsg}
                </p>
              )}

              <div className="flex gap-3 pt-2 border-t border-white/5">
                {detailEditing ? (
                  <>
                    <button
                      onClick={() => { setDetailEditing(false); setDetailNewBeschrijving(detailItem.beschrijving ?? '') }}
                      className="flex-1 border border-white/10 text-white/60 hover:text-white text-xs font-medium py-2.5 rounded-lg transition-colors"
                    >
                      Annuleer
                    </button>
                    <button
                      onClick={rerunTask}
                      disabled={rerunning || !detailNewBeschrijving.trim()}
                      className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-medium py-2.5 rounded-lg transition-colors"
                    >
                      <Play size={13} /> {rerunning ? 'Opnieuw uitvoeren…' : 'Opnieuw uitvoeren'}
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={closeDetail}
                      className="bg-green-600/20 border border-green-500/30 hover:bg-green-600/30 text-green-300 text-xs font-medium px-4 py-2.5 rounded-lg transition-colors"
                    >
                      Klaar
                    </button>
                    {!detailItem.orchestrator_task_id && detailItem.status !== 'gereed' && (
                      <button
                        onClick={() => dispatchTask()}
                        disabled={dispatching}
                        className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-medium py-2.5 rounded-lg transition-colors"
                      >
                        <Play size={13} /> {dispatching ? 'Uitvoeren…' : 'Voer uit met AI'}
                      </button>
                    )}
                    <button
                      onClick={() => setDetailEditing(true)}
                      className="flex items-center justify-center gap-2 bg-white/[0.06] border border-white/10 hover:bg-white/10 text-white/80 text-xs font-medium px-4 py-2.5 rounded-lg transition-colors"
                    >
                      <Edit2 size={13} /> Bewerken
                    </button>
                    <button
                      onClick={openChainBuilder}
                      className="flex items-center justify-center gap-2 bg-indigo-500/20 border border-indigo-500/30 hover:bg-indigo-500/30 text-indigo-300 text-xs font-medium px-4 py-2.5 rounded-lg transition-colors"
                    >
                      <GitFork size={13} /> Chain
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {showChainBuilder && detailItem && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#0f1117] border border-white/10 rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-white/5">
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <GitFork size={14} className="text-indigo-400" /> Agent chain bouwen
              </h2>
              <button onClick={() => setShowChainBuilder(false)}>
                <X size={16} className="text-white/50 hover:text-white" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-[11px] text-white/55">
                Selecteer personas op volgorde. Elke persona pakt de taak op nadat de vorige
                hem heeft afgerond. De eerste persona wordt &apos;toegewezen&apos; op het planning_item.
              </p>

              {chainSelection.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1.5">Geselecteerde chain</p>
                  {chainSelection.map((name, idx) => (
                    <div key={`${name}-${idx}`}>
                      <div className="flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/30 rounded-lg px-3 py-2">
                        <span className="text-[10px] text-indigo-300 font-mono w-5">#{idx + 1}</span>
                        <span className="text-xs text-white/90 flex-1">{name}</span>
                        <button
                          onClick={() => setChainSelection((cs) => cs.filter((_, i) => i !== idx))}
                          className="text-[11px] text-white/40 hover:text-red-400"
                        >
                          ✕
                        </button>
                      </div>
                      {idx < chainSelection.length - 1 && (
                        <div className="flex justify-center py-0.5">
                          <ArrowDown size={12} className="text-white/30" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div>
                <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1.5">Voeg toe</p>
                <div className="grid grid-cols-2 gap-1.5 max-h-72 overflow-y-auto">
                  {chainPersonas.map((p) => (
                    <button
                      key={p.name}
                      onClick={() => setChainSelection((cs) => [...cs, p.name])}
                      className="text-left bg-white/[0.04] border border-white/5 hover:bg-white/[0.08] rounded-lg px-2.5 py-1.5"
                    >
                      <p className="text-xs text-white/85">{p.name}</p>
                      <p className="text-[10px] text-white/45">{p.role}</p>
                    </button>
                  ))}
                </div>
              </div>

              {chainError && <p className="text-xs text-red-400">{chainError}</p>}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowChainBuilder(false)}
                  className="flex-1 border border-white/10 text-white/60 hover:text-white text-xs font-medium py-2.5 rounded-lg transition-colors"
                >
                  Annuleer
                </button>
                <button
                  onClick={saveChain}
                  disabled={chainSaving || chainSelection.length === 0}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-medium py-2.5 rounded-lg transition-colors"
                >
                  {chainSaving ? 'Starten…' : `Start chain (${chainSelection.length})`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#0f1117] border border-white/10 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-white/5">
              <h2 className="text-sm font-semibold text-white">{editing ? 'Taak bewerken' : 'Nieuwe taak'}</h2>
              <button onClick={() => setShowModal(false)}><X size={16} className="text-white/50 hover:text-white" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-[11px] text-white/50 mb-1.5">Titel *</label>
                <input
                  className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-indigo-500"
                  placeholder="Taaktitel…"
                  value={form.titel}
                  onChange={e => setForm(f => ({ ...f, titel: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-white/50 mb-1.5">Prioriteit</label>
                  <select
                    className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                    value={form.priority}
                    onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
                  >
                    {['laag','normaal','hoog','urgent'].map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase()+p.slice(1)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] text-white/50 mb-1.5">Status</label>
                  <select
                    className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                    value={form.status}
                    onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                  >
                    {['open','bezig','gereed','geblokkeerd'].map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-white/50 mb-1.5">Deadline</label>
                  <input
                    type="date"
                    className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                    value={form.due_date}
                    onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-white/50 mb-1.5">Toegewezen aan</label>
                  <input
                    className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-indigo-500"
                    placeholder="Naam…"
                    value={form.toegewezen}
                    onChange={e => setForm(f => ({ ...f, toegewezen: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-[11px] text-white/50">Project</label>
                  <button
                    type="button"
                    onClick={() => { setShowNewProject(s => !s); setProjectError('') }}
                    className="text-[11px] text-indigo-400 hover:text-indigo-300 transition-colors"
                  >
                    {showNewProject ? 'Annuleer nieuw project' : '+ Nieuw project'}
                  </button>
                </div>
                {showNewProject ? (
                  <div className="space-y-2 bg-white/[0.04] border border-white/10 rounded-lg p-3">
                    <input
                      autoFocus
                      className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-indigo-500"
                      placeholder="Projectnaam…"
                      value={newProjectName}
                      onChange={e => setNewProjectName(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') createProject() }}
                    />
                    <select
                      className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                      value={newProjectType}
                      onChange={e => setNewProjectType(e.target.value)}
                    >
                      {PROJECT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                    {projectError && <p className="text-[11px] text-red-400">{projectError}</p>}
                    <button
                      type="button"
                      onClick={createProject}
                      disabled={creatingProject || !newProjectName.trim()}
                      className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-medium py-2 rounded-lg transition-colors"
                    >
                      {creatingProject ? 'Aanmaken…' : 'Project aanmaken'}
                    </button>
                  </div>
                ) : (
                  <select
                    className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                    value={form.project_id}
                    onChange={e => setForm(f => ({ ...f, project_id: e.target.value }))}
                  >
                    <option value="">Geen project</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                )}
              </div>
              <div>
                <label className="block text-[11px] text-white/50 mb-1.5">Beschrijving</label>
                <textarea
                  rows={3}
                  className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-indigo-500 resize-none"
                  placeholder="Omschrijving van de taak…"
                  value={form.beschrijving}
                  onChange={e => setForm(f => ({ ...f, beschrijving: e.target.value }))}
                />
              </div>
              {error && <p className="text-xs text-red-400">{error}</p>}
              <div className="flex gap-3 pt-1">
                <button onClick={() => setShowModal(false)} className="flex-1 border border-white/10 text-white/60 hover:text-white text-xs font-medium py-2.5 rounded-lg transition-colors">Annuleren</button>
                <button onClick={save} disabled={saving} className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-medium py-2.5 rounded-lg transition-colors">
                  {saving ? 'Opslaan…' : editing ? 'Opslaan' : 'Aanmaken'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
