'use client'

import { useCallback, useEffect, useState } from 'react'
import { Key, Plus, Pencil, Trash2, Building2, Globe } from 'lucide-react'
import clsx from 'clsx'

type UBORecord = {
  id: string
  company_id: string | null
  company: { id: string; name: string } | null
  name: string
  date_of_birth: string | null
  nationality: string | null
  percentage: number | null
  address: string | null
  registered_at: string | null
  notes: string | null
  created_at: string
}

type Company = { id: string; name: string }

const EMPTY: Partial<UBORecord> = {
  name: '', company_id: '', date_of_birth: '', nationality: 'Nederlands',
  percentage: undefined, address: '', registered_at: '', notes: '',
}

export default function UBOPage() {
  const [records, setRecords]     = useState<UBORecord[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [total, setTotal]         = useState(0)
  const [compFilter, setCompFilter] = useState('')
  const [modal, setModal]         = useState<Partial<UBORecord> | null>(null)
  const [saving, setSaving]       = useState(false)
  const [loading, setLoading]     = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const sp = new URLSearchParams()
    if (compFilter) sp.set('company_id', compFilter)
    const [rr, cr] = await Promise.all([
      fetch(`/api/personeel/ubo${sp.toString() ? `?${sp}` : ''}`, { cache: 'no-store' }),
      fetch('/api/companies', { cache: 'no-store' }),
    ])
    if (rr.ok) { const d = await rr.json(); setRecords(d.records ?? []); setTotal(d.total ?? 0) }
    if (cr.ok) { const d = await cr.json(); setCompanies(d.companies ?? []) }
    setLoading(false)
  }, [compFilter])

  useEffect(() => { load() }, [load])

  const save = async () => {
    if (!modal) return
    setSaving(true)
    const isNew  = !modal.id
    const url    = isNew ? '/api/personeel/ubo' : `/api/personeel/ubo/${modal.id}`
    const method = isNew ? 'POST' : 'PATCH'
    const r = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name:          modal.name,
        company_id:    modal.company_id || null,
        date_of_birth: modal.date_of_birth || null,
        nationality:   modal.nationality || null,
        percentage:    modal.percentage ?? null,
        address:       modal.address || null,
        registered_at: modal.registered_at || null,
        notes:         modal.notes || null,
      }),
    })
    if (r.ok) { setModal(null); load() }
    setSaving(false)
  }

  const del = async (id: string) => {
    if (!confirm('UBO registratie verwijderen?')) return
    await fetch(`/api/personeel/ubo/${id}`, { method: 'DELETE' })
    load()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-white">UBO Register</h1>
          <p className="text-sm text-white/65 mt-0.5">Ultimate Beneficial Owners — wettelijk verplichte registratie</p>
        </div>
        <button onClick={() => setModal({ ...EMPTY })}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-500/15 border border-indigo-500/20 text-indigo-400 hover:bg-indigo-500/25 transition-colors text-sm">
          <Plus size={14} /> UBO toevoegen
        </button>
      </div>

      {/* Info banner */}
      <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl px-4 py-3 text-xs text-amber-400/80">
        Wettelijk verplicht: alle personen met &gt;25% eigendom of stemrecht moeten geregistreerd worden bij KVK.
      </div>

      {/* Stats per BV */}
      {companies.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {companies.slice(0, 4).map(c => {
            const count = records.filter(r => r.company_id === c.id).length
            return (
              <div key={c.id} className="bg-white/[0.06] border border-white/5 rounded-xl p-3">
                <p className="text-lg font-bold text-white">{count}</p>
                <p className="text-xs text-white/45 mt-0.5 truncate">{c.name.replace(' BV', '').replace(' B.V.', '')}</p>
              </div>
            )
          })}
        </div>
      )}

      {/* Company filter */}
      <div className="flex gap-2 items-center">
        <span className="text-xs text-white/40 shrink-0">Filter:</span>
        <select value={compFilter} onChange={e => setCompFilter(e.target.value)}
          className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500/50">
          <option value="">Alle BVs</option>
          {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {/* Records */}
      {loading ? (
        <div className="text-center py-12 text-white/30 text-sm">Laden...</div>
      ) : records.length === 0 ? (
        <div className="bg-white/[0.04] border border-white/8 rounded-xl p-10 flex flex-col items-center gap-3">
          <Key size={32} className="text-white/20" />
          <p className="text-sm text-white/40">Geen UBO-registraties gevonden</p>
          <button onClick={() => setModal({ ...EMPTY })} className="text-xs text-indigo-400 hover:text-indigo-300">UBO toevoegen</button>
        </div>
      ) : (
        <div className="space-y-3">
          {records.map(r => (
            <div key={r.id} className="group bg-white/[0.06] border border-white/5 rounded-xl p-4 hover:border-white/15 transition-colors">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white">{r.name}</p>
                  <div className="flex items-center gap-4 mt-1.5 flex-wrap">
                    {r.company && (
                      <div className="flex items-center gap-1 text-xs text-indigo-400/80">
                        <Building2 size={11} />
                        <span>{r.company.name}</span>
                      </div>
                    )}
                    {r.percentage != null && (
                      <span className={clsx('text-xs font-medium', r.percentage >= 25 ? 'text-emerald-400' : 'text-amber-400')}>
                        {r.percentage}% eigendom
                      </span>
                    )}
                    {r.nationality && (
                      <div className="flex items-center gap-1 text-xs text-white/45">
                        <Globe size={11} />
                        <span>{r.nationality}</span>
                      </div>
                    )}
                    {r.date_of_birth && (
                      <span className="text-xs text-white/45">
                        {new Date(r.date_of_birth).toLocaleDateString('nl-NL')}
                      </span>
                    )}
                    {r.registered_at && (
                      <span className="text-xs text-white/40">
                        Geregistreerd: {new Date(r.registered_at).toLocaleDateString('nl-NL')}
                      </span>
                    )}
                  </div>
                  {r.address && <p className="text-xs text-white/40 mt-1">{r.address}</p>}
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <button onClick={() => setModal(r)} className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-colors">
                    <Pencil size={12} />
                  </button>
                  <button onClick={() => del(r.id)} className="p-1.5 rounded-lg hover:bg-red-500/15 text-white/40 hover:text-red-400 transition-colors">
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
              <h2 className="text-base font-semibold text-white">{modal.id ? 'UBO bewerken' : 'UBO toevoegen'}</h2>
              <button onClick={() => setModal(null)} className="text-white/40 hover:text-white text-xl leading-none">×</button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs text-white/50 mb-1 block">Naam *</label>
                <input type="text" value={modal.name ?? ''} onChange={e => setModal(m => ({ ...m, name: e.target.value }))}
                  placeholder="Volledige naam"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/25 focus:outline-none focus:border-indigo-500/50" />
              </div>

              <div>
                <label className="text-xs text-white/50 mb-1 block">BV / Onderneming</label>
                <select value={modal.company_id ?? ''} onChange={e => setModal(m => ({ ...m, company_id: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/50">
                  <option value="">— Selecteer BV —</option>
                  {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-white/50 mb-1 block">Eigendomspercentage (%)</label>
                  <input type="number" min="0" max="100" step="0.01"
                    value={modal.percentage ?? ''} onChange={e => setModal(m => ({ ...m, percentage: e.target.value ? Number(e.target.value) : undefined }))}
                    placeholder="25.00"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/25 focus:outline-none focus:border-indigo-500/50" />
                </div>
                <div>
                  <label className="text-xs text-white/50 mb-1 block">Nationaliteit</label>
                  <input type="text" value={modal.nationality ?? ''} onChange={e => setModal(m => ({ ...m, nationality: e.target.value }))}
                    placeholder="Nederlands"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/25 focus:outline-none focus:border-indigo-500/50" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-white/50 mb-1 block">Geboortedatum</label>
                  <input type="date" value={modal.date_of_birth ?? ''} onChange={e => setModal(m => ({ ...m, date_of_birth: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/50" />
                </div>
                <div>
                  <label className="text-xs text-white/50 mb-1 block">Registratiedatum KVK</label>
                  <input type="date" value={modal.registered_at ?? ''} onChange={e => setModal(m => ({ ...m, registered_at: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/50" />
                </div>
              </div>

              <div>
                <label className="text-xs text-white/50 mb-1 block">Adres</label>
                <input type="text" value={modal.address ?? ''} onChange={e => setModal(m => ({ ...m, address: e.target.value }))}
                  placeholder="Straat 1, 1234 AB Amsterdam"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/25 focus:outline-none focus:border-indigo-500/50" />
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
              <button onClick={save} disabled={saving || !modal.name}
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
