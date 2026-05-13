'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { MOCK_CUSTOMERS, MOCK_INVOICES } from '@/lib/finance/mock'
import type { FinCustomer } from '@/lib/finance/types'

function fmt(amount: number) {
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(amount)
}

function ScoreIndicator({ score }: { score: number }) {
  const color = score >= 80 ? 'text-green-400' : score >= 50 ? 'text-amber-400' : 'text-red-400'
  return <span className={`text-sm font-semibold ${color}`}>{score}</span>
}

function RiskBadge({ level }: { level: string }) {
  const map: Record<string, string> = {
    laag: 'bg-green-500/10 text-green-400',
    midden: 'bg-amber-500/10 text-amber-400',
    hoog: 'bg-red-500/10 text-red-400',
  }
  return (
    <span className={`${map[level] ?? 'bg-white/5 text-white/65'} px-2 py-0.5 rounded-full text-[10px] font-medium capitalize`}>
      {level}
    </span>
  )
}

export default function DebiteurenPage() {
  const [customers, setCustomers] = useState<FinCustomer[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const supabase = createClient()
        const { data, error } = await supabase
          .from('fin_customers')
          .select('*')
          .order('score', { ascending: true })

        if (error || !data || data.length === 0) {
          setCustomers(MOCK_CUSTOMERS)
        } else {
          setCustomers(data as FinCustomer[])
        }
      } catch {
        setCustomers(MOCK_CUSTOMERS)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const filtered = customers.filter((c) => {
    const q = search.toLowerCase()
    return !q || c.name.toLowerCase().includes(q) || (c.email ?? '').toLowerCase().includes(q)
  })

  const highRisk = customers.filter((c) => c.risk_level === 'hoog').length
  const avgScore = customers.length > 0 ? Math.round(customers.reduce((s, c) => s + c.score, 0) / customers.length) : 0
  const openAmount = MOCK_INVOICES.filter((i) => i.status !== 'betaald').reduce((s, i) => s + i.amount_incl, 0)

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-white">Debiteuren</h1>
          <p className="text-xs text-white/50 mt-0.5">{customers.length} klanten geregistreerd</p>
        </div>
        <button className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium px-4 py-2 rounded-lg transition-colors">
          + Nieuw
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Totaal klanten', value: customers.length.toString(), color: 'text-white' },
          { label: 'Hoog risico', value: highRisk.toString(), color: 'text-red-400' },
          { label: 'Gem. score', value: avgScore.toString(), color: avgScore >= 70 ? 'text-green-400' : avgScore >= 50 ? 'text-amber-400' : 'text-red-400' },
          { label: 'Openstaand', value: fmt(openAmount), color: 'text-amber-400' },
        ].map((s) => (
          <div key={s.label} className="bg-white/[0.06] border border-white/5 rounded-xl p-4">
            <p className="text-[10px] font-medium text-white/50 uppercase tracking-wider mb-1">{s.label}</p>
            <p className={`text-xl font-semibold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <input
        type="text"
        placeholder="Zoek klant, e-mail..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="bg-white/[0.06] border border-white/5 rounded-lg px-3 py-1.5 text-xs text-white placeholder-white/30 outline-none focus:border-indigo-500/50 w-64"
      />

      {/* Table */}
      <div className="bg-white/[0.06] border border-white/5 rounded-xl overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-xs text-white/50">Laden...</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                {['Klant', 'KvK', 'Score', 'Risico', 'Openstaand', 'Gem. termijn', 'Facturen', 'Actie'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-[10px] font-medium text-white/50 uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filtered.map((cust) => {
                const custInvoices = MOCK_INVOICES.filter((i) => i.customer_id === cust.id)
                const openAmt = custInvoices.filter((i) => i.status !== 'betaald').reduce((s, i) => s + i.amount_incl, 0)
                return (
                  <tr key={cust.id} className="hover:bg-white/[0.02] transition-colors cursor-pointer">
                    <td className="px-4 py-3">
                      <p className="text-xs font-medium text-white">{cust.name}</p>
                      {cust.email && <p className="text-[10px] text-white/50 mt-0.5">{cust.email}</p>}
                    </td>
                    <td className="px-4 py-3 text-xs text-white/65">{cust.kvk ?? '—'}</td>
                    <td className="px-4 py-3">
                      <ScoreIndicator score={cust.score} />
                    </td>
                    <td className="px-4 py-3">
                      <RiskBadge level={cust.risk_level} />
                    </td>
                    <td className="px-4 py-3 text-xs text-white/70 font-medium">
                      {openAmt > 0 ? fmt(openAmt) : <span className="text-white/38">—</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-white/50">{cust.payment_avg_days} dagen</td>
                    <td className="px-4 py-3 text-xs text-white/65">{custInvoices.length}</td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/dashboard/finance/debiteuren/${cust.id}`}
                        className="border border-white/10 text-white/50 hover:text-white text-xs px-4 py-2 rounded-lg transition-colors"
                      >
                        Bekijk
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
