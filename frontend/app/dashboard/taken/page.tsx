'use client'

import { useState, useEffect, useCallback } from 'react'
import { CheckSquare, Plus, X, AlertTriangle, GitBranch, RefreshCw } from 'lucide-react'
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
}

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

const EMPTY_FORM = { titel: '', type: 'taak', priority: 'normaal', status: 'open', toegewezen: '', due_date: '', beschrijving: '', project_id: '' }

export default function TakenPage() {
  const [items, setItems] = useState<PlanningItem[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [activeTab, setActiveTab] = useState('Alle')
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<PlanningItem | null>(null)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')
  const [syncing, setSyncing]     = useState(false)
  const [syncMsg, setSyncMsg]     = useState('')

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
    setForm({ ...EMPTY_FORM })
    setError('')
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

  const tabs = ['Alle', 'Urgent', 'Vandaag', 'Deze week', 'Afgerond']

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
        ].map((s) => (
          <div key={s.label} className="bg-white/[0.06] border border-white/5 rounded-xl p-4">
            <p className="text-[11px] text-white/50 mb-1">{s.label}</p>
            <p className={`text-2xl font-semibold ${s.color}`}>{loading ? '…' : s.value}</p>
          </div>
        ))}
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
                    className={clsx(
                      'border-b border-white/5 hover:bg-white/[0.02] transition-colors',
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
                    <td className="px-4 py-3">
                      <span className={clsx('px-2 py-0.5 rounded-full text-[10px] font-medium', STATUS_COLORS[row.status])}>
                        {STATUS_LABELS[row.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
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
                <label className="block text-[11px] text-white/50 mb-1.5">Project</label>
                <select
                  className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  value={form.project_id}
                  onChange={e => setForm(f => ({ ...f, project_id: e.target.value }))}
                >
                  <option value="">Geen project</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
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
