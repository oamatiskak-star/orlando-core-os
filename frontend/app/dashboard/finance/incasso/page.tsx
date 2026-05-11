'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { MOCK_INCASSO_CASES, MOCK_INVOICES, MOCK_CUSTOMERS } from '@/lib/finance/mock'
import type { FinIncassoCase } from '@/lib/finance/types'

function fmt(amount: number) {
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(amount)
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    actief: 'bg-amber-500/10 text-amber-400',
    afgerond: 'bg-green-500/10 text-green-400',
    ingetrokken: 'bg-white/5 text-white/40',
  }
  return (
    <span className={`${map[status] ?? 'bg-white/5 text-white/40'} px-2 py-0.5 rounded-full text-[10px] font-medium capitalize`}>
      {status}
    </span>
  )
}

export default function IncassoPage() {
  const [cases, setCases] = useState<FinIncassoCase[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const supabase = createClient()
        const { data, error } = await supabase
          .from('fin_incasso_cases')
          .select('*')
          .order('started_at', { ascending: false })

        if (error || !data || data.length === 0) {
          setCases(MOCK_INCASSO_CASES)
        } else {
          setCases(data as FinIncassoCase[])
        }
      } catch {
        setCases(MOCK_INCASSO_CASES)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const active = cases.filter((c) => c.status === 'actief')
  const totalAmount = active.reduce((s, c) => s + c.amount_total, 0)
  const avgAmount = active.length > 0 ? totalAmount / active.length : 0
  const done = cases.filter((c) => c.status === 'afgerond').length

  function getInvoiceNr(invoiceId: string) {
    return MOCK_INVOICES.find((i) => i.id === invoiceId)?.invoice_nr ?? invoiceId
  }

  function getCustomerName(invoiceId: string) {
    const inv = MOCK_INVOICES.find((i) => i.id === invoiceId)
    if (!inv) return 'Onbekend'
    return MOCK_CUSTOMERS.find((c) => c.id === inv.customer_id)?.name ?? 'Onbekend'
  }

  function daysSince(dateStr: string) {
    return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000)
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-white">Incasso Dossiers</h1>
          <p className="text-xs text-white/30 mt-0.5">{cases.length} dossiers</p>
        </div>
        <button className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium px-4 py-2 rounded-lg transition-colors">
          + Nieuw Dossier
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Open dossiers', value: active.length.toString(), color: 'text-amber-400' },
          { label: 'Totaal bedrag', value: fmt(totalAmount), color: 'text-red-400' },
          { label: 'Gemiddeld dossier', value: fmt(avgAmount), color: 'text-white' },
          { label: 'Afgerond', value: done.toString(), color: 'text-green-400' },
        ].map((s) => (
          <div key={s.label} className="bg-white/[0.03] border border-white/5 rounded-xl p-4">
            <p className="text-[10px] font-medium text-white/30 uppercase tracking-wider mb-1">{s.label}</p>
            <p className={`text-xl font-semibold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white/[0.03] border border-white/5 rounded-xl overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-xs text-white/30">Laden...</div>
        ) : cases.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm text-white/40 mb-1">Geen actieve incasso dossiers</p>
            <p className="text-xs text-white/20">Dossiers worden automatisch aangemaakt bij escalatie via de workflow engine</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                {['Dossier #', 'Klant', 'Factuur', 'Hoofdsom', 'Rente', 'Kosten', 'Totaal', 'Incassobureau', 'Status', 'Dagen open'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-[10px] font-medium text-white/30 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {cases.map((c, i) => (
                <tr key={c.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-3 text-xs text-indigo-400 font-medium">DOS-{String(i + 1).padStart(3, '0')}</td>
                  <td className="px-4 py-3 text-xs text-white/70 max-w-[140px] truncate">{getCustomerName(c.invoice_id)}</td>
                  <td className="px-4 py-3 text-xs text-white/50">{getInvoiceNr(c.invoice_id)}</td>
                  <td className="px-4 py-3 text-xs text-white/70">{fmt(c.amount_principal)}</td>
                  <td className="px-4 py-3 text-xs text-white/50">{fmt(c.amount_interest ?? 0)}</td>
                  <td className="px-4 py-3 text-xs text-white/50">{fmt(c.amount_costs ?? 0)}</td>
                  <td className="px-4 py-3 text-xs font-semibold text-red-400">{fmt(c.amount_total)}</td>
                  <td className="px-4 py-3 text-xs text-white/40">{c.incasso_party ?? '—'}</td>
                  <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                  <td className="px-4 py-3">
                    <span className="bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded-full text-[10px] font-medium">
                      {daysSince(c.started_at)}d
                    </span>
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
