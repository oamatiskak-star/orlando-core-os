'use client'

import { useCallback, useEffect, useState } from 'react'
import { Users, UserCheck, UserX, Plus, Pencil, Trash2, Phone, Mail, Building2, Calendar } from 'lucide-react'
import clsx from 'clsx'

type Employee = {
  id: string
  name: string
  email: string | null
  phone: string | null
  type: string
  job_title: string | null
  company_id: string | null
  company: { id: string; name: string } | null
  start_date: string | null
  end_date: string | null
  hourly_rate: number | null
  monthly_salary: number | null
  hours_per_week: number | null
  status: string
  notes: string | null
}

type Company = { id: string; name: string }

const STATUS_COLORS: Record<string, string> = {
  actief:  'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  inactief:'text-white/40    bg-white/5        border-white/10',
  ziek:    'text-amber-400   bg-amber-500/10   border-amber-500/20',
  verlof:  'text-sky-400     bg-sky-500/10     border-sky-500/20',
}

const TYPE_COLORS: Record<string, string> = {
  medewerker: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
  zzp:        'text-violet-400 bg-violet-500/10 border-violet-500/20',
  stagiair:   'text-pink-400   bg-pink-500/10   border-pink-500/20',
}

const EMPTY: Partial<Employee> = {
  name: '', email: '', phone: '', type: 'medewerker', job_title: '',
  company_id: '', start_date: '', hourly_rate: undefined, monthly_salary: undefined,
  hours_per_week: undefined, notes: '',
}

export default function MedewerkersPage() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [total, setTotal]         = useState(0)
  const [filter, setFilter]       = useState('')
  const [modal, setModal]         = useState<Partial<Employee> | null>(null)
  const [saving, setSaving]       = useState(false)
  const [loading, setLoading]     = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const [er, cr] = await Promise.all([
      fetch(`/api/personeel/employees${filter ? `?status=${filter}` : ''}`, { cache: 'no-store' }),
      fetch('/api/companies', { cache: 'no-store' }),
    ])
    if (er.ok) { const d = await er.json(); setEmployees(d.employees ?? []); setTotal(d.total ?? 0) }
    if (cr.ok) { const d = await cr.json(); setCompanies(d.companies ?? []) }
    setLoading(false)
  }, [filter])

  useEffect(() => { load() }, [load])

  const save = async () => {
    if (!modal) return
    setSaving(true)
    const isNew  = !modal.id
    const url    = isNew ? '/api/personeel/employees' : `/api/personeel/employees/${modal.id}`
    const method = isNew ? 'POST' : 'PATCH'
    const body: Record<string, unknown> = {
      name:           modal.name,
      email:          modal.email || null,
      phone:          modal.phone || null,
      type:           modal.type ?? 'medewerker',
      job_title:      modal.job_title || null,
      company_id:     modal.company_id || null,
      start_date:     modal.start_date || null,
      hourly_rate:    modal.hourly_rate ?? null,
      monthly_salary: modal.monthly_salary ?? null,
      hours_per_week: modal.hours_per_week ?? null,
      notes:          modal.notes || null,
    }
    if (!isNew) body.status = modal.status
    const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    if (r.ok) { setModal(null); load() }
    setSaving(false)
  }

  const del = async (id: string) => {
    if (!confirm('Medewerker verwijderen?')) return
    await fetch(`/api/personeel/employees/${id}`, { method: 'DELETE' })
    load()
  }

  const counts = {
    actief:   employees.filter(e => e.status === 'actief').length,
    zzp:      employees.filter(e => e.type === 'zzp').length,
    ziek:     employees.filter(e => e.status === 'ziek').length,
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-white">Medewerkers</h1>
          <p className="text-sm text-white/65 mt-0.5">Actieve medewerkers en ZZP-ers</p>
        </div>
        <button
          onClick={() => setModal({ ...EMPTY })}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-500/15 border border-indigo-500/20 text-indigo-400 hover:bg-indigo-500/25 transition-colors text-sm"
        >
          <Plus size={14} /> Toevoegen
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Totaal',    value: total,        icon: Users,    color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20' },
          { label: 'Actief',    value: counts.actief, icon: UserCheck, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
          { label: 'ZZP',       value: counts.zzp,   icon: Users,    color: 'text-violet-400 bg-violet-500/10 border-violet-500/20' },
          { label: 'Ziek/Verlof', value: counts.ziek, icon: UserX,  color: counts.ziek > 0 ? 'text-amber-400 bg-amber-500/10 border-amber-500/20' : 'text-white/30 bg-white/5 border-white/10' },
        ].map(({ label, value, icon: Icon, color }) => (
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

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {[
          { v: '',        l: 'Alle' },
          { v: 'actief',  l: 'Actief' },
          { v: 'ziek',    l: 'Ziek' },
          { v: 'verlof',  l: 'Verlof' },
          { v: 'inactief',l: 'Inactief' },
        ].map(({ v, l }) => (
          <button key={v} onClick={() => setFilter(v)}
            className={clsx('px-3 py-1 rounded-lg text-xs transition-colors border',
              filter === v ? 'bg-indigo-500/20 border-indigo-500/30 text-indigo-300' : 'bg-white/5 border-white/10 text-white/50 hover:text-white/80'
            )}>{l}</button>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-12 text-white/30 text-sm">Laden...</div>
      ) : employees.length === 0 ? (
        <div className="bg-white/[0.04] border border-white/8 rounded-xl p-10 flex flex-col items-center gap-3">
          <Users size={32} className="text-white/20" />
          <p className="text-sm text-white/40">Nog geen medewerkers geregistreerd</p>
          <button onClick={() => setModal({ ...EMPTY })} className="text-xs text-indigo-400 hover:text-indigo-300">Eerste medewerker toevoegen</button>
        </div>
      ) : (
        <div className="bg-white/[0.04] border border-white/8 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/8">
                <th className="text-left px-4 py-3 text-xs text-white/40 font-medium">Naam</th>
                <th className="text-left px-4 py-3 text-xs text-white/40 font-medium hidden md:table-cell">BV</th>
                <th className="text-left px-4 py-3 text-xs text-white/40 font-medium">Type</th>
                <th className="text-left px-4 py-3 text-xs text-white/40 font-medium">Status</th>
                <th className="text-left px-4 py-3 text-xs text-white/40 font-medium hidden lg:table-cell">Contact</th>
                <th className="px-4 py-3 w-16" />
              </tr>
            </thead>
            <tbody>
              {employees.map((e, i) => (
                <tr key={e.id} className={clsx('group hover:bg-white/5 transition-colors', i < employees.length - 1 && 'border-b border-white/5')}>
                  <td className="px-4 py-3">
                    <p className="text-white font-medium text-sm">{e.name}</p>
                    {e.job_title && <p className="text-xs text-white/45">{e.job_title}</p>}
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className="text-xs text-white/55">{e.company?.name ?? '—'}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={clsx('px-2 py-0.5 rounded-full text-[11px] border', TYPE_COLORS[e.type] ?? TYPE_COLORS.medewerker)}>
                      {e.type}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={clsx('px-2 py-0.5 rounded-full text-[11px] border', STATUS_COLORS[e.status] ?? STATUS_COLORS.actief)}>
                      {e.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <div className="flex flex-col gap-0.5">
                      {e.email && (
                        <div className="flex items-center gap-1 text-xs text-white/45">
                          <Mail size={10} /> <span>{e.email}</span>
                        </div>
                      )}
                      {e.phone && (
                        <div className="flex items-center gap-1 text-xs text-white/45">
                          <Phone size={10} /> <span>{e.phone}</span>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity justify-end">
                      <button onClick={() => setModal(e)} className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-colors">
                        <Pencil size={12} />
                      </button>
                      <button onClick={() => del(e.id)} className="p-1.5 rounded-lg hover:bg-red-500/15 text-white/40 hover:text-red-400 transition-colors">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto flex flex-col">
            <div className="sticky top-0 bg-[#111] border-b border-white/8 px-5 py-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-white">{modal.id ? 'Medewerker bewerken' : 'Medewerker toevoegen'}</h2>
              <button onClick={() => setModal(null)} className="text-white/40 hover:text-white text-xl leading-none">×</button>
            </div>

            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-white/50 mb-1 block">Naam *</label>
                  <input type="text" value={modal.name ?? ''} onChange={e => setModal(m => ({ ...m, name: e.target.value }))}
                    placeholder="Volledige naam"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/25 focus:outline-none focus:border-indigo-500/50" />
                </div>
                <div>
                  <label className="text-xs text-white/50 mb-1 block">Functie</label>
                  <input type="text" value={modal.job_title ?? ''} onChange={e => setModal(m => ({ ...m, job_title: e.target.value }))}
                    placeholder="Timmerman"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/25 focus:outline-none focus:border-indigo-500/50" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-white/50 mb-1 block">Type</label>
                  <select value={modal.type ?? 'medewerker'} onChange={e => setModal(m => ({ ...m, type: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/50">
                    <option value="medewerker">Medewerker</option>
                    <option value="zzp">ZZP</option>
                    <option value="stagiair">Stagiair</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-white/50 mb-1 block">BV</label>
                  <select value={modal.company_id ?? ''} onChange={e => setModal(m => ({ ...m, company_id: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/50">
                    <option value="">— Geen —</option>
                    {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>

              {modal.id && (
                <div>
                  <label className="text-xs text-white/50 mb-1 block">Status</label>
                  <select value={modal.status ?? 'actief'} onChange={e => setModal(m => ({ ...m, status: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/50">
                    <option value="actief">Actief</option>
                    <option value="ziek">Ziek</option>
                    <option value="verlof">Verlof</option>
                    <option value="inactief">Inactief</option>
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-white/50 mb-1 block">E-mail</label>
                  <input type="email" value={modal.email ?? ''} onChange={e => setModal(m => ({ ...m, email: e.target.value }))}
                    placeholder="naam@bedrijf.nl"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/25 focus:outline-none focus:border-indigo-500/50" />
                </div>
                <div>
                  <label className="text-xs text-white/50 mb-1 block">Telefoon</label>
                  <input type="tel" value={modal.phone ?? ''} onChange={e => setModal(m => ({ ...m, phone: e.target.value }))}
                    placeholder="+31 6 12345678"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/25 focus:outline-none focus:border-indigo-500/50" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-white/50 mb-1 block">Startdatum</label>
                  <input type="date" value={modal.start_date ?? ''} onChange={e => setModal(m => ({ ...m, start_date: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/50" />
                </div>
                <div>
                  <label className="text-xs text-white/50 mb-1 block">Uren/week</label>
                  <input type="number" value={modal.hours_per_week ?? ''} onChange={e => setModal(m => ({ ...m, hours_per_week: e.target.value ? Number(e.target.value) : undefined }))}
                    placeholder="40"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/25 focus:outline-none focus:border-indigo-500/50" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-white/50 mb-1 block">Uurtarief (€)</label>
                  <input type="number" value={modal.hourly_rate ?? ''} onChange={e => setModal(m => ({ ...m, hourly_rate: e.target.value ? Number(e.target.value) : undefined }))}
                    placeholder="35.00"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/25 focus:outline-none focus:border-indigo-500/50" />
                </div>
                <div>
                  <label className="text-xs text-white/50 mb-1 block">Maandsalaris (€)</label>
                  <input type="number" value={modal.monthly_salary ?? ''} onChange={e => setModal(m => ({ ...m, monthly_salary: e.target.value ? Number(e.target.value) : undefined }))}
                    placeholder="2500"
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
