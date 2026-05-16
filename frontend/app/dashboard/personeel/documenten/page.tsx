'use client'

import { useCallback, useEffect, useState } from 'react'
import { FileText, Plus, Trash2, AlertTriangle, Calendar, User } from 'lucide-react'
import clsx from 'clsx'

type HRDoc = {
  id: string
  employee_id: string | null
  employee: { id: string; name: string } | null
  doc_type: string
  title: string
  file_url: string | null
  expires_at: string | null
  notes: string | null
  created_at: string
}

type Employee = { id: string; name: string }

const TYPE_COLORS: Record<string, string> = {
  id:          'text-blue-400   bg-blue-500/10   border-blue-500/20',
  diploma:     'text-violet-400 bg-violet-500/10 border-violet-500/20',
  vog:         'text-sky-400    bg-sky-500/10    border-sky-500/20',
  rijbewijs:   'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
  certificaat: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  overig:      'text-white/40   bg-white/5       border-white/10',
}

const TYPE_LABELS: Record<string, string> = {
  id: 'ID', diploma: 'Diploma', vog: 'VOG', rijbewijs: 'Rijbewijs', certificaat: 'Certificaat', overig: 'Overig',
}

const EMPTY: Partial<HRDoc> = {
  employee_id: '', doc_type: 'overig', title: '', file_url: '', expires_at: '', notes: '',
}

export default function PersoneelDocumentenPage() {
  const [docs, setDocs]           = useState<HRDoc[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [total, setTotal]         = useState(0)
  const [typeFilter, setTypeFilter] = useState('')
  const [modal, setModal]         = useState<Partial<HRDoc> | null>(null)
  const [saving, setSaving]       = useState(false)
  const [loading, setLoading]     = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const sp = new URLSearchParams()
    if (typeFilter) sp.set('doc_type', typeFilter)
    const [dr, er] = await Promise.all([
      fetch(`/api/personeel/documents${sp.toString() ? `?${sp}` : ''}`, { cache: 'no-store' }),
      fetch('/api/personeel/employees', { cache: 'no-store' }),
    ])
    if (dr.ok) { const d = await dr.json(); setDocs(d.documents ?? []); setTotal(d.total ?? 0) }
    if (er.ok) { const d = await er.json(); setEmployees(d.employees ?? []) }
    setLoading(false)
  }, [typeFilter])

  useEffect(() => { load() }, [load])

  const save = async () => {
    if (!modal) return
    setSaving(true)
    const r = await fetch('/api/personeel/documents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        employee_id: modal.employee_id || null,
        doc_type:    modal.doc_type ?? 'overig',
        title:       modal.title,
        file_url:    modal.file_url || null,
        expires_at:  modal.expires_at || null,
        notes:       modal.notes || null,
      }),
    })
    if (r.ok) { setModal(null); load() }
    setSaving(false)
  }

  const del = async (id: string) => {
    if (!confirm('Document verwijderen?')) return
    await fetch(`/api/personeel/documents/${id}`, { method: 'DELETE' })
    load()
  }

  const isExpiring = (d: HRDoc) => {
    if (!d.expires_at) return false
    const diff = new Date(d.expires_at).getTime() - Date.now()
    return diff > 0 && diff < 60 * 24 * 60 * 60 * 1000
  }

  const isExpired = (d: HRDoc) => {
    if (!d.expires_at) return false
    return new Date(d.expires_at).getTime() < Date.now()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-white">Personeelsdocumenten</h1>
          <p className="text-sm text-white/65 mt-0.5">VOG, diploma's, rijbewijzen en certificaten</p>
        </div>
        <button onClick={() => setModal({ ...EMPTY })}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-500/15 border border-indigo-500/20 text-indigo-400 hover:bg-indigo-500/25 transition-colors text-sm">
          <Plus size={14} /> Document toevoegen
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Totaal',   value: total },
          { label: 'Verlopen', value: docs.filter(isExpired).length },
          { label: 'Verloopt binnenkort', value: docs.filter(isExpiring).length },
          { label: 'Geen vervaldatum', value: docs.filter(d => !d.expires_at).length },
        ].map(({ label, value }) => (
          <div key={label} className="bg-white/[0.06] border border-white/5 rounded-xl p-4 text-center">
            <p className="text-xl font-bold text-white">{value}</p>
            <p className="text-xs text-white/50 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Type filter */}
      <div className="flex gap-2 flex-wrap">
        {[
          { v: '',           l: 'Alle' },
          { v: 'id',         l: 'ID' },
          { v: 'vog',        l: 'VOG' },
          { v: 'diploma',    l: 'Diploma' },
          { v: 'rijbewijs',  l: 'Rijbewijs' },
          { v: 'certificaat',l: 'Certificaat' },
          { v: 'overig',     l: 'Overig' },
        ].map(({ v, l }) => (
          <button key={v} onClick={() => setTypeFilter(v)}
            className={clsx('px-3 py-1 rounded-lg text-xs transition-colors border',
              typeFilter === v ? 'bg-indigo-500/20 border-indigo-500/30 text-indigo-300' : 'bg-white/5 border-white/10 text-white/50 hover:text-white/80'
            )}>{l}</button>
        ))}
      </div>

      {/* Documents */}
      {loading ? (
        <div className="text-center py-12 text-white/30 text-sm">Laden...</div>
      ) : docs.length === 0 ? (
        <div className="bg-white/[0.04] border border-white/8 rounded-xl p-10 flex flex-col items-center gap-3">
          <FileText size={32} className="text-white/20" />
          <p className="text-sm text-white/40">Nog geen documenten</p>
          <button onClick={() => setModal({ ...EMPTY })} className="text-xs text-indigo-400 hover:text-indigo-300">Document toevoegen</button>
        </div>
      ) : (
        <div className="space-y-2">
          {docs.map(d => (
            <div key={d.id} className={clsx('group bg-white/[0.06] border rounded-xl p-4 hover:border-white/15 transition-colors',
              isExpired(d) ? 'border-red-500/30' : isExpiring(d) ? 'border-amber-500/30' : 'border-white/5')}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className={clsx('px-2 py-0.5 rounded-full text-[11px] border', TYPE_COLORS[d.doc_type] ?? TYPE_COLORS.overig)}>
                      {TYPE_LABELS[d.doc_type] ?? d.doc_type}
                    </span>
                    {isExpired(d) && (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-red-500/10 border border-red-500/20 text-red-400">
                        <AlertTriangle size={10} /> Verlopen
                      </span>
                    )}
                    {isExpiring(d) && !isExpired(d) && (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-amber-500/10 border border-amber-500/20 text-amber-400">
                        <AlertTriangle size={10} /> Verloopt binnenkort
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-semibold text-white">{d.title}</p>
                  <div className="flex items-center gap-4 mt-1.5 flex-wrap">
                    {d.employee && (
                      <div className="flex items-center gap-1 text-xs text-white/50">
                        <User size={11} />
                        <span>{d.employee.name}</span>
                      </div>
                    )}
                    {d.expires_at && (
                      <div className={clsx('flex items-center gap-1 text-xs', isExpired(d) ? 'text-red-400' : isExpiring(d) ? 'text-amber-400' : 'text-white/45')}>
                        <Calendar size={11} />
                        <span>Geldig t/m {new Date(d.expires_at).toLocaleDateString('nl-NL')}</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <button onClick={() => del(d.id)} className="p-1.5 rounded-lg hover:bg-red-500/15 text-white/40 hover:text-red-400 transition-colors">
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
              <h2 className="text-base font-semibold text-white">Document toevoegen</h2>
              <button onClick={() => setModal(null)} className="text-white/40 hover:text-white text-xl leading-none">×</button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs text-white/50 mb-1 block">Titel *</label>
                <input type="text" value={modal.title ?? ''} onChange={e => setModal(m => ({ ...m, title: e.target.value }))}
                  placeholder="VOG aanvraag 2025"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/25 focus:outline-none focus:border-indigo-500/50" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-white/50 mb-1 block">Type</label>
                  <select value={modal.doc_type ?? 'overig'} onChange={e => setModal(m => ({ ...m, doc_type: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/50">
                    <option value="id">ID</option>
                    <option value="diploma">Diploma</option>
                    <option value="vog">VOG</option>
                    <option value="rijbewijs">Rijbewijs</option>
                    <option value="certificaat">Certificaat</option>
                    <option value="overig">Overig</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-white/50 mb-1 block">Vervaldatum</label>
                  <input type="date" value={modal.expires_at ?? ''} onChange={e => setModal(m => ({ ...m, expires_at: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/50" />
                </div>
              </div>

              <div>
                <label className="text-xs text-white/50 mb-1 block">Medewerker</label>
                <select value={modal.employee_id ?? ''} onChange={e => setModal(m => ({ ...m, employee_id: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/50">
                  <option value="">— Geen (bedrijfsdocument) —</option>
                  {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </div>

              <div>
                <label className="text-xs text-white/50 mb-1 block">Notities</label>
                <textarea rows={2} value={modal.notes ?? ''} onChange={e => setModal(m => ({ ...m, notes: e.target.value }))}
                  placeholder="Interne notities..."
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/25 focus:outline-none focus:border-indigo-500/50 resize-none" />
              </div>
            </div>

            <div className="sticky bottom-0 bg-[#111] border-t border-white/8 px-5 py-4 flex justify-end gap-3">
              <button onClick={() => setModal(null)} className="px-4 py-2 rounded-lg text-sm text-white/50 hover:text-white hover:bg-white/5 transition-colors">Annuleren</button>
              <button onClick={save} disabled={saving || !modal.title}
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
