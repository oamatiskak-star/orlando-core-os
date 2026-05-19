'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { FinInvoice } from '@/lib/finance/types'
import { X, Loader2 } from 'lucide-react'

const STATUS_TABS = ['alle', 'open', 'vervallen', 'incasso', 'betaald'] as const
type StatusTab = (typeof STATUS_TABS)[number]

function fmt(amount: number) {
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(amount)
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    open: 'bg-blue-500/10 text-blue-400',
    vervallen: 'bg-red-500/10 text-red-400',
    incasso: 'bg-amber-500/10 text-amber-400',
    betaald: 'bg-green-500/10 text-green-400',
    juridisch: 'bg-purple-500/10 text-purple-400',
  }
  return (
    <span className={`${map[status] ?? 'bg-white/5 text-white/65'} px-2 py-0.5 rounded-full text-[10px] font-medium capitalize`}>
      {status}
    </span>
  )
}

type FinCustomerRow = { id: string; name: string }

export default function FacturenPage() {
  const router = useRouter()
  const [invoices, setInvoices] = useState<FinInvoice[]>([])
  const [activeTab, setActiveTab] = useState<StatusTab>('alle')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [customers, setCustomers] = useState<FinCustomerRow[]>([])
  const [form, setForm] = useState({
    customer_id: '',
    invoice_nr: '',
    amount_excl: '',
    due_date: '',
    description: '',
  })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const supabase = createClient()
      const [invRes, custRes] = await Promise.all([
        supabase.from('fin_invoices').select('*, customer:fin_customers(*)').order('issued_at', { ascending: false }),
        supabase.from('fin_customers').select('id, name').order('name'),
      ])
      setInvoices((invRes.data ?? []) as FinInvoice[])
      setCustomers((custRes.data ?? []) as FinCustomerRow[])
    } catch {
      setInvoices([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function createInvoice() {
    if (!form.customer_id || !form.invoice_nr || !form.amount_excl) return
    setSaving(true)
    try {
      const supabase = createClient()
      const amountExcl = parseFloat(form.amount_excl)
      const amountVat = amountExcl * 0.21
      await supabase.from('fin_invoices').insert({
        customer_id: form.customer_id,
        invoice_nr: form.invoice_nr,
        amount_excl: amountExcl,
        amount_vat: amountVat,
        amount_incl: amountExcl + amountVat,
        amount_paid: 0,
        due_date: form.due_date || null,
        description: form.description || null,
        status: 'open',
        workflow_stage: 'nieuw',
        days_overdue: 0,
        issued_at: new Date().toISOString().split('T')[0],
      })
      setShowModal(false)
      setForm({ customer_id: '', invoice_nr: '', amount_excl: '', due_date: '', description: '' })
      await load()
    } finally {
      setSaving(false)
    }
  }

  const filtered = invoices.filter((inv) => {
    const matchTab = activeTab === 'alle' || inv.status === activeTab
    const q = search.toLowerCase()
    const matchSearch =
      !q ||
      inv.invoice_nr.toLowerCase().includes(q) ||
      (inv.customer?.name ?? '').toLowerCase().includes(q) ||
      (inv.description ?? '').toLowerCase().includes(q)
    return matchTab && matchSearch
  })

  const counts = STATUS_TABS.reduce(
    (acc, s) => {
      acc[s] = s === 'alle' ? invoices.length : invoices.filter((i) => i.status === s).length
      return acc
    },
    {} as Record<StatusTab, number>,
  )

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-white">Facturen</h1>
          <p className="text-xs text-white/50 mt-0.5">{invoices.length} facturen in totaal</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium px-4 py-2 rounded-lg transition-colors"
        >
          + Nieuwe Factuur
        </button>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1 bg-white/[0.06] border border-white/5 rounded-lg p-1">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                activeTab === tab
                  ? 'bg-indigo-600/30 text-indigo-400'
                  : 'text-white/65 hover:text-white/70'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
              <span className="ml-1.5 text-[10px] text-white/50">{counts[tab]}</span>
            </button>
          ))}
        </div>
        <input
          type="text"
          placeholder="Zoek factuur, klant..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-white/[0.06] border border-white/5 rounded-lg px-3 py-1.5 text-xs text-white placeholder-white/30 outline-none focus:border-indigo-500/50 w-56"
        />
      </div>

      {/* Table */}
      <div className="bg-white/[0.06] border border-white/5 rounded-xl overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-xs text-white/50">Laden...</div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center space-y-3">
            <p className="text-xs text-white/50">Geen facturen gevonden</p>
            {invoices.length === 0 && (
              <button
                onClick={() => setShowModal(true)}
                className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                + Maak eerste factuur aan
              </button>
            )}
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                {['Factuur #', 'Klant', 'Bedrag (incl)', 'Uitgegeven', 'Vervaldatum', 'Te laat', 'Status', 'Stadium', 'Actie'].map(
                  (h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-[10px] font-medium text-white/50 uppercase tracking-wider"
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filtered.map((inv) => (
                <tr
                  key={inv.id}
                  onClick={() => router.push(`/dashboard/finance/facturen/${inv.id}`)}
                  className="hover:bg-white/[0.02] transition-colors cursor-pointer"
                >
                  <td className="px-4 py-3 text-xs text-indigo-400 font-medium">{inv.invoice_nr}</td>
                  <td className="px-4 py-3 text-xs text-white/70 max-w-[160px] truncate">
                    {inv.customer?.name ?? 'Onbekend'}
                  </td>
                  <td className="px-4 py-3 text-xs text-white/70 font-medium">{fmt(inv.amount_incl)}</td>
                  <td className="px-4 py-3 text-xs text-white/50">{inv.issued_at}</td>
                  <td className="px-4 py-3 text-xs text-white/50">{inv.due_date}</td>
                  <td className="px-4 py-3">
                    {inv.days_overdue > 0 ? (
                      <span className="bg-red-500/10 text-red-400 px-2 py-0.5 rounded-full text-[10px] font-medium">
                        {inv.days_overdue}d
                      </span>
                    ) : (
                      <span className="text-xs text-white/38">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={inv.status} />
                  </td>
                  <td className="px-4 py-3 text-xs text-white/65">{inv.workflow_stage}</td>
                  <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                    <Link
                      href={`/dashboard/finance/facturen/${inv.id}`}
                      className="border border-white/10 text-white/50 hover:text-white text-xs px-4 py-2 rounded-lg transition-colors"
                    >
                      Bekijk
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Nieuwe Factuur modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#0f0f13] border border-white/10 rounded-2xl w-full max-w-md p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">Nieuwe Factuur</h2>
              <button onClick={() => setShowModal(false)} className="text-white/40 hover:text-white/70 transition-colors">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[10px] text-white/50 uppercase tracking-wider block mb-1">Klant *</label>
                <select
                  value={form.customer_id}
                  onChange={e => setForm(f => ({ ...f, customer_id: e.target.value }))}
                  className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-indigo-500/50"
                >
                  <option value="" className="bg-[#0f0f13]">Selecteer klant...</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id} className="bg-[#0f0f13]">{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-white/50 uppercase tracking-wider block mb-1">Factuurnummer *</label>
                <input
                  type="text"
                  value={form.invoice_nr}
                  onChange={e => setForm(f => ({ ...f, invoice_nr: e.target.value }))}
                  placeholder="2026-001"
                  className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-white/30 outline-none focus:border-indigo-500/50"
                />
              </div>
              <div>
                <label className="text-[10px] text-white/50 uppercase tracking-wider block mb-1">Bedrag excl. BTW (€) *</label>
                <input
                  type="number"
                  value={form.amount_excl}
                  onChange={e => setForm(f => ({ ...f, amount_excl: e.target.value }))}
                  placeholder="1000.00"
                  step="0.01"
                  className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-white/30 outline-none focus:border-indigo-500/50"
                />
                {form.amount_excl && !isNaN(parseFloat(form.amount_excl)) && (
                  <p className="text-[10px] text-white/40 mt-1">
                    Incl. 21% BTW: {fmt(parseFloat(form.amount_excl) * 1.21)}
                  </p>
                )}
              </div>
              <div>
                <label className="text-[10px] text-white/50 uppercase tracking-wider block mb-1">Vervaldatum</label>
                <input
                  type="date"
                  value={form.due_date}
                  onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
                  className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-indigo-500/50"
                />
              </div>
              <div>
                <label className="text-[10px] text-white/50 uppercase tracking-wider block mb-1">Omschrijving</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Omschrijving van de factuur..."
                  rows={2}
                  className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-white/30 outline-none focus:border-indigo-500/50 resize-none"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 border border-white/10 text-white/50 hover:text-white text-xs py-2 rounded-lg transition-colors"
              >
                Annuleer
              </button>
              <button
                onClick={createInvoice}
                disabled={saving || !form.customer_id || !form.invoice_nr || !form.amount_excl}
                className="flex-1 flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-medium py-2 rounded-lg transition-colors"
              >
                {saving && <Loader2 size={11} className="animate-spin" />}
                Factuur aanmaken
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
