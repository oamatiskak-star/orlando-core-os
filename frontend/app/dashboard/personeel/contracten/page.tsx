'use client'

import { useCallback, useEffect, useState } from 'react'
import { ScrollText, Plus, Pencil, Trash2, Calendar, Euro } from 'lucide-react'
import clsx from 'clsx'

type Contract = {
  id: string
  employee_id: string
  employee: { id: string; name: string; job_title: string | null } | null
  type: string
  status: string
  start_date: string | null
  end_date: string | null
  salary: number | null
  hours_per_week: number | null
  file_url: string | null
  notes: string | null
  created_at: string
}

type Employee = { id: string; name: string }

const STATUS_COLORS: Record<string, string> = {
  concept:  'text-white/50   bg-white/5        border-white/10',
  actief:   'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  verlopen: 'text-amber-400   bg-amber-500/10   border-amber-500/20',
  opgezegd: 'text-red-400     bg-red-500/10     border-red-500/20',
}

const TYPE_COLORS: Record<string, string> = {
  arbeidscontract:    'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
  zzp:                'text-violet-400 bg-violet-500/10 border-violet-500/20',
  opdrachtbevestiging:'text-sky-400    bg-sky-500/10    border-sky-500/20',
  'nul-uren':         'text-orange-400 bg-orange-500/10 border-orange-500/20',
}

const EMPTY: Partial<Contract> = {
  employee_id: '', type: 'arbeidscontract', start_date: '', end_date: '',
  salary: undefined, hours_per_week: undefined, file_url: '', notes: '',
}

export default function ContractenPage() {
  const [contracts, setContracts] = useState<Contract[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [total, setTotal]         = useState(0)
  const [filter, setFilter]       = useState('')
  const [modal, setModal]         = useState<Partial<Contract> | null>(null)
  const [saving, setSaving]       = useState(false)
  const [loading, setLoading]     = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const [cr, er] = await Promise.all([
      fetch(`/api/personeel/contracts${filter ? `?status=${filter}` : ''}`, { cache: 'no-store' }),
      fetch('/api/personeel/employees?status=actief', { cache: 'no-store' }),
    ])
    if (cr.ok) { const d = await cr.json(); setContracts(d.contracts ?? []); setTotal(d.total ?? 0) }
    if (er.ok) { const d = await er.json(); setEmployees(d.employees ?? []) }
    setLoading(false)
  }, [filter])

  useEffect(() => { load() }, [load])

  const save = async () => {
    if (!modal) return
    setSaving(true)
    const isNew  = !modal.id
    const url    = isNew ? '/api/personeel/contracts' : `/api/personeel/contracts/${modal.id}`
    const method = isNew ? 'POST' : 'PATCH'
    const body: Record<string, unknown> = {
      employee_id:   modal.employee_id,
      type:          modal.type ?? 'arbeidscontract',
      start_date:    modal.start_date || null,
      end_date:      modal.end_date || null,
      salary:        modal.salary ?? null,
      hours_per_week:modal.hours_per_week ?? null,
      file_url:      modal.file_url || null,
      notes:         modal.notes || null,
    }
    if (!isNew) body.status = modal.status
    const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    if (r.ok) { setModal(null); load() }
    setSaving(false)
  }

  const del = async (id: string) => {
    if (!confirm('Contract verwijderen?')) return
    await fetch(`/api/personeel/contracts/${id}`, { method: 'DELETE' })
    load()
  }

  const isExpiringSoon = (c: Contract) => {
    if (!c.end_date || c.status !== 'actief') return false
    const diff = new Date(c.end_date).getTime() - Date.now()
    return diff > 0 && diff < 30 * 24 * 60 * 60 * 1000
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-white">Contracten</h1>
          <p className="text-sm text-white/65 mt-0.5">Arbeids- en ZZP-contracten</p>
        </div>
        <button onClick={() => setModal({ ...EMPTY })}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-500/15 border border-indigo-500/20 text-indigo-400 hover:bg-indigo-500/25 transition-colors text-sm">
          <Plus size={14} /> Nieuw contract
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Totaal',   value: total,                                           color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20' },
          { label: 'Actief',   value: contracts.filter(c => c.status === 'actief').length,  color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
          { label: 'Verloopt', value: contracts.filter(isExpiringSoon).length,          color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
          { label: 'Verlopen', value: contracts.filter(c => c.status === 'verlopen').length, color: 'text-red-400 bg-red-500/10 border-red-500/20' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white/[0.06] border border-white/5 rounded-xl p-4 flex items-center gap-3">
            <div className={clsx('w-8 h-8 rounded-lg flex items-center justify-center border', color)}>
              <ScrollText size={14} />
            </div>
            <div>
              <p className="text-lg font-bold text-white">{value}</p>
              <p className="text-xs text-white/50">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {[
          { v: '',         l: 'Alle' },
          { v: 'actief',   l: 'Actief' },
          { v: 'concept',  l: 'Concept' },
          { v: 'verlopen', l: 'Verlopen' },
          { v: 'opgezegd', l: 'Opgezegd' },
        ].map(({ v, l }) => (
          <button key={v} onClick={() => setFilter(v)}
            className={clsx('px-3 py-1 rounded-lg text-xs transition-colors border',
              filter === v ? 'bg-indigo-500/20 border-indigo-500/30 text-indigo-300' : 'bg-white/5 border-white/10 text-white/50 hover:text-white/80'
            )}>{l}</button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="text-center py-12 text-white/30 text-sm">Laden...</div>
      ) : contracts.length === 0 ? (
        <div className="bg-white/[0.04] border border-white/8 rounded-xl p-10 flex flex-col items-center gap-3">
          <ScrollText size={32} className="text-white/20" />
          <p className="text-sm text-white/40">Nog geen contracten</p>
          <button onClick={() => setModal({ ...EMPTY })} className="text-xs text-indigo-400 hover:text-indigo-300">Eerste contract toevoegen</button>
        </div>
      ) : (
        <div className="space-y-2">
          {contracts.map(c => (
            <div key={c.id} className={clsx('group bg-white/[0.06] border rounded-xl p-4 hover:border-white/15 transition-colors', isExpiringSoon(c) ? 'border-amber-500/30' : 'border-white/5')}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className={clsx('px-2 py-0.5 rounded-full text-[11px] font-medium border', TYPE_COLORS[c.type] ?? TYPE_COLORS.arbeidscontract)}>
                      {c.type}
                    </span>
                    <span className={clsx('px-2 py-0.5 rounded-full text-[11px] border', STATUS_COLORS[c.status] ?? STATUS_COLORS.actief)}>
                      {c.status}
                    </span>
                    {isExpiringSoon(c) && (
                      <span className="px-2 py-0.5 rounded-full text-[11px] bg-amber-500/15 border border-amber-500/30 text-amber-400">
                        Verloopt binnenkort
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-semibold text-white">{c.employee?.name ?? 'Onbekend'}</p>
                  {c.employee?.job_title && <p className="text-xs text-white/45">{c.employee.job_title}</p>}
                  <div className="flex items-center gap-4 mt-2 flex-wrap">
                    {c.salary && (
                      <div className="flex items-center gap-1 text-xs text-white/55">
                        <Euro size={11} />
                        <span>€ {c.salary.toLocaleString('nl-NL')}</span>
                      </div>
                    )}
                    {(c.start_date || c.end_date) && (
                      <div className="flex items-center gap-1 text-xs text-white/55">
                        <Calendar size={11} />
                        <span>
                          {c.start_date ? new Date(c.start_date).toLocaleDateString('nl-NL') : '?'}
                          {' → '}
                          {c.end_date ? new Date(c.end_date).toLocaleDateString('nl-NL') : 'onbepaald'}
                        </span>
                      </div>
                    )}
                    {c.hours_per_week && (
                      <span className="text-xs text-white/45">{c.hours_per_week} uur/week</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <button onClick={() => setModal(c)} className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-colors">
                    <Pencil size={12} />
                  </button>
                  <button onClick={() => del(c.id)} className="p-1.5 rounded-lg hover:bg-red-500/15 text-white/40 hover:text-red-400 transition-colors">
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
              <h2 className="text-base font-semibold text-white">{modal.id ? 'Contract bewerken' : 'Nieuw contract'}</h2>
              <button onClick={() => setModal(null)} className="text-white/40 hover:text-white text-xl leading-none">×</button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs text-white/50 mb-1 block">Medewerker *</label>
                <select value={modal.employee_id ?? ''} onChange={e => setModal(m => ({ ...m, employee_id: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/50">
                  <option value="">— Selecteer medewerker —</option>
                  {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-white/50 mb-1 block">Type</label>
                  <select value={modal.type ?? 'arbeidscontract'} onChange={e => setModal(m => ({ ...m, type: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/50">
                    <option value="arbeidscontract">Arbeidscontract</option>
                    <option value="zzp">ZZP</option>
                    <option value="opdrachtbevestiging">Opdrachtbevestiging</option>
                    <option value="nul-uren">Nul-uren</option>
                  </select>
                </div>
                {modal.id && (
                  <div>
                    <label className="text-xs text-white/50 mb-1 block">Status</label>
                    <select value={modal.status ?? 'actief'} onChange={e => setModal(m => ({ ...m, status: e.target.value }))}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/50">
                      <option value="concept">Concept</option>
                      <option value="actief">Actief</option>
                      <option value="verlopen">Verlopen</option>
                      <option value="opgezegd">Opgezegd</option>
                    </select>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-white/50 mb-1 block">Startdatum</label>
                  <input type="date" value={modal.start_date ?? ''} onChange={e => setModal(m => ({ ...m, start_date: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/50" />
                </div>
                <div>
                  <label className="text-xs text-white/50 mb-1 block">Einddatum</label>
                  <input type="date" value={modal.end_date ?? ''} onChange={e => setModal(m => ({ ...m, end_date: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/50" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-white/50 mb-1 block">Salaris/tarief (€)</label>
                  <input type="number" value={modal.salary ?? ''} onChange={e => setModal(m => ({ ...m, salary: e.target.value ? Number(e.target.value) : undefined }))}
                    placeholder="2500"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/25 focus:outline-none focus:border-indigo-500/50" />
                </div>
                <div>
                  <label className="text-xs text-white/50 mb-1 block">Uren/week</label>
                  <input type="number" value={modal.hours_per_week ?? ''} onChange={e => setModal(m => ({ ...m, hours_per_week: e.target.value ? Number(e.target.value) : undefined }))}
                    placeholder="40"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/25 focus:outline-none focus:border-indigo-500/50" />
                </div>
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
              <button onClick={save} disabled={saving || !modal.employee_id}
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
