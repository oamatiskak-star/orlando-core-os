'use client'

import { useState, useEffect, useCallback } from 'react'
import { CreditCard, Plus, X, AlertTriangle } from 'lucide-react'
import clsx from 'clsx'

type Abonnement = {
  id: string
  name: string
  company_id: string | null
  category: string
  amount_monthly: number | null
  amount_yearly: number | null
  billing_cycle: string
  next_billing_date: string | null
  is_active: boolean
  is_essential: boolean
  notes: string | null
}

const CATEGORIES    = ['software', 'hosting', 'media', 'tools', 'overig']
const BILLING_CYCLES = ['monthly', 'yearly', 'quarterly', 'one_time']

const BILLING_LABELS: Record<string, string> = {
  monthly: 'Maandelijks', yearly: 'Jaarlijks', quarterly: 'Per kwartaal', one_time: 'Eenmalig',
}

const CATEGORY_COLORS: Record<string, string> = {
  software: 'bg-indigo-500/10 text-indigo-400',
  hosting:  'bg-sky-500/10 text-sky-400',
  media:    'bg-purple-500/10 text-purple-400',
  tools:    'bg-amber-500/10 text-amber-400',
  overig:   'bg-white/5 text-white/60',
}

function fmtEur(n: number | null) {
  if (n == null) return '—'
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(n)
}

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('nl-NL', { day: '2-digit', month: 'short', year: 'numeric' })
}

function isExpiringSoon(dateStr: string | null) {
  if (!dateStr) return false
  const diff = new Date(dateStr).getTime() - Date.now()
  return diff > 0 && diff < 14 * 86400_000
}

const EMPTY_FORM = { name: '', company_id: '', category: 'software', amount_monthly: '', amount_yearly: '', billing_cycle: 'monthly', next_billing_date: '', is_essential: false, notes: '' }

export default function AbonnementenPage() {
  const [items, setItems]         = useState<Abonnement[]>([])
  const [loading, setLoading]     = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing]     = useState<Abonnement | null>(null)
  const [form, setForm]           = useState({ ...EMPTY_FORM })
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/abonnementen')
      if (res.ok) { const j = await res.json(); setItems(j.abonnementen ?? []) }
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const active       = items.filter(a => a.is_active)
  const totalMonthly = active.reduce((s, a) => s + (a.amount_monthly ?? (a.amount_yearly ? a.amount_yearly / 12 : 0)), 0)
  const totalYearly  = totalMonthly * 12

  function openNew() {
    setEditing(null); setForm({ ...EMPTY_FORM }); setError(''); setShowModal(true)
  }

  function openEdit(a: Abonnement) {
    setEditing(a)
    setForm({
      name:              a.name,
      company_id:        a.company_id ?? '',
      category:          a.category,
      amount_monthly:    a.amount_monthly?.toString() ?? '',
      amount_yearly:     a.amount_yearly?.toString() ?? '',
      billing_cycle:     a.billing_cycle,
      next_billing_date: a.next_billing_date ?? '',
      is_essential:      a.is_essential,
      notes:             a.notes ?? '',
    })
    setError(''); setShowModal(true)
  }

  async function save() {
    if (!form.name.trim()) { setError('Naam is verplicht'); return }
    setSaving(true); setError('')
    try {
      const body = {
        name:              form.name.trim(),
        company_id:        form.company_id || null,
        category:          form.category,
        amount_monthly:    form.amount_monthly ? Number(form.amount_monthly) : null,
        amount_yearly:     form.amount_yearly ? Number(form.amount_yearly) : null,
        billing_cycle:     form.billing_cycle,
        next_billing_date: form.next_billing_date || null,
        is_essential:      form.is_essential,
        notes:             form.notes || null,
      }
      let res: Response
      if (editing) {
        res = await fetch(`/api/abonnementen/${editing.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      } else {
        res = await fetch('/api/abonnementen', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      }
      if (!res.ok) { const j = await res.json(); setError(j.error ?? 'Fout'); return }
      setShowModal(false); await load()
    } finally { setSaving(false) }
  }

  async function toggleActive(a: Abonnement) {
    await fetch(`/api/abonnementen/${a.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_active: !a.is_active }) })
    await load()
  }

  async function del(id: string) {
    if (!confirm('Abonnement verwijderen?')) return
    await fetch(`/api/abonnementen/${id}`, { method: 'DELETE' })
    await load()
  }

  const renderRow = (a: Abonnement) => (
    <tr key={a.id} className={clsx('border-b border-white/5 hover:bg-white/[0.02] transition-colors', !a.is_active && 'opacity-45')}>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-[11px] font-bold text-white/70 flex-shrink-0">
            {a.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-xs text-white/80 font-medium">{a.name}</p>
            {a.is_essential && <span className="text-[10px] text-amber-400">Essentieel</span>}
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <span className={clsx('px-2 py-0.5 rounded-full text-[10px] font-semibold', CATEGORY_COLORS[a.category] ?? CATEGORY_COLORS.overig)}>
          {a.category}
        </span>
      </td>
      <td className="px-4 py-3 text-xs text-white/50">{BILLING_LABELS[a.billing_cycle] ?? a.billing_cycle}</td>
      <td className="px-4 py-3 text-xs text-white/70 font-mono">{fmtEur(a.amount_monthly ?? (a.amount_yearly ? a.amount_yearly / 12 : null))}</td>
      <td className="px-4 py-3 text-xs text-white/70 font-mono">{fmtEur(a.amount_yearly ?? (a.amount_monthly ? a.amount_monthly * 12 : null))}</td>
      <td className="px-4 py-3">
        <span className={clsx('text-xs', isExpiringSoon(a.next_billing_date) ? 'text-amber-400 font-medium' : 'text-white/50')}>
          {isExpiringSoon(a.next_billing_date) && <AlertTriangle size={10} className="inline mr-1" />}
          {fmtDate(a.next_billing_date)}
        </span>
      </td>
      <td className="px-4 py-3">
        <span className={clsx('px-2 py-0.5 rounded-full text-[10px] font-medium', a.is_active ? 'bg-green-500/10 text-green-400' : 'bg-white/5 text-white/40')}>
          {a.is_active ? 'Actief' : 'Inactief'}
        </span>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <button onClick={() => openEdit(a)} className="text-[11px] text-white/40 hover:text-white transition-colors">Bewerk</button>
          <button onClick={() => toggleActive(a)} className="text-[11px] text-white/40 hover:text-amber-400 transition-colors">{a.is_active ? 'Pauzeer' : 'Activeer'}</button>
          <button onClick={() => del(a.id)} className="text-[11px] text-red-400/50 hover:text-red-400 transition-colors">✕</button>
        </div>
      </td>
    </tr>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
            <CreditCard size={16} className="text-purple-400" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-white">Abonnementen</h1>
            <p className="text-xs text-white/50">SaaS-abonnementen, licenties en terugkerende kosten.</p>
          </div>
        </div>
        <button onClick={openNew} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium px-4 py-2 rounded-lg transition-colors">
          <Plus size={13} /> Nieuw abonnement
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Actieve abonnementen', value: loading ? '…' : String(active.length),     color: 'text-white' },
          { label: 'Maandelijkse kosten',  value: loading ? '…' : fmtEur(totalMonthly),      color: 'text-purple-400' },
          { label: 'Jaarlijkse kosten',    value: loading ? '…' : fmtEur(totalYearly),       color: 'text-purple-300' },
        ].map(s => (
          <div key={s.label} className="bg-white/[0.06] border border-white/5 rounded-xl p-4">
            <p className="text-[11px] text-white/50 mb-1">{s.label}</p>
            <p className={`text-xl font-semibold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white/[0.06] border border-white/5 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-xs text-white/40">Laden…</div>
        ) : items.length === 0 ? (
          <div className="p-10 flex flex-col items-center gap-3">
            <CreditCard size={28} className="text-white/20" />
            <p className="text-xs text-white/40">Geen abonnementen gevonden</p>
            <button onClick={openNew} className="text-xs text-indigo-400 hover:text-indigo-300">+ Eerste abonnement toevoegen</button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  {['Product', 'Categorie', 'Cyclus', 'Per maand', 'Per jaar', 'Verlenging', 'Status', ''].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-[10px] font-medium text-white/50 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>{items.map(renderRow)}</tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#0f1117] border border-white/10 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-white/5">
              <h2 className="text-sm font-semibold text-white">{editing ? 'Abonnement bewerken' : 'Nieuw abonnement'}</h2>
              <button onClick={() => setShowModal(false)}><X size={16} className="text-white/50 hover:text-white" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-[11px] text-white/50 mb-1.5">Naam *</label>
                <input className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-indigo-500"
                  placeholder="bijv. Vercel Pro" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-white/50 mb-1.5">Categorie</label>
                  <select className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                    value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase()+c.slice(1)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] text-white/50 mb-1.5">Factuurcyclus</label>
                  <select className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                    value={form.billing_cycle} onChange={e => setForm(f => ({ ...f, billing_cycle: e.target.value }))}>
                    {BILLING_CYCLES.map(b => <option key={b} value={b}>{BILLING_LABELS[b]}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-white/50 mb-1.5">Per maand (€)</label>
                  <input type="number" step="0.01" className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-indigo-500"
                    placeholder="0.00" value={form.amount_monthly} onChange={e => setForm(f => ({ ...f, amount_monthly: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-[11px] text-white/50 mb-1.5">Per jaar (€)</label>
                  <input type="number" step="0.01" className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-indigo-500"
                    placeholder="0.00" value={form.amount_yearly} onChange={e => setForm(f => ({ ...f, amount_yearly: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="block text-[11px] text-white/50 mb-1.5">Volgende verlengingsdatum</label>
                <input type="date" className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  value={form.next_billing_date} onChange={e => setForm(f => ({ ...f, next_billing_date: e.target.value }))} />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.is_essential}
                  onChange={e => setForm(f => ({ ...f, is_essential: e.target.checked }))}
                  className="w-4 h-4 rounded border-white/20 bg-white/5 accent-indigo-500" />
                <span className="text-xs text-white/70">Essentieel (mag niet worden gepauzeerd)</span>
              </label>
              <div>
                <label className="block text-[11px] text-white/50 mb-1.5">Notities</label>
                <textarea rows={2} className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-indigo-500 resize-none"
                  placeholder="URL, login, aanvullende info…" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
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
