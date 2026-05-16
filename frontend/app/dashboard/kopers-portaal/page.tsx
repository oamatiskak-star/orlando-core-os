'use client'

import { useCallback, useEffect, useState } from 'react'
import { UserCheck, Home, Plus, Pencil, Trash2, Phone, Mail, Euro, Calendar, Hash } from 'lucide-react'
import clsx from 'clsx'

type Koper = {
  id: string
  type: string
  status: string
  naam: string
  email: string | null
  telefoon: string | null
  adres: string | null
  koopsom: number | null
  huurprijs: number | null
  bouwnummer: string | null
  notaris: string | null
  leverdatum: string | null
  tekendatum: string | null
  opleverdatum: string | null
  project: { id: string; name: string } | null
  notes: string | null
  created_at: string
}

type Project = { id: string; name: string }

const STATUS_COLORS: Record<string, string> = {
  prospect:  'text-sky-400    bg-sky-500/10    border-sky-500/20',
  actief:    'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  afgerond:  'text-white/40   bg-white/5        border-white/10',
  afgevallen:'text-red-400    bg-red-500/10     border-red-500/20',
}

const STATUS_LABELS: Record<string, string> = {
  prospect: 'Prospect', actief: 'Actief', afgerond: 'Afgerond', afgevallen: 'Afgevallen',
}

const EMPTY: Partial<Koper> = {
  naam: '', type: 'koper', email: '', telefoon: '', adres: '', koopsom: undefined,
  huurprijs: undefined, bouwnummer: '', notaris: '', notes: '',
}

function fmt(n: number) {
  return '€ ' + n.toLocaleString('nl-NL', { maximumFractionDigits: 0 })
}

export default function KopersPortaalPage() {
  const [items, setItems]       = useState<Koper[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [total, setTotal]       = useState(0)
  const [typeFilter, setTypeFilter]     = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [modal, setModal]       = useState<Partial<Koper> | null>(null)
  const [saving, setSaving]     = useState(false)
  const [loading, setLoading]   = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const sp = new URLSearchParams()
    if (typeFilter)   sp.set('type', typeFilter)
    if (statusFilter) sp.set('status', statusFilter)
    const [kr, pr] = await Promise.all([
      fetch(`/api/kopers${sp.toString() ? `?${sp}` : ''}`, { cache: 'no-store' }),
      fetch('/api/projects', { cache: 'no-store' }),
    ])
    if (kr.ok) { const d = await kr.json(); setItems(d.kopers ?? []); setTotal(d.total ?? 0) }
    if (pr.ok) { const d = await pr.json(); setProjects(d.projects ?? []) }
    setLoading(false)
  }, [typeFilter, statusFilter])

  useEffect(() => { load() }, [load])

  const save = async () => {
    if (!modal) return
    setSaving(true)
    const isNew  = !modal.id
    const url    = isNew ? '/api/kopers' : `/api/kopers/${modal.id}`
    const method = isNew ? 'POST' : 'PATCH'
    const body: Record<string, unknown> = {
      naam:        modal.naam,
      type:        modal.type ?? 'koper',
      email:       modal.email || null,
      telefoon:    modal.telefoon || null,
      adres:       modal.adres || null,
      koopsom:     modal.koopsom ?? null,
      huurprijs:   modal.huurprijs ?? null,
      bouwnummer:  modal.bouwnummer || null,
      notaris:     modal.notaris || null,
      notes:       modal.notes || null,
    }
    if (!isNew) body.status = modal.status
    const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    if (r.ok) { setModal(null); load() }
    setSaving(false)
  }

  const del = async (id: string) => {
    if (!confirm('Verwijderen?')) return
    await fetch(`/api/kopers/${id}`, { method: 'DELETE' })
    load()
  }

  const kopers   = items.filter(i => i.type === 'koper')
  const huurders = items.filter(i => i.type === 'huurder')
  const actief   = items.filter(i => i.status === 'actief')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-white">Kopers & Huurders Portaal</h1>
          <p className="text-sm text-white/65 mt-0.5">Communicatie, documenten en dossiers per koper of huurder</p>
        </div>
        <button onClick={() => setModal({ ...EMPTY })}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-500/15 border border-indigo-500/20 text-indigo-400 hover:bg-indigo-500/25 transition-colors text-sm">
          <Plus size={14} /> Toevoegen
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Totaal',   value: total,          color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20', icon: UserCheck },
          { label: 'Kopers',   value: kopers.length,  color: 'text-sky-400    bg-sky-500/10    border-sky-500/20',    icon: Home },
          { label: 'Huurders', value: huurders.length,color: 'text-violet-400 bg-violet-500/10 border-violet-500/20', icon: Home },
          { label: 'Actief',   value: actief.length,  color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', icon: UserCheck },
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
      <div className="flex gap-2 flex-wrap">
        <div className="flex gap-1">
          {[
            { v: '', l: 'Alle typen' },
            { v: 'koper', l: 'Kopers' },
            { v: 'huurder', l: 'Huurders' },
          ].map(({ v, l }) => (
            <button key={v} onClick={() => setTypeFilter(v)}
              className={clsx('px-3 py-1 rounded-lg text-xs transition-colors border',
                typeFilter === v ? 'bg-indigo-500/20 border-indigo-500/30 text-indigo-300' : 'bg-white/5 border-white/10 text-white/50 hover:text-white/80'
              )}>{l}</button>
          ))}
        </div>
        <div className="flex gap-1">
          {[
            { v: '',           l: 'Alle statussen' },
            { v: 'prospect',   l: 'Prospect' },
            { v: 'actief',     l: 'Actief' },
            { v: 'afgerond',   l: 'Afgerond' },
            { v: 'afgevallen', l: 'Afgevallen' },
          ].map(({ v, l }) => (
            <button key={v} onClick={() => setStatusFilter(v)}
              className={clsx('px-3 py-1 rounded-lg text-xs transition-colors border',
                statusFilter === v ? 'bg-sky-500/20 border-sky-500/30 text-sky-300' : 'bg-white/5 border-white/10 text-white/50 hover:text-white/80'
              )}>{l}</button>
          ))}
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="text-center py-12 text-white/30 text-sm">Laden...</div>
      ) : items.length === 0 ? (
        <div className="bg-white/[0.04] border border-white/8 rounded-xl p-10 flex flex-col items-center gap-3">
          <UserCheck size={32} className="text-white/20" />
          <p className="text-sm text-white/40">Geen kopers of huurders geregistreerd</p>
          <button onClick={() => setModal({ ...EMPTY })} className="text-xs text-indigo-400 hover:text-indigo-300">Eerste toevoegen</button>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map(k => (
            <div key={k.id} className="group bg-white/[0.06] border border-white/5 rounded-xl p-4 hover:border-white/15 transition-colors">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className={clsx('px-2 py-0.5 rounded-full text-[11px] font-medium border', STATUS_COLORS[k.status] ?? STATUS_COLORS.prospect)}>
                      {STATUS_LABELS[k.status] ?? k.status}
                    </span>
                    <span className={clsx('px-2 py-0.5 rounded-full text-[11px] border',
                      k.type === 'koper' ? 'text-sky-400 bg-sky-500/10 border-sky-500/20' : 'text-violet-400 bg-violet-500/10 border-violet-500/20')}>
                      {k.type}
                    </span>
                    {k.project && (
                      <span className="text-xs text-white/40">{k.project.name}</span>
                    )}
                  </div>
                  <p className="text-sm font-semibold text-white">{k.naam}</p>
                  <div className="flex items-center gap-4 mt-1.5 flex-wrap">
                    {k.koopsom && (
                      <div className="flex items-center gap-1 text-xs text-emerald-400">
                        <Euro size={11} /> <span className="font-medium">{fmt(k.koopsom)}</span>
                      </div>
                    )}
                    {k.huurprijs && (
                      <div className="flex items-center gap-1 text-xs text-violet-400">
                        <Euro size={11} /> <span>{fmt(k.huurprijs)}/mnd</span>
                      </div>
                    )}
                    {k.bouwnummer && (
                      <div className="flex items-center gap-1 text-xs text-white/45">
                        <Hash size={11} /> <span>{k.bouwnummer}</span>
                      </div>
                    )}
                    {k.email && (
                      <div className="flex items-center gap-1 text-xs text-white/45">
                        <Mail size={11} /> <span>{k.email}</span>
                      </div>
                    )}
                    {k.telefoon && (
                      <div className="flex items-center gap-1 text-xs text-white/45">
                        <Phone size={11} /> <span>{k.telefoon}</span>
                      </div>
                    )}
                    {k.opleverdatum && (
                      <div className="flex items-center gap-1 text-xs text-white/45">
                        <Calendar size={11} /> <span>Oplevering: {new Date(k.opleverdatum).toLocaleDateString('nl-NL')}</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <button onClick={() => setModal(k)} className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-colors">
                    <Pencil size={12} />
                  </button>
                  <button onClick={() => del(k.id)} className="p-1.5 rounded-lg hover:bg-red-500/15 text-white/40 hover:text-red-400 transition-colors">
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
              <h2 className="text-base font-semibold text-white">{modal.id ? 'Bewerken' : 'Toevoegen'}</h2>
              <button onClick={() => setModal(null)} className="text-white/40 hover:text-white text-xl leading-none">×</button>
            </div>

            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-white/50 mb-1 block">Naam *</label>
                  <input type="text" value={modal.naam ?? ''} onChange={e => setModal(m => ({ ...m, naam: e.target.value }))}
                    placeholder="Volledige naam"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/25 focus:outline-none focus:border-indigo-500/50" />
                </div>
                <div>
                  <label className="text-xs text-white/50 mb-1 block">Type</label>
                  <select value={modal.type ?? 'koper'} onChange={e => setModal(m => ({ ...m, type: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/50">
                    <option value="koper">Koper</option>
                    <option value="huurder">Huurder</option>
                  </select>
                </div>
              </div>

              {modal.id && (
                <div>
                  <label className="text-xs text-white/50 mb-1 block">Status</label>
                  <select value={modal.status ?? 'prospect'} onChange={e => setModal(m => ({ ...m, status: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/50">
                    <option value="prospect">Prospect</option>
                    <option value="actief">Actief</option>
                    <option value="afgerond">Afgerond</option>
                    <option value="afgevallen">Afgevallen</option>
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-white/50 mb-1 block">E-mail</label>
                  <input type="email" value={modal.email ?? ''} onChange={e => setModal(m => ({ ...m, email: e.target.value }))}
                    placeholder="naam@email.nl"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/25 focus:outline-none focus:border-indigo-500/50" />
                </div>
                <div>
                  <label className="text-xs text-white/50 mb-1 block">Telefoon</label>
                  <input type="tel" value={modal.telefoon ?? ''} onChange={e => setModal(m => ({ ...m, telefoon: e.target.value }))}
                    placeholder="+31 6 ..."
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/25 focus:outline-none focus:border-indigo-500/50" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-white/50 mb-1 block">Koopsom (€)</label>
                  <input type="number" value={modal.koopsom ?? ''} onChange={e => setModal(m => ({ ...m, koopsom: e.target.value ? Number(e.target.value) : undefined }))}
                    placeholder="325000"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/25 focus:outline-none focus:border-indigo-500/50" />
                </div>
                <div>
                  <label className="text-xs text-white/50 mb-1 block">Huurprijs/mnd (€)</label>
                  <input type="number" value={modal.huurprijs ?? ''} onChange={e => setModal(m => ({ ...m, huurprijs: e.target.value ? Number(e.target.value) : undefined }))}
                    placeholder="1500"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/25 focus:outline-none focus:border-indigo-500/50" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-white/50 mb-1 block">Bouwnummer</label>
                  <input type="text" value={modal.bouwnummer ?? ''} onChange={e => setModal(m => ({ ...m, bouwnummer: e.target.value }))}
                    placeholder="A-01"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/25 focus:outline-none focus:border-indigo-500/50" />
                </div>
                <div>
                  <label className="text-xs text-white/50 mb-1 block">Project</label>
                  <select value={(modal as { project_id?: string }).project_id ?? ''} onChange={e => setModal(m => ({ ...m, project_id: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/50">
                    <option value="">— Geen —</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-white/50 mb-1 block">Opleverdatum</label>
                  <input type="date" value={modal.opleverdatum ?? ''} onChange={e => setModal(m => ({ ...m, opleverdatum: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/50" />
                </div>
                <div>
                  <label className="text-xs text-white/50 mb-1 block">Tekendatum</label>
                  <input type="date" value={modal.tekendatum ?? ''} onChange={e => setModal(m => ({ ...m, tekendatum: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/50" />
                </div>
              </div>

              <div>
                <label className="text-xs text-white/50 mb-1 block">Notaris</label>
                <input type="text" value={modal.notaris ?? ''} onChange={e => setModal(m => ({ ...m, notaris: e.target.value }))}
                  placeholder="Notariskantoor ..."
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
              <button onClick={save} disabled={saving || !modal.naam}
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
