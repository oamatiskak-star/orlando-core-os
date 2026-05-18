'use client'

import { useState, useEffect, useCallback } from 'react'
import { HardHat, Plus, X, ClipboardList } from 'lucide-react'
import clsx from 'clsx'

type Werkbon = {
  id: string
  datum: string
  type: string
  status: string
  omschrijving: string | null
  locatie: string | null
  uren: number | null
  handtekening: boolean
  project: { id: string; name: string } | null
  employee: { id: string; name: string } | null
}

type Project  = { id: string; name: string }
type Employee = { id: string; name: string }

const STATUS_COLORS: Record<string, string> = {
  concept:   'bg-white/[0.08] text-white/65',
  verzonden: 'bg-sky-500/10 text-sky-400',
  getekend:  'bg-blue-500/10 text-blue-400',
  afgerond:  'bg-green-500/10 text-green-400',
}

const TYPE_COLORS: Record<string, string> = {
  normaal:   'bg-white/5 text-white/60',
  spoed:     'bg-red-500/10 text-red-400',
  herstel:   'bg-amber-500/10 text-amber-400',
  oplevering:'bg-emerald-500/10 text-emerald-400',
}

const STATUSES  = ['concept','verzonden','getekend','afgerond']
const TYPES     = ['normaal','spoed','herstel','oplevering']
const STAT_TABS = ['Alle', 'Concept', 'Verzonden', 'Getekend', 'Afgerond']

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('nl-NL', { day: '2-digit', month: 'short', year: 'numeric' })
}

const EMPTY_FORM = { project_id: '', employee_id: '', datum: new Date().toISOString().split('T')[0], type: 'normaal', status: 'concept', omschrijving: '', locatie: '', uren: '' }

export default function BouwplaatsPage() {
  const [items, setItems] = useState<Werkbon[]>([])
  const [projects, setProjects]   = useState<Project[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [activeTab, setActiveTab] = useState('Alle')
  const [loading, setLoading]     = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing]     = useState<Werkbon | null>(null)
  const [form, setForm]           = useState({ ...EMPTY_FORM })
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/bouwplaats/werkbonnen')
      if (res.ok) { const j = await res.json(); setItems(j.werkbonnen ?? []) }
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    fetch('/api/projects').then(r => r.ok ? r.json() : { projects: [] }).then(j => setProjects(j.projects ?? []))
    fetch('/api/personeel/employees?status=actief').then(r => r.ok ? r.json() : { employees: [] }).then(j => setEmployees(j.employees ?? []))
  }, [])

  const filtered = items.filter(w => {
    if (activeTab === 'Alle') return true
    return w.status === activeTab.toLowerCase()
  })

  const stats = {
    totaal:    items.length,
    concept:   items.filter(w => w.status === 'concept').length,
    verzonden: items.filter(w => w.status === 'verzonden').length,
    afgerond:  items.filter(w => w.status === 'afgerond').length,
  }

  function openNew() {
    setEditing(null)
    setForm({ ...EMPTY_FORM, datum: new Date().toISOString().split('T')[0] })
    setError('')
    setShowModal(true)
  }

  function openEdit(w: Werkbon) {
    setEditing(w)
    setForm({
      project_id:  w.project?.id ?? '',
      employee_id: w.employee?.id ?? '',
      datum:       w.datum,
      type:        w.type,
      status:      w.status,
      omschrijving:w.omschrijving ?? '',
      locatie:     w.locatie ?? '',
      uren:        w.uren?.toString() ?? '',
    })
    setError('')
    setShowModal(true)
  }

  async function save() {
    setSaving(true); setError('')
    try {
      const body = {
        project_id:  form.project_id || null,
        employee_id: form.employee_id || null,
        datum:       form.datum,
        type:        form.type,
        status:      form.status,
        omschrijving:form.omschrijving || null,
        locatie:     form.locatie || null,
        uren:        form.uren ? Number(form.uren) : null,
      }
      let res: Response
      if (editing) {
        res = await fetch(`/api/bouwplaats/werkbonnen/${editing.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      } else {
        res = await fetch('/api/bouwplaats/werkbonnen', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      }
      if (!res.ok) { const j = await res.json(); setError(j.error ?? 'Fout'); return }
      setShowModal(false)
      await load()
    } finally { setSaving(false) }
  }

  async function del(id: string) {
    if (!confirm('Werkbon verwijderen?')) return
    await fetch(`/api/bouwplaats/werkbonnen/${id}`, { method: 'DELETE' })
    await load()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
            <HardHat size={16} className="text-amber-400" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-white">BouwplaatsApp</h1>
            <p className="text-xs text-white/50">Dagelijkse uitvoering, werkbonnen en bouwplaatsbeheer.</p>
          </div>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <Plus size={13} /> Nieuwe werkbon
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Totaal',    value: stats.totaal,    color: 'text-white' },
          { label: 'Concept',   value: stats.concept,   color: 'text-white/60' },
          { label: 'Verzonden', value: stats.verzonden,  color: 'text-sky-400' },
          { label: 'Afgerond',  value: stats.afgerond,  color: 'text-green-400' },
        ].map((s) => (
          <div key={s.label} className="bg-white/[0.06] border border-white/5 rounded-xl p-4">
            <p className="text-[11px] text-white/50 mb-1">{s.label}</p>
            <p className={`text-2xl font-semibold ${s.color}`}>{loading ? '…' : s.value}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-1 p-1 bg-white/[0.06] border border-white/5 rounded-xl w-fit">
        {STAT_TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={clsx(
              'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
              activeTab === tab ? 'bg-amber-600 text-white' : 'text-white/65 hover:text-white/70'
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
          <div className="p-10 flex flex-col items-center gap-3">
            <ClipboardList size={28} className="text-white/25" />
            <p className="text-xs text-white/40">Geen werkbonnen gevonden</p>
            <button onClick={openNew} className="text-xs text-amber-400 hover:text-amber-300 transition-colors">+ Eerste werkbon aanmaken</button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="px-4 py-2.5 text-left text-[10px] font-medium text-white/50 uppercase tracking-wider">Datum</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-medium text-white/50 uppercase tracking-wider">Type</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-medium text-white/50 uppercase tracking-wider">Project</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-medium text-white/50 uppercase tracking-wider">Medewerker</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-medium text-white/50 uppercase tracking-wider">Locatie</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-medium text-white/50 uppercase tracking-wider">Uren</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-medium text-white/50 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((w) => (
                  <tr key={w.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3 text-xs text-white/70 whitespace-nowrap">{fmtDate(w.datum)}</td>
                    <td className="px-4 py-3">
                      <span className={clsx('px-2 py-0.5 rounded-full text-[10px] font-semibold', TYPE_COLORS[w.type] ?? TYPE_COLORS.normaal)}>
                        {w.type.charAt(0).toUpperCase()+w.type.slice(1)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-white/65">{w.project?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-white/65">{w.employee?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-white/50 max-w-[140px] truncate">{w.locatie ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-white/50">{w.uren != null ? `${w.uren}u` : '—'}</td>
                    <td className="px-4 py-3">
                      <span className={clsx('px-2 py-0.5 rounded-full text-[10px] font-medium', STATUS_COLORS[w.status] ?? STATUS_COLORS.concept)}>
                        {w.status.charAt(0).toUpperCase()+w.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button onClick={() => openEdit(w)} className="text-[11px] text-white/40 hover:text-white transition-colors">Bewerk</button>
                        <button onClick={() => del(w.id)} className="text-[11px] text-red-400/60 hover:text-red-400 transition-colors">✕</button>
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
              <h2 className="text-sm font-semibold text-white">{editing ? 'Werkbon bewerken' : 'Nieuwe werkbon'}</h2>
              <button onClick={() => setShowModal(false)}><X size={16} className="text-white/50 hover:text-white" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-white/50 mb-1.5">Datum</label>
                  <input
                    type="date"
                    className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                    value={form.datum}
                    onChange={e => setForm(f => ({ ...f, datum: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-white/50 mb-1.5">Type</label>
                  <select
                    className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                    value={form.type}
                    onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                  >
                    {TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-white/50 mb-1.5">Status</label>
                  <select
                    className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                    value={form.status}
                    onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                  >
                    {STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] text-white/50 mb-1.5">Uren</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-amber-500"
                    placeholder="0.0"
                    value={form.uren}
                    onChange={e => setForm(f => ({ ...f, uren: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <label className="block text-[11px] text-white/50 mb-1.5">Project</label>
                <select
                  className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  value={form.project_id}
                  onChange={e => setForm(f => ({ ...f, project_id: e.target.value }))}
                >
                  <option value="">Geen project</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[11px] text-white/50 mb-1.5">Medewerker</label>
                <select
                  className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  value={form.employee_id}
                  onChange={e => setForm(f => ({ ...f, employee_id: e.target.value }))}
                >
                  <option value="">Geen medewerker</option>
                  {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[11px] text-white/50 mb-1.5">Locatie</label>
                <input
                  className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-amber-500"
                  placeholder="Adres of projectlocatie…"
                  value={form.locatie}
                  onChange={e => setForm(f => ({ ...f, locatie: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-[11px] text-white/50 mb-1.5">Omschrijving</label>
                <textarea
                  rows={3}
                  className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-amber-500 resize-none"
                  placeholder="Uitgevoerde werkzaamheden…"
                  value={form.omschrijving}
                  onChange={e => setForm(f => ({ ...f, omschrijving: e.target.value }))}
                />
              </div>
              {error && <p className="text-xs text-red-400">{error}</p>}
              <div className="flex gap-3 pt-1">
                <button onClick={() => setShowModal(false)} className="flex-1 border border-white/10 text-white/60 hover:text-white text-xs font-medium py-2.5 rounded-lg transition-colors">Annuleren</button>
                <button onClick={save} disabled={saving} className="flex-1 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-xs font-medium py-2.5 rounded-lg transition-colors">
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
