'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Users, UserPlus, Search, X, Pencil, Trash2,
  Mail, Building2, Tag, RefreshCw, ChevronLeft, ChevronRight,
} from 'lucide-react'
import clsx from 'clsx'

interface Contact {
  id: string
  email: string
  name: string | null
  company: string | null
  contact_type: string | null
  priority: string
  total_interactions: number
  last_interaction_at: string | null
  payment_status: string | null
  open_actions: number
  sentiment: string | null
  notes: string | null
  created_at: string
}

const CONTACT_TYPES = ['klant', 'lead', 'leverancier', 'partner', 'overig']
const PRIORITIES    = ['hoog', 'normaal', 'laag']
const PAGE_SIZE     = 50

const priorityColor: Record<string, string> = {
  hoog:    'bg-red-500/15 text-red-400',
  normaal: 'bg-white/[0.08] text-white/65',
  laag:    'bg-white/5 text-white/38',
}

const typeColor: Record<string, string> = {
  klant:       'bg-emerald-500/15 text-emerald-400',
  lead:        'bg-indigo-500/15 text-indigo-400',
  leverancier: 'bg-amber-500/15 text-amber-400',
  partner:     'bg-purple-500/15 text-purple-400',
  overig:      'bg-white/[0.08] text-white/50',
}

const sentimentColor: Record<string, string> = {
  positief: 'text-emerald-400',
  neutraal: 'text-white/50',
  negatief: 'text-red-400',
}

function fmtDate(s: string | null) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })
}

const EMPTY: Partial<Contact> = { name: '', email: '', company: '', contact_type: 'overig', priority: 'normaal', notes: '' }

export default function CrmPage() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [total, setTotal]       = useState(0)
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [prioFilter, setPrioFilter] = useState('')
  const [page, setPage]         = useState(0)

  const [modal, setModal]       = useState<'add' | 'edit' | null>(null)
  const [form, setForm]         = useState<Partial<Contact>>(EMPTY)
  const [saving, setSaving]     = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [formError, setFormError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const sp = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(page * PAGE_SIZE) })
      if (search)     sp.set('search', search)
      if (typeFilter) sp.set('type', typeFilter)
      if (prioFilter) sp.set('priority', prioFilter)
      const r = await fetch(`/api/crm/contacts?${sp}`, { cache: 'no-store' })
      if (r.ok) { const d = await r.json(); setContacts(d.contacts ?? []); setTotal(d.total ?? 0) }
    } finally { setLoading(false) }
  }, [search, typeFilter, prioFilter, page])

  useEffect(() => { load() }, [load])

  function openAdd() { setForm(EMPTY); setFormError(''); setModal('add') }
  function openEdit(c: Contact) { setForm({ ...c }); setFormError(''); setModal('edit') }

  async function saveContact() {
    setSaving(true); setFormError('')
    try {
      const isEdit = modal === 'edit' && form.id
      const r = await fetch(isEdit ? `/api/crm/contacts/${form.id}` : '/api/crm/contacts', {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!r.ok) { const d = await r.json(); setFormError(d.error ?? 'Opslaan mislukt'); return }
      setModal(null); load()
    } finally { setSaving(false) }
  }

  async function deleteContact(id: string) {
    setDeleting(id)
    try { await fetch(`/api/crm/contacts/${id}`, { method: 'DELETE' }); load() }
    finally { setDeleting(null) }
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)
  const highPrio   = contacts.filter(c => c.priority === 'hoog').length
  const openActions = contacts.reduce((s, c) => s + (c.open_actions ?? 0), 0)
  const clients    = contacts.filter(c => c.contact_type === 'klant').length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center">
            <Users size={16} className="text-pink-400" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-white">CRM</h1>
            <p className="text-xs text-white/50">Contacten, klanten en leads per bedrijf.</p>
          </div>
        </div>
        <button onClick={openAdd} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium px-4 py-2 rounded-lg transition-colors">
          <UserPlus size={13} />
          Nieuw contact
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Totaal',          value: total,       color: 'text-white' },
          { label: 'Klanten',         value: clients,     color: 'text-emerald-400' },
          { label: 'Hoge prioriteit', value: highPrio,    color: 'text-red-400' },
          { label: 'Open acties',     value: openActions, color: 'text-amber-400' },
        ].map(s => (
          <div key={s.label} className="bg-white/[0.06] border border-white/5 rounded-xl p-4">
            <p className="text-[11px] text-white/50 mb-1">{s.label}</p>
            <p className={clsx('text-2xl font-semibold', s.color)}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/38 pointer-events-none" />
          <input
            type="text"
            placeholder="Zoek op naam, e-mail of bedrijf…"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0) }}
            className="w-full bg-white/[0.06] border border-white/8 rounded-lg pl-8 pr-8 py-2 text-xs text-white placeholder:text-white/38 focus:outline-none focus:border-indigo-500/60"
          />
          {search && (
            <button onClick={() => { setSearch(''); setPage(0) }} className="absolute right-2 top-1/2 -translate-y-1/2 text-white/38 hover:text-white/65">
              <X size={12} />
            </button>
          )}
        </div>
        <select value={typeFilter} onChange={e => { setTypeFilter(e.target.value); setPage(0) }}
          className="bg-white/[0.06] border border-white/8 rounded-lg px-3 py-2 text-xs text-white/80 focus:outline-none focus:border-indigo-500/60">
          <option value="">Alle types</option>
          {CONTACT_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
        </select>
        <select value={prioFilter} onChange={e => { setPrioFilter(e.target.value); setPage(0) }}
          className="bg-white/[0.06] border border-white/8 rounded-lg px-3 py-2 text-xs text-white/80 focus:outline-none focus:border-indigo-500/60">
          <option value="">Alle prioriteiten</option>
          {PRIORITIES.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
        </select>
        <button onClick={load} className="p-2 rounded-lg bg-white/[0.06] border border-white/8 text-white/50 hover:text-white transition-colors">
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Table */}
      <div className="bg-white/[0.06] border border-white/5 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                {['Contact', 'Bedrijf', 'Type', 'Prioriteit', 'Interacties', 'Laatste contact', 'Sentiment', ''].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-[10px] font-medium text-white/50 uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && contacts.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-16 text-center text-xs text-white/38">Laden…</td></tr>
              ) : contacts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-16">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center"><Users size={18} className="text-white/38" /></div>
                      <p className="text-sm text-white/50">Geen contacten gevonden</p>
                      <p className="text-[11px] text-white/38">Voeg een contact toe of pas je zoekopdracht aan.</p>
                    </div>
                  </td>
                </tr>
              ) : contacts.map(c => (
                <tr key={c.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors group">
                  <td className="px-4 py-3 min-w-[160px]">
                    <p className="text-xs font-medium text-white/90 truncate max-w-[150px]">{c.name ?? '—'}</p>
                    <p className="text-[10px] text-white/38 mt-0.5 truncate max-w-[150px]">{c.email}</p>
                  </td>
                  <td className="px-4 py-3 text-xs text-white/65 max-w-[130px]">
                    <span className="flex items-center gap-1.5 truncate">
                      {c.company && <Building2 size={11} className="text-white/38 shrink-0" />}
                      {c.company ?? '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={clsx('px-2 py-0.5 rounded-full text-[10px] font-medium', typeColor[c.contact_type ?? 'overig'] ?? typeColor.overig)}>
                      {c.contact_type ?? 'overig'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={clsx('px-2 py-0.5 rounded-full text-[10px] font-semibold', priorityColor[c.priority] ?? priorityColor.normaal)}>
                      {c.priority}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-white/65 text-center">{c.total_interactions}</td>
                  <td className="px-4 py-3 text-xs text-white/50 whitespace-nowrap">{fmtDate(c.last_interaction_at)}</td>
                  <td className="px-4 py-3 text-xs">
                    <span className={clsx('font-medium', sentimentColor[c.sentiment ?? 'neutraal'] ?? sentimentColor.neutraal)}>
                      {c.sentiment ?? '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openEdit(c)} className="p-1.5 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-colors"><Pencil size={12} /></button>
                      <button onClick={() => deleteContact(c.id)} disabled={deleting === c.id} className="p-1.5 rounded-lg hover:bg-red-500/15 text-white/50 hover:text-red-400 transition-colors"><Trash2 size={12} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-white/5">
            <p className="text-[11px] text-white/38">{page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} van {total}</p>
            <div className="flex items-center gap-1">
              <button disabled={page === 0} onClick={() => setPage(p => p - 1)} className="p-1.5 rounded-lg border border-white/8 text-white/50 hover:text-white disabled:opacity-30 transition-colors"><ChevronLeft size={13} /></button>
              <span className="text-xs text-white/50 px-2">{page + 1} / {totalPages}</span>
              <button disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)} className="p-1.5 rounded-lg border border-white/8 text-white/50 hover:text-white disabled:opacity-30 transition-colors"><ChevronRight size={13} /></button>
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/8">
              <h2 className="text-sm font-semibold text-white">{modal === 'edit' ? 'Contact bewerken' : 'Nieuw contact'}</h2>
              <button onClick={() => setModal(null)} className="text-white/38 hover:text-white transition-colors"><X size={16} /></button>
            </div>
            <div className="p-6 space-y-4">
              {formError && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{formError}</p>}
              {([
                { key: 'name',    label: 'Naam',    Icon: Users,     type: 'text',  ph: 'Orlando Amatiskak' },
                { key: 'email',   label: 'E-mail',  Icon: Mail,      type: 'email', ph: 'info@bedrijf.nl' },
                { key: 'company', label: 'Bedrijf', Icon: Building2, type: 'text',  ph: 'STRKBEHEER BV' },
              ] as const).map(({ key, label, Icon, type, ph }) => (
                <div key={key}>
                  <label className="block text-[11px] text-white/50 mb-1.5">{label}</label>
                  <div className="relative">
                    <Icon size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/38 pointer-events-none" />
                    <input type={type} placeholder={ph} value={(form as Record<string, string>)[key] ?? ''}
                      onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                      className="w-full bg-white/[0.06] border border-white/8 rounded-lg pl-8 pr-3 py-2 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-indigo-500/60" />
                  </div>
                </div>
              ))}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-white/50 mb-1.5">Type</label>
                  <select value={form.contact_type ?? 'overig'} onChange={e => setForm(f => ({ ...f, contact_type: e.target.value }))}
                    className="w-full bg-white/[0.06] border border-white/8 rounded-lg px-3 py-2 text-xs text-white/80 focus:outline-none focus:border-indigo-500/60">
                    {CONTACT_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] text-white/50 mb-1.5">Prioriteit</label>
                  <select value={form.priority ?? 'normaal'} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
                    className="w-full bg-white/[0.06] border border-white/8 rounded-lg px-3 py-2 text-xs text-white/80 focus:outline-none focus:border-indigo-500/60">
                    {PRIORITIES.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[11px] text-white/50 mb-1.5">Notities</label>
                <textarea rows={3} placeholder="Aanvullende informatie…" value={form.notes ?? ''}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  className="w-full bg-white/[0.06] border border-white/8 rounded-lg px-3 py-2 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-indigo-500/60 resize-none" />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/8">
              <button onClick={() => setModal(null)} className="px-4 py-2 rounded-lg border border-white/10 text-white/65 hover:text-white text-xs transition-colors">Annuleren</button>
              <button onClick={saveContact} disabled={saving || !form.email}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-medium transition-colors">
                {saving ? <RefreshCw size={12} className="animate-spin" /> : <Tag size={12} />}
                {modal === 'edit' ? 'Opslaan' : 'Toevoegen'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
