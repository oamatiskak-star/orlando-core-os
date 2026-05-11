'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { MOCK_INVOICES } from '@/lib/finance/mock'
import type { FinInvoice } from '@/lib/finance/types'

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
    <span className={`${map[status] ?? 'bg-white/5 text-white/40'} px-2 py-0.5 rounded-full text-[10px] font-medium capitalize`}>
      {status}
    </span>
  )
}

export default function FacturenPage() {
  const [invoices, setInvoices] = useState<FinInvoice[]>([])
  const [activeTab, setActiveTab] = useState<StatusTab>('alle')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const supabase = createClient()
        const { data, error } = await supabase
          .from('fin_invoices')
          .select('*, customer:fin_customers(*)')
          .order('issued_at', { ascending: false })

        if (error || !data || data.length === 0) {
          setInvoices(MOCK_INVOICES)
        } else {
          setInvoices(data as FinInvoice[])
        }
      } catch {
        setInvoices(MOCK_INVOICES)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

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
          <p className="text-xs text-white/30 mt-0.5">{invoices.length} facturen in totaal</p>
        </div>
        <button className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium px-4 py-2 rounded-lg transition-colors">
          + Nieuwe Factuur
        </button>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1 bg-white/[0.03] border border-white/5 rounded-lg p-1">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                activeTab === tab
                  ? 'bg-indigo-600/30 text-indigo-400'
                  : 'text-white/40 hover:text-white/70'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
              <span className="ml-1.5 text-[10px] text-white/30">{counts[tab]}</span>
            </button>
          ))}
        </div>
        <input
          type="text"
          placeholder="Zoek factuur, klant..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-white/[0.03] border border-white/5 rounded-lg px-3 py-1.5 text-xs text-white placeholder-white/30 outline-none focus:border-indigo-500/50 w-56"
        />
      </div>

      {/* Table */}
      <div className="bg-white/[0.03] border border-white/5 rounded-xl overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-xs text-white/30">Laden...</div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-xs text-white/30">Geen facturen gevonden</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                {['Factuur #', 'Klant', 'Bedrag (incl)', 'Uitgegeven', 'Vervaldatum', 'Te laat', 'Status', 'Stadium', 'Actie'].map(
                  (h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-[10px] font-medium text-white/30 uppercase tracking-wider"
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filtered.map((inv) => (
                <tr key={inv.id} className="hover:bg-white/[0.02] transition-colors">
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
                      <span className="text-xs text-white/20">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={inv.status} />
                  </td>
                  <td className="px-4 py-3 text-xs text-white/40">{inv.workflow_stage}</td>
                  <td className="px-4 py-3">
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
    </div>
  )
}
