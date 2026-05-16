'use client'

import { useCallback, useEffect, useState } from 'react'
import { ClipboardList, Plus, Pencil, Trash2, CheckCircle2, Clock, AlertTriangle, Circle, ChevronRight } from 'lucide-react'
import clsx from 'clsx'

type PlanningItem = {
  id: string
  type: string
  status: string
  priority: string
  titel: string
  beschrijving: string | null
  toegewezen: string | null
  start_date: string | null
  due_date: string | null
  completed_at: string | null
  project: { id: string; name: string } | null
  notes: string | null
  created_at: string
}

type Project = { id: string; name: string }

const STATUS_ICONS: Record<string, React.ReactNode> = {
  open:       <Circle size={14} className="text-white/30" />,
  bezig:      <ChevronRight size={14} className="text-sky-400" />,
  gereed:     <CheckCircle2 size={14} className="text-emerald-400" />,
  geblokkeerd:<AlertTriangle size={14} className="text-red-400" />,
}

const PRIO_COLORS: Record<string, string> = {
  laag:    'text-white/30   bg-white/5        border-white/10',
  normaal: 'text-sky-400    bg-sky-500/10     border-sky-500/20',
  hoog:    'text-amber-400  bg-amber-500/10   border-amber-500/20',
  urgent:  'text-red-400    bg-red-500/10     border-red-500/20',
}

const TYPE_COLORS: Record<string, string> = {
  taak:      'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
  mijlpaal:  'text-violet-400 bg-violet-500/10 border-violet-500/20',
  fase:      'text-amber-400  bg-amber-500/10  border-amber-500/20',
}

const EMPTY: Partial<PlanningItem> = {
  titel: '', type: 'taak', priority: 'normaal', beschrijving: '',
  toegewezen: '', start_date: '', due_date: '', notes: '',
}

export default function PlanningPage() {
  const [items, setItems]       = useState<PlanningItem[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [total, setTotal]       = useState(0)
  const [statusFilter, setStatusFilter] = useState('')
  const [projFilter, setProjFilter]     = useState('')
  const [modal, setModal]       = useState<Partial<PlanningItem> | null>(null)
  const [saving, setSaving]     = useState(false)
  const [loading, setLoading]   = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const sp = new URLSearchParams()
    if (statusFilter) sp.set('status', statusFilter)
    if (projFilter)   sp.set('project_id', projFilter)
    const [ir, pr] = await Promise.all([
      fetch(`/api/planning${sp.toString() ? `?${sp}` : ''}`, { cache: 'no-store' }),
      fetch('/api/projects', { cache: 'no-store' }),
    ])
    if (ir.ok) { const d = await ir.json(); setItems(d.items ?? []); setTotal(d.total ?? 0) }
    if (pr.ok) { const d = await pr.json(); setProjects(d.projects ?? []) }
    setLoading(false)
  }, [statusFilter, projFilter])

  useEffect(() => { load() }, [load])

  const save = async () => {
    if (!modal) return
    setSaving(true)
    const isNew  = !modal.id
    const url    = isNew ? '/api/planning' : `/api/planning/${modal.id}`
    const method = isNew ? 'POST' : 'PATCH'
    const body: Record<string, unknown> = {
      titel:       modal.titel,
      type:        modal.type ?? 'taak',
      priority:    modal.priority ?? 'normaal',
      beschrijving:modal.beschrijving || null,
      toegewezen:  modal.toegewezen || null,
      start_date:  modal.start_date || null,
      due_date:    modal.due_date || null,
      notes:       modal.notes || null,
    }
    if (!isNew) body.status = modal.status
    const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    if (r.ok) { setModal(null); load() }
    setSaving(false)
  }

  const del = async (id: string) => {
    if (!confirm('Item verwijderen?')) return
    await fetch(`/api/planning/${id}`, { method: 'DELETE' })
    load()
  }

  const toggleStatus = async (item: PlanningItem) => {
    const next = item.status === 'gereed' ? 'open' : item.status === 'open' ? 'bezig' : 'gereed'
    await fetch(`/api/planning/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: next }),
    })
    load()
  }

  const isOverdue = (item: PlanningItem) =>
    item.due_date && item.status !== 'gereed' && new Date(item.due_date) < new Date()

  const counts = {
    open:   items.filter(i => i.status === 'open').length,
    bezig:  items.filter(i => i.status === 'bezig').length,
    gereed: items.filter(i => i.status === 'gereed').length,
    overdue:items.filter(isOverdue).length,
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-white">Planning</h1>
          <p className="text-sm text-white/65 mt-0.5">Projectplanning, mijlpalen en taakoverzicht</p>
        </div>
        <button onClick={() => setModal({ ...EMPTY })}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-500/15 border border-indigo-500/20 text-indigo-400 hover:bg-indigo-500/25 transition-colors text-sm">
          <Plus size={14} /> Nieuw item
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Open',    value: counts.open,   color: 'text-white/50  bg-white/5       border-white/10',          icon: Circle },
          { label: 'Bezig',   value: counts.bezig,  color: 'text-sky-400   bg-sky-500/10    border-sky-500/20',        icon: Clock },
          { label: 'Gereed',  value: counts.gereed, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', icon: CheckCircle2 },
          { label: 'Te laat', value: counts.overdue,color: counts.overdue > 0 ? 'text-red-400 bg-red-500/10 border-red-500/20' : 'text-white/30 bg-white/5 border-white/10', icon: AlertTriangle },
        ].map(({ label, value, color, icon: Icon }) => (
          <div key={label} className="bg-white/[0.06] border border-white/5 rounded-xl p-4 flex items-center gap-3">
            <div className={clsx('w-8 h-8 rounded-lg flex items-center justify-center border', color)}>
              <Icon size={14} />
            </div>
            <div>
              <p className="text-lg font-bold text-white">{value}</p>
              <p className="text-xs text-white/50">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap items-center">
        <div className="flex gap-1">
          {[
            { v: '',           l: 'Alle statussen' },
            { v: 'open',       l: 'Open' },
            { v: 'bezig',      l: 'Bezig' },
            { v: 'gereed',     l: 'Gereed' },
            { v: 'geblokkeerd',l: 'Geblokkeerd' },
          ].map(({ v, l }) => (
            <button key={v} onClick={() => setStatusFilter(v)}
              className={clsx('px-3 py-1 rounded-lg text-xs transition-colors border',
                statusFilter === v ? 'bg-indigo-500/20 border-indigo-500/30 text-indigo-300' : 'bg-white/5 border-white/10 text-white/50 hover:text-white/80'
              )}>{l}</button>
          ))}
        </div>
        {projects.length > 0 && (
          <select value={projFilter} onChange={e => setProjFilter(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500/50">
            <option value="">Alle projecten</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        )}
      </div>

      {/* Items */}
      {loading ? (
        <div className="text-center py-12 text-white/30 text-sm">Laden...</div>
      ) : items.length === 0 ? (
        <div className="bg-white/[0.04] border border-white/8 rounded-xl p-10 flex flex-col items-center gap-3">
          <ClipboardList size={32} className="text-white/20" />
          <p className="text-sm text-white/40">Geen planningsitems</p>
          <button onClick={() => setModal({ ...EMPTY })} className="text-xs text-indigo-400 hover:text-indigo-300">Eerste item toevoegen</button>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map(item => (
            <div key={item.id} className={clsx('group bg-white/[0.06] border rounded-xl px-4 py-3 hover:border-white/15 transition-colors',
              isOverdue(item) ? 'border-red-500/25' : item.status === 'gereed' ? 'border-white/5 opacity-60' : 'border-white/5')}>
              <div className="flex items-start gap-3">
                <button onClick={() => toggleStatus(item)} className="mt-0.5 shrink-0 hover:scale-110 transition-transform">
                  {STATUS_ICONS[item.status] ?? STATUS_ICONS.open}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={clsx('px-2 py-0.5 rounded-full text-[11px] border', TYPE_COLORS[item.type] ?? TYPE_COLORS.taak)}>
                      {item.type}
                    </span>
                    <span className={clsx('px-2 py-0.5 rounded-full text-[11px] border', PRIO_COLORS[item.priority] ?? PRIO_COLORS.normaal)}>
                      {item.priority}
                    </span>
                    {item.project && (
                      <span className="text-xs text-white/35">{item.project.name}</span>
                    )}
                  </div>
                  <p className={clsx('text-sm font-medium mt-1', item.status === 'gereed' ? 'line-through text-white/40' : 'text-white')}>
                    {item.titel}
                  </p>
                  {item.beschrijving && (
                    <p className="text-xs text-white/50 mt-0.5 line-clamp-1">{item.beschrijving}</p>
                  )}
                  <div className="flex items-center gap-4 mt-1.5 flex-wrap">
                    {item.toegewezen && (
                      <span className="text-xs text-white/40">👤 {item.toegewezen}</span>
                    )}
                    {item.due_date && (
                      <span className={clsx('text-xs', isOverdue(item) ? 'text-red-400 font-medium' : 'text-white/40')}>
                        {isOverdue(item) ? '⚠ ' : ''}
                        {new Date(item.due_date).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <button onClick={() => setModal(item)} className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-colors">
                    <Pencil size={12} />
                  </button>
                  <button onClick={() => del(item.id)} className="p-1.5 rounded-lg hover:bg-red-500/15 text-white/40 hover:text-red-400 transition-colors">
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto flex flex-col">
            <div className="sticky top-0 bg-[#111] border-b border-white/8 px-5 py-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-white">{modal.id ? 'Item bewerken' : 'Nieuw item'}</h2>
              <button onClick={() => setModal(null)} className="text-white/40 hover:text-white text-xl leading-none">×</button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs text-white/50 mb-1 block">Titel *</label>
                <input type="text" value={modal.titel ?? ''} onChange={e => setModal(m => ({ ...m, titel: e.target.value }))}
                  placeholder="Taak omschrijving"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/25 focus:outline-none focus:border-indigo-500/50" />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-white/50 mb-1 block">Type</label>
                  <select value={modal.type ?? 'taak'} onChange={e => setModal(m => ({ ...m, type: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/50">
                    <option value="taak">Taak</option>
                    <option value="mijlpaal">Mijlpaal</option>
                    <option value="fase">Fase</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-white/50 mb-1 block">Prioriteit</label>
                  <select value={modal.priority ?? 'normaal'} onChange={e => setModal(m => ({ ...m, priority: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/50">
                    <option value="laag">Laag</option>
                    <option value="normaal">Normaal</option>
                    <option value="hoog">Hoog</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
                {modal.id && (
                  <div>
                    <label className="text-xs text-white/50 mb-1 block">Status</label>
                    <select value={modal.status ?? 'open'} onChange={e => setModal(m => ({ ...m, status: e.target.value }))}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/50">
                      <option value="open">Open</option>
                      <option value="bezig">Bezig</option>
                      <option value="gereed">Gereed</option>
                      <option value="geblokkeerd">Geblokkeerd</option>
                    </select>
                  </div>
                )}
              </div>

              <div>
                <label className="text-xs text-white/50 mb-1 block">Project</label>
                <select value={(modal as { project_id?: string }).project_id ?? ''} onChange={e => setModal(m => ({ ...m, project_id: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/50">
                  <option value="">— Geen —</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>

              <div>
                <label className="text-xs text-white/50 mb-1 block">Beschrijving</label>
                <textarea rows={2} value={modal.beschrijving ?? ''} onChange={e => setModal(m => ({ ...m, beschrijving: e.target.value }))}
                  placeholder="Omschrijving van de taak..."
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/25 focus:outline-none focus:border-indigo-500/50 resize-none" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-white/50 mb-1 block">Startdatum</label>
                  <input type="date" value={modal.start_date ?? ''} onChange={e => setModal(m => ({ ...m, start_date: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/50" />
                </div>
                <div>
                  <label className="text-xs text-white/50 mb-1 block">Deadline</label>
                  <input type="date" value={modal.due_date ?? ''} onChange={e => setModal(m => ({ ...m, due_date: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/50" />
                </div>
              </div>

              <div>
                <label className="text-xs text-white/50 mb-1 block">Toegewezen aan</label>
                <input type="text" value={modal.toegewezen ?? ''} onChange={e => setModal(m => ({ ...m, toegewezen: e.target.value }))}
                  placeholder="Naam medewerker"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/25 focus:outline-none focus:border-indigo-500/50" />
              </div>
            </div>

            <div className="sticky bottom-0 bg-[#111] border-t border-white/8 px-5 py-4 flex justify-end gap-3">
              <button onClick={() => setModal(null)} className="px-4 py-2 rounded-lg text-sm text-white/50 hover:text-white hover:bg-white/5 transition-colors">Annuleren</button>
              <button onClick={save} disabled={saving || !modal.titel}
                className="px-4 py-2 rounded-lg text-sm bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/30 transition-colors disabled:opacity-50">
                {saving ? 'Opslaan...' : 'Opslaan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
