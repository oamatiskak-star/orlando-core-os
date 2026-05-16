'use client'

import { useCallback, useEffect, useState } from 'react'
import { Home, Users, MessageSquare, Plus, Pencil, Trash2, MapPin, Phone, ExternalLink, Euro } from 'lucide-react'
import clsx from 'clsx'

type FbDeal = {
  id: string
  group_type: string
  status: string
  title: string
  description: string | null
  asking_price: number | null
  location: string | null
  city: string | null
  contact_name: string | null
  contact_url: string | null
  source_url: string | null
  notes: string | null
  priority: string
  created_at: string
}

const STATUS_COLORS: Record<string, string> = {
  nieuw:           'text-sky-400    bg-sky-500/10    border-sky-500/20',
  contact_gelegd:  'text-violet-400 bg-violet-500/10 border-violet-500/20',
  onderzoek:       'text-amber-400  bg-amber-500/10  border-amber-500/20',
  bod:             'text-orange-400 bg-orange-500/10 border-orange-500/20',
  afgewezen:       'text-white/30   bg-white/5       border-white/10',
  gewonnen:        'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
}

const STATUS_LABELS: Record<string, string> = {
  nieuw: 'Nieuw', contact_gelegd: 'Contact', onderzoek: 'Onderzoek', bod: 'Bod', afgewezen: 'Afgewezen', gewonnen: 'Gewonnen',
}

const PRIO_COLORS: Record<string, string> = {
  laag:   'text-white/40 bg-white/5 border-white/10',
  normaal:'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
  hoog:   'text-red-400  bg-red-500/10  border-red-500/20',
}

const EMPTY: Partial<FbDeal> = {
  title: '', description: '', asking_price: undefined, location: '', city: '',
  contact_name: '', contact_url: '', source_url: '', notes: '', priority: 'normaal',
}

function fmt(n: number) {
  return '€ ' + n.toLocaleString('nl-NL', { maximumFractionDigits: 0 })
}

export default function FBPrivatePropertyPage() {
  const [deals, setDeals]     = useState<FbDeal[]>([])
  const [total, setTotal]     = useState(0)
  const [filter, setFilter]   = useState('')
  const [modal, setModal]     = useState<Partial<FbDeal> | null>(null)
  const [saving, setSaving]   = useState(false)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const sp = new URLSearchParams({ group_type: 'property', limit: '100' })
    if (filter) sp.set('status', filter)
    const r = await fetch(`/api/social/fb-deals?${sp}`, { cache: 'no-store' })
    if (r.ok) {
      const d = await r.json()
      setDeals(d.deals ?? [])
      setTotal(d.total ?? 0)
    }
    setLoading(false)
  }, [filter])

  useEffect(() => { load() }, [load])

  const save = async () => {
    if (!modal) return
    setSaving(true)
    const isNew  = !modal.id
    const url    = isNew ? '/api/social/fb-deals' : `/api/social/fb-deals/${modal.id}`
    const method = isNew ? 'POST' : 'PATCH'
    const body: Record<string, unknown> = {
      group_type:   'property',
      title:        modal.title,
      description:  modal.description || null,
      asking_price: modal.asking_price ? Number(modal.asking_price) : null,
      location:     modal.location || null,
      city:         modal.city || null,
      contact_name: modal.contact_name || null,
      contact_url:  modal.contact_url || null,
      source_url:   modal.source_url || null,
      notes:        modal.notes || null,
      priority:     modal.priority ?? 'normaal',
    }
    if (!isNew) body.status = modal.status
    const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    if (r.ok) { setModal(null); load() }
    setSaving(false)
  }

  const del = async (id: string) => {
    if (!confirm('Deal verwijderen?')) return
    await fetch(`/api/social/fb-deals/${id}`, { method: 'DELETE' })
    load()
  }

  const countByStatus = (s: string) => deals.filter(d => d.status === s).length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-white">FB Private Property NL</h1>
          <p className="text-sm text-white/65 mt-0.5">Privé vastgoednetwerk — investeerders en verkopers</p>
        </div>
        <button
          onClick={() => setModal({ ...EMPTY })}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-500/15 border border-indigo-500/20 text-indigo-400 hover:bg-indigo-500/25 transition-colors text-sm"
        >
          <Plus size={14} /> Aanbod toevoegen
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Totaal',      value: total,                     icon: Home,          color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20' },
          { label: 'Nieuw',       value: countByStatus('nieuw'),    icon: MessageSquare, color: 'text-sky-400    bg-sky-500/10    border-sky-500/20' },
          { label: 'In behandeling', value: countByStatus('onderzoek') + countByStatus('contact_gelegd') + countByStatus('bod'), icon: Users, color: 'text-amber-400  bg-amber-500/10  border-amber-500/20' },
          { label: 'Gewonnen',    value: countByStatus('gewonnen'), icon: Home,           color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
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
          { v: '',               l: 'Alle' },
          { v: 'nieuw',          l: 'Nieuw' },
          { v: 'contact_gelegd', l: 'Contact' },
          { v: 'onderzoek',      l: 'Onderzoek' },
          { v: 'bod',            l: 'Bod' },
          { v: 'gewonnen',       l: 'Gewonnen' },
          { v: 'afgewezen',      l: 'Afgewezen' },
        ].map(({ v, l }) => (
          <button
            key={v}
            onClick={() => setFilter(v)}
            className={clsx(
              'px-3 py-1 rounded-lg text-xs transition-colors border',
              filter === v
                ? 'bg-indigo-500/20 border-indigo-500/30 text-indigo-300'
                : 'bg-white/5 border-white/10 text-white/50 hover:text-white/80'
            )}
          >{l}</button>
        ))}
      </div>

      {/* Deals list */}
      {loading ? (
        <div className="text-center py-12 text-white/30 text-sm">Laden...</div>
      ) : deals.length === 0 ? (
        <div className="bg-white/[0.04] border border-white/8 rounded-xl p-10 flex flex-col items-center gap-3">
          <Home size={32} className="text-white/20" />
          <p className="text-sm text-white/40">Nog geen aanbod geregistreerd</p>
          <button onClick={() => setModal({ ...EMPTY })} className="text-xs text-indigo-400 hover:text-indigo-300">Eerste aanbod toevoegen</button>
        </div>
      ) : (
        <div className="space-y-3">
          {deals.map(d => (
            <div key={d.id} className="group bg-white/[0.06] border border-white/5 rounded-xl p-4 hover:border-white/15 transition-colors">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className={clsx('px-2 py-0.5 rounded-full text-[11px] font-medium border', STATUS_COLORS[d.status] ?? STATUS_COLORS.nieuw)}>
                      {STATUS_LABELS[d.status] ?? d.status}
                    </span>
                    <span className={clsx('px-2 py-0.5 rounded-full text-[11px] border', PRIO_COLORS[d.priority] ?? PRIO_COLORS.normaal)}>
                      {d.priority}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-white truncate">{d.title}</p>
                  {d.description && (
                    <p className="text-xs text-white/55 mt-0.5 line-clamp-2">{d.description}</p>
                  )}
                  <div className="flex items-center gap-4 mt-2 flex-wrap">
                    {d.asking_price && (
                      <div className="flex items-center gap-1 text-xs text-emerald-400">
                        <Euro size={11} />
                        <span className="font-medium">{fmt(d.asking_price)}</span>
                      </div>
                    )}
                    {(d.city || d.location) && (
                      <div className="flex items-center gap-1 text-xs text-white/50">
                        <MapPin size={11} />
                        <span>{d.city ?? d.location}</span>
                      </div>
                    )}
                    {d.contact_name && (
                      <div className="flex items-center gap-1 text-xs text-white/50">
                        <Phone size={11} />
                        <span>{d.contact_name}</span>
                      </div>
                    )}
                    {d.source_url && (
                      <a href={d.source_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300">
                        <ExternalLink size={11} />
                        <span>Bron</span>
                      </a>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <button onClick={() => setModal(d)} className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-colors">
                    <Pencil size={12} />
                  </button>
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
              <h2 className="text-base font-semibold text-white">{modal.id ? 'Aanbod bewerken' : 'Aanbod toevoegen'}</h2>
              <button onClick={() => setModal(null)} className="text-white/40 hover:text-white text-xl leading-none">×</button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs text-white/50 mb-1 block">Titel *</label>
                <input
                  type="text"
                  value={modal.title ?? ''}
                  onChange={e => setModal(m => ({ ...m, title: e.target.value }))}
                  placeholder="Omschrijving van het aanbod"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/25 focus:outline-none focus:border-indigo-500/50"
                />
              </div>

              <div>
                <label className="text-xs text-white/50 mb-1 block">Beschrijving</label>
                <textarea
                  rows={3}
                  value={modal.description ?? ''}
                  onChange={e => setModal(m => ({ ...m, description: e.target.value }))}
                  placeholder="Details over het aanbod..."
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/25 focus:outline-none focus:border-indigo-500/50 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-white/50 mb-1 block">Vraagprijs (€)</label>
                  <input
                    type="number"
                    value={modal.asking_price ?? ''}
                    onChange={e => setModal(m => ({ ...m, asking_price: e.target.value ? Number(e.target.value) : undefined }))}
                    placeholder="350000"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/25 focus:outline-none focus:border-indigo-500/50"
                  />
                </div>
                <div>
                  <label className="text-xs text-white/50 mb-1 block">Stad</label>
                  <input
                    type="text"
                    value={modal.city ?? ''}
                    onChange={e => setModal(m => ({ ...m, city: e.target.value }))}
                    placeholder="Rotterdam"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/25 focus:outline-none focus:border-indigo-500/50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-white/50 mb-1 block">Prioriteit</label>
                  <select
                    value={modal.priority ?? 'normaal'}
                    onChange={e => setModal(m => ({ ...m, priority: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/50"
                  >
                    <option value="laag">Laag</option>
                    <option value="normaal">Normaal</option>
                    <option value="hoog">Hoog</option>
                  </select>
                </div>
                {modal.id && (
                  <div>
                    <label className="text-xs text-white/50 mb-1 block">Status</label>
                    <select
                      value={modal.status ?? 'nieuw'}
                      onChange={e => setModal(m => ({ ...m, status: e.target.value }))}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/50"
                    >
                      <option value="nieuw">Nieuw</option>
                      <option value="contact_gelegd">Contact gelegd</option>
                      <option value="onderzoek">Onderzoek</option>
                      <option value="bod">Bod</option>
                      <option value="gewonnen">Gewonnen</option>
                      <option value="afgewezen">Afgewezen</option>
                    </select>
                  </div>
                )}
              </div>

              <div>
                <label className="text-xs text-white/50 mb-1 block">Contact naam</label>
                <input
                  type="text"
                  value={modal.contact_name ?? ''}
                  onChange={e => setModal(m => ({ ...m, contact_name: e.target.value }))}
                  placeholder="Naam investeerder / verkoper"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/25 focus:outline-none focus:border-indigo-500/50"
                />
              </div>

              <div>
                <label className="text-xs text-white/50 mb-1 block">FB Bron URL</label>
                <input
                  type="url"
                  value={modal.source_url ?? ''}
                  onChange={e => setModal(m => ({ ...m, source_url: e.target.value }))}
                  placeholder="https://facebook.com/groups/..."
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/25 focus:outline-none focus:border-indigo-500/50"
                />
              </div>

              <div>
                <label className="text-xs text-white/50 mb-1 block">Notities</label>
                <textarea
                  rows={2}
                  value={modal.notes ?? ''}
                  onChange={e => setModal(m => ({ ...m, notes: e.target.value }))}
                  placeholder="Interne notities..."
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/25 focus:outline-none focus:border-indigo-500/50 resize-none"
                />
              </div>
            </div>

            <div className="sticky bottom-0 bg-[#111] border-t border-white/8 px-5 py-4 flex justify-end gap-3">
              <button onClick={() => setModal(null)} className="px-4 py-2 rounded-lg text-sm text-white/50 hover:text-white hover:bg-white/5 transition-colors">Annuleren</button>
              <button
                onClick={save}
                disabled={saving || !modal.title}
                className="px-4 py-2 rounded-lg text-sm bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/30 transition-colors disabled:opacity-50"
              >
                {saving ? 'Opslaan...' : 'Opslaan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
