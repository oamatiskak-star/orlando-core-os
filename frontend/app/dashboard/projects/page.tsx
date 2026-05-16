'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  FolderKanban, Plus, X, RefreshCw, Pencil, Trash2,
  Calendar, Building2, Banknote, MapPin, CheckCircle2, Clock, AlertCircle,
} from 'lucide-react'
import clsx from 'clsx'

interface Company { id: string; name: string }
interface Project {
  id: string
  name: string
  type: string
  status: string
  company_id: string | null
  company: Company | null
  budget: number | null
  spent: number
  location: string | null
  address: string | null
  start_date: string | null
  end_date: string | null
  notes: string | null
  created_at: string
}

const PROJECT_TYPES  = ['software', 'bouw', 'vastgoed', 'renovatie', 'automatisering', 'overig']
const PROJECT_STATUS = ['planning', 'actief', 'pauze', 'afgerond', 'geannuleerd']

const statusMeta: Record<string, { label: string; cls: string; icon: typeof CheckCircle2 }> = {
  planning:    { label: 'Planning',    cls: 'bg-white/[0.08] text-white/65',    icon: Clock },
  actief:      { label: 'Actief',      cls: 'bg-emerald-500/15 text-emerald-400', icon: CheckCircle2 },
  pauze:       { label: 'Pauze',       cls: 'bg-amber-500/15 text-amber-400',   icon: AlertCircle },
  afgerond:    { label: 'Afgerond',    cls: 'bg-sky-500/15 text-sky-400',        icon: CheckCircle2 },
  geannuleerd: { label: 'Geannuleerd', cls: 'bg-red-500/15 text-red-400',        icon: X },
}

function fmtEur(n: number | null) {
  if (n == null) return '—'
  if (n >= 1_000_000) return `€${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `€${(n / 1_000).toFixed(0)}k`
  return `€${n}`
}

function fmtDate(s: string | null) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })
}

function progress(p: Project) {
  if (!p.budget || p.budget === 0) return null
  return Math.min(Math.round((p.spent / p.budget) * 100), 100)
}

const EMPTY: Partial<Project> = { name: '', type: 'software', status: 'planning', budget: undefined, location: '', notes: '' }

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading]    = useState(true)
  const [statusFilter, setStatusFilter] = useState('')

  const [modal, setModal]    = useState<'add' | 'edit' | null>(null)
  const [form, setForm]      = useState<Partial<Project>>(EMPTY)
  const [saving, setSaving]  = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [formError, setFormError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const sp = new URLSearchParams()
      if (statusFilter) sp.set('status', statusFilter)
      const [pr, cr] = await Promise.all([
        fetch(`/api/projects?${sp}`, { cache: 'no-store' }),
        fetch('/api/companies', { cache: 'no-store' }),
      ])
      if (pr.ok) { const d = await pr.json(); setProjects(d.projects ?? []) }
      if (cr.ok) { const d = await cr.json(); setCompanies(d.companies ?? []) }
    } finally { setLoading(false) }
  }, [statusFilter])

  useEffect(() => { load() }, [load])

  function openAdd()        { setForm(EMPTY); setFormError(''); setModal('add') }
  function openEdit(p: Project) { setForm({ ...p }); setFormError(''); setModal('edit') }

  async function saveProject() {
    setSaving(true); setFormError('')
    try {
      const isEdit = modal === 'edit' && form.id
      const r = await fetch(isEdit ? `/api/projects/${form.id}` : '/api/projects', {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!r.ok) { const d = await r.json(); setFormError(d.error ?? 'Opslaan mislukt'); return }
      setModal(null); load()
    } finally { setSaving(false) }
  }

  async function deleteProject(id: string) {
    setDeleting(id)
    try { await fetch(`/api/projects/${id}`, { method: 'DELETE' }); load() }
    finally { setDeleting(null) }
  }

  const actief   = projects.filter(p => p.status === 'actief').length
  const afgerond = projects.filter(p => p.status === 'afgerond').length
  const totBudget = projects.reduce((s, p) => s + (p.budget ?? 0), 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center">
            <FolderKanban size={16} className="text-sky-400" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-white">Projecten</h1>
            <p className="text-xs text-white/50">Alle lopende en geplande projecten over alle BV&apos;s.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="p-2 rounded-lg bg-white/[0.06] border border-white/8 text-white/50 hover:text-white transition-colors">
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>
          <button onClick={openAdd} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium px-4 py-2 rounded-lg transition-colors">
            <Plus size={13} />
            Nieuw project
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Totaal',     value: projects.length, color: 'text-white' },
          { label: 'Actief',     value: actief,          color: 'text-emerald-400' },
          { label: 'Afgerond',   value: afgerond,        color: 'text-sky-400' },
          { label: 'Totaal budget', value: fmtEur(totBudget || null), color: 'text-amber-400' },
        ].map(s => (
          <div key={s.label} className="bg-white/[0.06] border border-white/5 rounded-xl p-4">
            <p className="text-[11px] text-white/50 mb-1">{s.label}</p>
            <p className={clsx('text-xl font-semibold', s.color)}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Status filter */}
      <div className="flex items-center gap-1 p-1 bg-white/[0.06] border border-white/5 rounded-xl w-fit flex-wrap">
        {[{ v: '', l: 'Alle' }, ...PROJECT_STATUS.map(s => ({ v: s, l: statusMeta[s]?.label ?? s }))].map(({ v, l }) => (
          <button key={v} onClick={() => setStatusFilter(v)}
            className={clsx('px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
              statusFilter === v ? 'bg-indigo-600 text-white' : 'text-white/65 hover:text-white/70')}>
            {l}
          </button>
        ))}
      </div>

      {/* Project cards */}
      {loading && projects.length === 0 ? (
        <p className="text-xs text-white/38 text-center py-16">Laden…</p>
      ) : projects.length === 0 ? (
        <div className="bg-white/[0.06] border border-white/5 rounded-xl p-16 flex flex-col items-center gap-3">
          <FolderKanban size={28} className="text-white/38" />
          <p className="text-sm text-white/50">Geen projecten gevonden</p>
          <button onClick={openAdd} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium px-4 py-2 rounded-lg transition-colors mt-1">
            <Plus size={12} />Nieuw project
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {projects.map(p => {
            const pct  = progress(p)
            const meta = statusMeta[p.status] ?? statusMeta.planning
            const Icon = meta.icon
            return (
              <div key={p.id} className="bg-white/[0.06] border border-white/5 rounded-xl p-5 flex flex-col gap-4 group">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{p.name}</p>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      {p.company && (
                        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-indigo-500/15 text-indigo-400">
                          <Building2 size={9} />{p.company.name.replace(' BV', '').replace(' Financial Management', '')}
                        </span>
                      )}
                      <span className={clsx('flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium', meta.cls)}>
                        <Icon size={9} />{meta.label}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] bg-white/[0.06] text-white/50">{p.type}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <button onClick={() => openEdit(p)} className="p-1.5 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-colors"><Pencil size={12} /></button>
                    <button onClick={() => deleteProject(p.id)} disabled={deleting === p.id} className="p-1.5 rounded-lg hover:bg-red-500/15 text-white/50 hover:text-red-400 transition-colors"><Trash2 size={12} /></button>
                  </div>
                </div>

                {/* Budget progress */}
                {p.budget != null && (
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[11px] text-white/50 flex items-center gap-1"><Banknote size={10} />Budget</span>
                      <span className="text-[11px] text-white/65 font-medium">{fmtEur(p.spent)} / {fmtEur(p.budget)}</span>
                    </div>
                    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div className={clsx('h-full rounded-full transition-all', (pct ?? 0) > 90 ? 'bg-red-500' : (pct ?? 0) > 70 ? 'bg-amber-500' : 'bg-indigo-500')}
                        style={{ width: `${pct ?? 0}%` }} />
                    </div>
                    {pct != null && <p className="text-[10px] text-white/38 mt-1 text-right">{pct}%</p>}
                  </div>
                )}

                {/* Meta */}
                <div className="flex items-center gap-4 text-[11px] text-white/38">
                  {p.location && <span className="flex items-center gap-1"><MapPin size={10} />{p.location}</span>}
                  {(p.start_date || p.end_date) && (
                    <span className="flex items-center gap-1"><Calendar size={10} />{fmtDate(p.start_date)} – {fmtDate(p.end_date)}</span>
                  )}
                </div>

                {p.notes && <p className="text-[11px] text-white/38 leading-relaxed line-clamp-2">{p.notes}</p>}
              </div>
            )
          })}
        </div>
      )}

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/8 sticky top-0 bg-[#111]">
              <h2 className="text-sm font-semibold text-white">{modal === 'edit' ? 'Project bewerken' : 'Nieuw project'}</h2>
              <button onClick={() => setModal(null)} className="text-white/38 hover:text-white transition-colors"><X size={16} /></button>
            </div>
            <div className="p-6 space-y-4">
              {formError && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{formError}</p>}

              <div>
                <label className="block text-[11px] text-white/50 mb-1.5">Naam *</label>
                <input type="text" placeholder="Naam van het project" value={form.name ?? ''}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full bg-white/[0.06] border border-white/8 rounded-lg px-3 py-2 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-indigo-500/60" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-white/50 mb-1.5">Type *</label>
                  <select value={form.type ?? 'software'} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                    className="w-full bg-white/[0.06] border border-white/8 rounded-lg px-3 py-2 text-xs text-white/80 focus:outline-none focus:border-indigo-500/60">
                    {PROJECT_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] text-white/50 mb-1.5">Status</label>
                  <select value={form.status ?? 'planning'} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                    className="w-full bg-white/[0.06] border border-white/8 rounded-lg px-3 py-2 text-xs text-white/80 focus:outline-none focus:border-indigo-500/60">
                    {PROJECT_STATUS.map(s => <option key={s} value={s}>{statusMeta[s]?.label ?? s}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] text-white/50 mb-1.5">BV</label>
                <select value={form.company_id ?? ''} onChange={e => setForm(f => ({ ...f, company_id: e.target.value || null }))}
                  className="w-full bg-white/[0.06] border border-white/8 rounded-lg px-3 py-2 text-xs text-white/80 focus:outline-none focus:border-indigo-500/60">
                  <option value="">— Geen BV —</option>
                  {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-white/50 mb-1.5">Budget (€)</label>
                  <input type="number" placeholder="0" value={form.budget ?? ''}
                    onChange={e => setForm(f => ({ ...f, budget: e.target.value ? Number(e.target.value) : undefined }))}
                    className="w-full bg-white/[0.06] border border-white/8 rounded-lg px-3 py-2 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-indigo-500/60" />
                </div>
                <div>
                  <label className="block text-[11px] text-white/50 mb-1.5">Besteed (€)</label>
                  <input type="number" placeholder="0" value={(form as Project).spent ?? 0}
                    onChange={e => setForm(f => ({ ...f, spent: Number(e.target.value) }))}
                    className="w-full bg-white/[0.06] border border-white/8 rounded-lg px-3 py-2 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-indigo-500/60" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-white/50 mb-1.5">Startdatum</label>
                  <input type="date" value={form.start_date ?? ''}
                    onChange={e => setForm(f => ({ ...f, start_date: e.target.value || null }))}
                    className="w-full bg-white/[0.06] border border-white/8 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500/60" />
                </div>
                <div>
                  <label className="block text-[11px] text-white/50 mb-1.5">Einddatum</label>
                  <input type="date" value={form.end_date ?? ''}
                    onChange={e => setForm(f => ({ ...f, end_date: e.target.value || null }))}
                    className="w-full bg-white/[0.06] border border-white/8 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500/60" />
                </div>
              </div>

              <div>
                <label className="block text-[11px] text-white/50 mb-1.5">Locatie</label>
                <input type="text" placeholder="Amsterdam" value={form.location ?? ''}
                  onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                  className="w-full bg-white/[0.06] border border-white/8 rounded-lg px-3 py-2 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-indigo-500/60" />
              </div>

              <div>
                <label className="block text-[11px] text-white/50 mb-1.5">Notities</label>
                <textarea rows={3} placeholder="Beschrijving of opmerkingen…" value={form.notes ?? ''}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  className="w-full bg-white/[0.06] border border-white/8 rounded-lg px-3 py-2 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-indigo-500/60 resize-none" />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/8 sticky bottom-0 bg-[#111]">
              <button onClick={() => setModal(null)} className="px-4 py-2 rounded-lg border border-white/10 text-white/65 hover:text-white text-xs transition-colors">Annuleren</button>
              <button onClick={saveProject} disabled={saving || !form.name || !form.type}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-medium transition-colors">
                {saving ? <RefreshCw size={12} className="animate-spin" /> : <FolderKanban size={12} />}
                {modal === 'edit' ? 'Opslaan' : 'Aanmaken'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
