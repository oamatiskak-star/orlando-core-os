'use client'

import { useState, useEffect, useCallback } from 'react'
import { Users, UserPlus, Shield, Pencil, Trash2, X } from 'lucide-react'
import clsx from 'clsx'

type Gebruiker = {
  id: string
  user_id: string | null
  email: string
  naam: string | null
  role: string
  telegram_chat_id: string | null
  whatsapp_number: string | null
  alert_email: string | null
  created_at: string
}

const ROLES = ['SUPER_ADMIN', 'ADMIN', 'PROJECT_MANAGER', 'ACCOUNTING', 'CLIENT', 'AGENT', 'EXECUTOR']

const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN:     'bg-indigo-500/10 text-indigo-400',
  ADMIN:           'bg-sky-500/10 text-sky-400',
  PROJECT_MANAGER: 'bg-emerald-500/10 text-emerald-400',
  ACCOUNTING:      'bg-amber-500/10 text-amber-400',
  CLIENT:          'bg-purple-500/10 text-purple-400',
  AGENT:           'bg-pink-500/10 text-pink-400',
  EXECUTOR:        'bg-orange-500/10 text-orange-400',
}

const ROLE_DESCRIPTIONS: Record<string, string> = {
  SUPER_ADMIN:     'Volledige toegang tot alle modules, BVs en systeeminstellingen.',
  ADMIN:           'Toegang tot alle modules binnen toegewezen BV, geen systeeminstellingen.',
  PROJECT_MANAGER: 'Projecten, taken en planning beheren. Geen financiële toegang.',
  ACCOUNTING:      'Financiën, facturen en administratie inzien en bewerken.',
  CLIENT:          'Alleen kopersportaal en eigen documenten inzien.',
  AGENT:           'AI-agent entiteit. Geen UI-toegang, alleen API-acties.',
  EXECUTOR:        'Executor-systeem. Voert taken uit vanuit de task queue.',
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('nl-NL', { day: '2-digit', month: 'short', year: 'numeric' })
}

const EMPTY_FORM = { email: '', naam: '', role: 'ADMIN', telegram_chat_id: '', whatsapp_number: '', alert_email: '' }

export default function GebruikersPage() {
  const [items, setItems]         = useState<Gebruiker[]>([])
  const [loading, setLoading]     = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing]     = useState<Gebruiker | null>(null)
  const [form, setForm]           = useState({ ...EMPTY_FORM })
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/gebruikers')
      if (res.ok) { const j = await res.json(); setItems(j.gebruikers ?? []) }
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  function openNew() {
    setEditing(null); setForm({ ...EMPTY_FORM }); setError(''); setShowModal(true)
  }

  function openEdit(g: Gebruiker) {
    setEditing(g)
    setForm({
      email:            g.email,
      naam:             g.naam ?? '',
      role:             g.role,
      telegram_chat_id: g.telegram_chat_id ?? '',
      whatsapp_number:  g.whatsapp_number ?? '',
      alert_email:      g.alert_email ?? '',
    })
    setError(''); setShowModal(true)
  }

  async function save() {
    if (!form.email.trim()) { setError('E-mail is verplicht'); return }
    setSaving(true); setError('')
    try {
      const body = {
        email:            form.email.trim(),
        naam:             form.naam || null,
        role:             form.role,
        telegram_chat_id: form.telegram_chat_id || null,
        whatsapp_number:  form.whatsapp_number || null,
        alert_email:      form.alert_email || null,
      }
      let res: Response
      if (editing) {
        res = await fetch(`/api/gebruikers/${editing.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      } else {
        res = await fetch('/api/gebruikers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      }
      if (!res.ok) { const j = await res.json(); setError(j.error ?? 'Fout'); return }
      setShowModal(false); await load()
    } finally { setSaving(false) }
  }

  async function del(id: string, email: string) {
    if (!confirm(`Gebruiker ${email} verwijderen?`)) return
    await fetch(`/api/gebruikers/${id}`, { method: 'DELETE' })
    await load()
  }

  const initials = (g: Gebruiker) => {
    const name = g.naam || g.email
    return name.split(/[\s@]/).map(n => n[0]).slice(0, 2).join('').toUpperCase()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
            <Users size={16} className="text-blue-400" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-white">Gebruikers</h1>
            <p className="text-xs text-white/50">Gebruikersbeheer, rollen en rechten per bedrijf.</p>
          </div>
        </div>
        <button onClick={openNew} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium px-4 py-2 rounded-lg transition-colors">
          <UserPlus size={13} /> Gebruiker toevoegen
        </button>
      </div>

      <div className="bg-white/[0.06] border border-white/5 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Actieve gebruikers</h2>
          <span className="text-[11px] text-white/40">{loading ? '…' : items.length} gebruiker{items.length !== 1 ? 's' : ''}</span>
        </div>
        {loading ? (
          <div className="p-8 text-center text-xs text-white/40">Laden…</div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-xs text-white/40">Geen gebruikers gevonden</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  {['Gebruiker', 'E-mail', 'Rol', 'Aangemeld', 'Acties'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-[10px] font-medium text-white/50 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((g) => (
                  <tr key={g.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center text-[10px] font-semibold text-white flex-shrink-0">
                          {initials(g)}
                        </div>
                        <span className="text-xs text-white font-medium">{g.naam || '—'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-white/50">{g.email}</td>
                    <td className="px-4 py-3">
                      <span className={clsx('px-2 py-0.5 rounded-full text-[10px] font-semibold', ROLE_COLORS[g.role] ?? 'bg-white/5 text-white/50')}>
                        {g.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-white/50">{fmtDate(g.created_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button onClick={() => openEdit(g)} className="w-7 h-7 rounded-lg border border-white/10 flex items-center justify-center text-white/65 hover:text-white hover:border-white/20 transition-colors">
                          <Pencil size={11} />
                        </button>
                        <button onClick={() => del(g.id, g.email)} className="w-7 h-7 rounded-lg border border-white/10 flex items-center justify-center text-white/65 hover:text-red-400 hover:border-red-500/30 transition-colors">
                          <Trash2 size={11} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-white/[0.06] border border-white/5 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Shield size={14} className="text-white/65" />
          <h2 className="text-sm font-semibold text-white">Rollen &amp; Rechten</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {ROLES.map(role => (
            <div key={role} className="bg-white/[0.02] border border-white/5 rounded-xl p-3.5 flex flex-col gap-2">
              <span className={clsx('self-start px-2 py-0.5 rounded-full text-[10px] font-semibold', ROLE_COLORS[role])}>
                {role}
              </span>
              <p className="text-[11px] text-white/65 leading-relaxed">{ROLE_DESCRIPTIONS[role]}</p>
            </div>
          ))}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#0f1117] border border-white/10 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-white/5">
              <h2 className="text-sm font-semibold text-white">{editing ? 'Gebruiker bewerken' : 'Gebruiker toevoegen'}</h2>
              <button onClick={() => setShowModal(false)}><X size={16} className="text-white/50 hover:text-white" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-white/50 mb-1.5">E-mail *</label>
                  <input className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-indigo-500"
                    placeholder="naam@bedrijf.nl" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-[11px] text-white/50 mb-1.5">Naam</label>
                  <input className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-indigo-500"
                    placeholder="Voor- en achternaam" value={form.naam} onChange={e => setForm(f => ({ ...f, naam: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="block text-[11px] text-white/50 mb-1.5">Rol</label>
                <select className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                  {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
                <p className="mt-1.5 text-[11px] text-white/40">{ROLE_DESCRIPTIONS[form.role]}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-white/50 mb-1.5">Telegram chat ID</label>
                  <input className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-indigo-500"
                    placeholder="-1001234567" value={form.telegram_chat_id} onChange={e => setForm(f => ({ ...f, telegram_chat_id: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-[11px] text-white/50 mb-1.5">Alert e-mail</label>
                  <input className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-indigo-500"
                    placeholder="alerts@bedrijf.nl" value={form.alert_email} onChange={e => setForm(f => ({ ...f, alert_email: e.target.value }))} />
                </div>
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
