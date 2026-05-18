'use client'

import { useState, useEffect, useCallback } from 'react'
import { Files, Folder, FileText, Plus, X, Trash2, ExternalLink } from 'lucide-react'
import clsx from 'clsx'

type Document = {
  id: string
  naam: string
  map: string
  bestandstype: string | null
  bestandsgrootte: string | null
  url: string | null
  notes: string | null
  created_at: string
  company: { id: string; name: string } | null
  project:  { id: string; name: string } | null
}

type Company = { id: string; name: string }
type Project = { id: string; name: string }

const EXT_ICONS: Record<string, string> = {
  pdf:  'text-red-400',
  docx: 'text-blue-400',
  doc:  'text-blue-400',
  xlsx: 'text-green-400',
  xls:  'text-green-400',
  dwg:  'text-amber-400',
  png:  'text-purple-400',
  jpg:  'text-purple-400',
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('nl-NL', { day: '2-digit', month: 'short', year: 'numeric' })
}

function extColor(naam: string) {
  const ext = naam.split('.').pop()?.toLowerCase() ?? ''
  return EXT_ICONS[ext] ?? 'text-white/50'
}

const MAPPEN = ['MODIWÉ', 'STRKBEHEER', 'STRKBOUW', 'Gedeeld', 'Projecten']
const EMPTY_FORM = { naam: '', map: 'Gedeeld', bestandstype: '', bestandsgrootte: '', url: '', notes: '', company_id: '', project_id: '' }

export default function DocumentenPage() {
  const [items, setItems]       = useState<Document[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [projects, setProjects]   = useState<Project[]>([])
  const [activeMap, setActiveMap] = useState('Alle')
  const [loading, setLoading]     = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing]     = useState<Document | null>(null)
  const [form, setForm]           = useState({ ...EMPTY_FORM })
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/documenten')
      if (res.ok) { const j = await res.json(); setItems(j.documents ?? []) }
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    fetch('/api/companies').then(r => r.ok ? r.json() : { companies: [] }).then(j => setCompanies(j.companies ?? []))
    fetch('/api/projects').then(r => r.ok ? r.json() : { projects: [] }).then(j => setProjects(j.projects ?? []))
  }, [])

  const filtered = activeMap === 'Alle' ? items : items.filter(d => d.map === activeMap)

  const mapCounts = MAPPEN.reduce<Record<string, number>>((acc, m) => {
    acc[m] = items.filter(d => d.map === m).length
    return acc
  }, {})

  function openNew() {
    setEditing(null)
    setForm({ ...EMPTY_FORM })
    setError('')
    setShowModal(true)
  }

  function openEdit(doc: Document) {
    setEditing(doc)
    setForm({
      naam:           doc.naam,
      map:            doc.map,
      bestandstype:   doc.bestandstype ?? '',
      bestandsgrootte:doc.bestandsgrootte ?? '',
      url:            doc.url ?? '',
      notes:          doc.notes ?? '',
      company_id:     doc.company?.id ?? '',
      project_id:     doc.project?.id ?? '',
    })
    setError('')
    setShowModal(true)
  }

  async function save() {
    if (!form.naam.trim()) { setError('Bestandsnaam is verplicht'); return }
    setSaving(true); setError('')
    try {
      const body = {
        naam:           form.naam.trim(),
        map:            form.map,
        bestandstype:   form.bestandstype || null,
        bestandsgrootte:form.bestandsgrootte || null,
        url:            form.url || null,
        notes:          form.notes || null,
        company_id:     form.company_id || null,
        project_id:     form.project_id || null,
      }
      let res: Response
      if (editing) {
        res = await fetch(`/api/documenten/${editing.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      } else {
        res = await fetch('/api/documenten', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      }
      if (!res.ok) { const j = await res.json(); setError(j.error ?? 'Fout'); return }
      setShowModal(false)
      await load()
    } finally { setSaving(false) }
  }

  async function del(id: string) {
    if (!confirm('Document verwijderen?')) return
    await fetch(`/api/documenten/${id}`, { method: 'DELETE' })
    await load()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-slate-500/10 border border-slate-500/20 flex items-center justify-center">
            <Files size={16} className="text-slate-400" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-white">Documenten</h1>
            <p className="text-xs text-white/50">Centrale documentopslag — PDF&apos;s, tekeningen en rapporten.</p>
          </div>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <Plus size={13} /> Toevoegen
        </button>
      </div>

      {/* Folder grid */}
      <div>
        <h2 className="text-sm font-semibold text-white mb-3">Mappen</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <button
            onClick={() => setActiveMap('Alle')}
            className={clsx(
              'bg-white/[0.06] border rounded-xl p-4 flex flex-col gap-3 text-left transition-colors group',
              activeMap === 'Alle' ? 'border-indigo-500/40 bg-indigo-500/5' : 'border-white/5 hover:bg-white/[0.09] hover:border-white/10'
            )}
          >
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 flex items-center justify-center">
              <Files size={16} className="text-indigo-400" />
            </div>
            <div>
              <p className="text-xs font-medium text-white">Alle bestanden</p>
              <p className="text-[11px] text-white/50">{items.length} bestand{items.length !== 1 ? 'en' : ''}</p>
            </div>
          </button>
          {MAPPEN.map((m) => (
            <button
              key={m}
              onClick={() => setActiveMap(m)}
              className={clsx(
                'bg-white/[0.06] border rounded-xl p-4 flex flex-col gap-3 text-left transition-colors group',
                activeMap === m ? 'border-indigo-500/40 bg-indigo-500/5' : 'border-white/5 hover:bg-white/[0.09] hover:border-white/10'
              )}
            >
              <div className="w-9 h-9 rounded-xl bg-indigo-500/10 flex items-center justify-center">
                <Folder size={16} className="text-indigo-400" />
              </div>
              <div>
                <p className={clsx('text-xs font-medium transition-colors', activeMap === m ? 'text-indigo-300' : 'text-white group-hover:text-indigo-300')}>{m}/</p>
                <p className="text-[11px] text-white/50">{mapCounts[m] ?? 0} bestand{(mapCounts[m] ?? 0) !== 1 ? 'en' : ''}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* File list */}
      <div className="bg-white/[0.06] border border-white/5 rounded-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
          <h2 className="text-sm font-semibold text-white">{activeMap === 'Alle' ? 'Alle bestanden' : `${activeMap}/`}</h2>
          <span className="text-[11px] text-white/40">{filtered.length} bestand{filtered.length !== 1 ? 'en' : ''}</span>
        </div>
        {loading ? (
          <div className="p-10 text-center text-xs text-white/40">Laden…</div>
        ) : filtered.length === 0 ? (
          <div className="p-10 flex flex-col items-center gap-3">
            <Files size={28} className="text-white/20" />
            <p className="text-xs text-white/40">Geen documenten in deze map</p>
            <button onClick={openNew} className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">+ Document toevoegen</button>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {filtered.map((doc) => (
              <div key={doc.id} className="flex items-center gap-3 px-5 py-3 hover:bg-white/[0.03] transition-colors group">
                <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
                  <FileText size={14} className={extColor(doc.naam)} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-white/80 group-hover:text-white transition-colors truncate">{doc.naam}</p>
                  <p className="text-[11px] text-white/45">
                    {doc.map}
                    {doc.company && ` · ${doc.company.name}`}
                    {doc.project && ` · ${doc.project.name}`}
                    {` · ${fmtDate(doc.created_at)}`}
                  </p>
                </div>
                <span className="text-[11px] text-white/40 flex-shrink-0">{doc.bestandsgrootte ?? ''}</span>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {doc.url && (
                    <a href={doc.url} target="_blank" rel="noreferrer" className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
                      <ExternalLink size={12} className="text-white/50" />
                    </a>
                  )}
                  <button onClick={() => openEdit(doc)} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-[11px] text-white/40 hover:text-white">Bewerk</button>
                  <button onClick={() => del(doc.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 transition-colors">
                    <Trash2 size={12} className="text-red-400/50 hover:text-red-400" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#0f1117] border border-white/10 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-white/5">
              <h2 className="text-sm font-semibold text-white">{editing ? 'Document bewerken' : 'Document toevoegen'}</h2>
              <button onClick={() => setShowModal(false)}><X size={16} className="text-white/50 hover:text-white" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-[11px] text-white/50 mb-1.5">Bestandsnaam *</label>
                <input
                  className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-indigo-500"
                  placeholder="Naam van het bestand incl. extensie…"
                  value={form.naam}
                  onChange={e => setForm(f => ({ ...f, naam: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-white/50 mb-1.5">Map</label>
                  <select
                    className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                    value={form.map}
                    onChange={e => setForm(f => ({ ...f, map: e.target.value }))}
                  >
                    {MAPPEN.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] text-white/50 mb-1.5">Bestandsgrootte</label>
                  <input
                    className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-indigo-500"
                    placeholder="2.4 MB"
                    value={form.bestandsgrootte}
                    onChange={e => setForm(f => ({ ...f, bestandsgrootte: e.target.value }))}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-white/50 mb-1.5">BV</label>
                  <select
                    className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                    value={form.company_id}
                    onChange={e => setForm(f => ({ ...f, company_id: e.target.value }))}
                  >
                    <option value="">Geen</option>
                    {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] text-white/50 mb-1.5">Project</label>
                  <select
                    className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                    value={form.project_id}
                    onChange={e => setForm(f => ({ ...f, project_id: e.target.value }))}
                  >
                    <option value="">Geen</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[11px] text-white/50 mb-1.5">URL / Link (optioneel)</label>
                <input
                  className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-indigo-500"
                  placeholder="https://…"
                  value={form.url}
                  onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-[11px] text-white/50 mb-1.5">Notities</label>
                <textarea
                  rows={2}
                  className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-indigo-500 resize-none"
                  placeholder="Aanvullende informatie…"
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                />
              </div>
              {error && <p className="text-xs text-red-400">{error}</p>}
              <div className="flex gap-3 pt-1">
                <button onClick={() => setShowModal(false)} className="flex-1 border border-white/10 text-white/60 hover:text-white text-xs font-medium py-2.5 rounded-lg transition-colors">Annuleren</button>
                <button onClick={save} disabled={saving} className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-medium py-2.5 rounded-lg transition-colors">
                  {saving ? 'Opslaan…' : editing ? 'Opslaan' : 'Toevoegen'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
