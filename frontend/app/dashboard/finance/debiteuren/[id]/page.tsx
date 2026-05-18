'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { FinCustomer, FinInvoice, FinReminder } from '@/lib/finance/types'
import { ArrowLeft, AlertTriangle, TrendingDown, Clock, ShieldOff } from 'lucide-react'

function fmt(amount: number) {
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(amount)
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    open: 'bg-blue-500/10 text-blue-400',
    vervallen: 'bg-red-500/10 text-red-400',
    incasso: 'bg-amber-500/10 text-amber-400',
    betaald: 'bg-green-500/10 text-green-400',
  }
  return (
    <span className={`${map[status] ?? 'bg-white/5 text-white/65'} px-2 py-0.5 rounded-full text-[10px] font-medium capitalize`}>
      {status}
    </span>
  )
}

function RiskBadge({ level }: { level: string }) {
  const map: Record<string, string> = {
    laag: 'bg-green-500/10 text-green-400',
    midden: 'bg-amber-500/10 text-amber-400',
    hoog: 'bg-red-500/10 text-red-400',
  }
  return (
    <span className={`${map[level] ?? 'bg-white/5 text-white/65'} px-2.5 py-1 rounded-full text-xs font-medium capitalize`}>
      {level} risico
    </span>
  )
}

export default function DebiteurDetailPage() {
  const params = useParams()
  const id = params.id as string

  const [customer, setCustomer] = useState<FinCustomer | null>(null)
  const [invoices, setInvoices] = useState<FinInvoice[]>([])
  const [reminders, setReminders] = useState<FinReminder[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)

      try {
        const supabase = createClient()
        const [custRes, invRes, remRes] = await Promise.all([
          supabase.from('fin_customers').select('*').eq('id', id).single(),
          supabase.from('fin_invoices').select('*').eq('customer_id', id).order('issued_at', { ascending: false }),
          supabase.from('fin_reminders').select('*').order('sent_at', { ascending: false }),
        ])
        setCustomer(custRes.data as FinCustomer)
        setInvoices((invRes.data ?? []) as FinInvoice[])
        setReminders((remRes.data ?? []) as FinReminder[])
      } catch {
        // ignore
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  if (loading) {
    return <div className="flex items-center justify-center h-40"><p className="text-xs text-white/50">Laden...</p></div>
  }

  if (!customer) {
    return (
      <div className="flex flex-col items-center justify-center h-40 gap-3">
        <p className="text-xs text-white/50">Klant niet gevonden</p>
        <Link href="/dashboard/finance/debiteuren" className="text-xs text-indigo-400 hover:text-indigo-300">Terug</Link>
      </div>
    )
  }

  const openAmount = invoices.filter((i) => i.status !== 'betaald').reduce((s, i) => s + i.amount_incl, 0)
  const overdueAmount = invoices.filter((i) => i.status === 'vervallen' || i.status === 'incasso').reduce((s, i) => s + i.amount_incl, 0)
  const paidAmount = invoices.filter((i) => i.status === 'betaald').reduce((s, i) => s + i.amount_incl, 0)

  const riskFactors: { icon: React.ReactNode; label: string; active: boolean }[] = [
    { icon: <Clock size={12} />, label: `Gem. betaaltermijn ${customer.payment_avg_days} dagen`, active: customer.payment_avg_days > 30 },
    { icon: <AlertTriangle size={12} />, label: 'Facturen al in incasso', active: invoices.some((i) => i.status === 'incasso') },
    { icon: <TrendingDown size={12} />, label: 'Lage creditscore (<50)', active: customer.score < 50 },
    { icon: <ShieldOff size={12} />, label: 'Meerdere aanmaningen gestuurd', active: reminders.length >= 2 },
  ]

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard/finance/debiteuren"
          className="border border-white/10 text-white/50 hover:text-white text-xs px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
        >
          <ArrowLeft size={12} />
          Terug
        </Link>
        <div className="flex items-center gap-3 flex-1">
          <h1 className="text-lg font-semibold text-white">{customer.name}</h1>
          <RiskBadge level={customer.risk_level} />
          <span
            className={`text-sm font-semibold ${customer.score >= 80 ? 'text-green-400' : customer.score >= 50 ? 'text-amber-400' : 'text-red-400'}`}
          >
            Score: {customer.score}
          </span>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Openstaand', value: fmt(openAmount), color: 'text-amber-400' },
          { label: 'Vervallen', value: fmt(overdueAmount), color: 'text-red-400' },
          { label: 'Totaal betaald', value: fmt(paidAmount), color: 'text-green-400' },
          { label: 'Gem. betaaltermijn', value: `${customer.payment_avg_days} dagen`, color: 'text-white' },
        ].map((s) => (
          <div key={s.label} className="bg-white/[0.06] border border-white/5 rounded-xl p-4">
            <p className="text-[10px] font-medium text-white/50 uppercase tracking-wider mb-1">{s.label}</p>
            <p className={`text-lg font-semibold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* Invoice history */}
        <div className="col-span-2 bg-white/[0.06] border border-white/5 rounded-xl p-4">
          <h3 className="text-xs font-semibold text-white mb-3">Factuurhistorie</h3>
          {invoices.length === 0 ? (
            <p className="text-xs text-white/50 py-4 text-center">Geen facturen</p>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  {['Factuur', 'Bedrag', 'Vervaldatum', 'Status'].map((h) => (
                    <th key={h} className="pb-2 text-left text-[10px] font-medium text-white/50 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {invoices.map((inv) => (
                  <tr key={inv.id}>
                    <td className="py-2 text-xs text-indigo-400">{inv.invoice_nr}</td>
                    <td className="py-2 text-xs text-white/70">{fmt(inv.amount_incl)}</td>
                    <td className="py-2 text-xs text-white/50">{inv.due_date}</td>
                    <td className="py-2"><StatusBadge status={inv.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Contact */}
          <div className="bg-white/[0.06] border border-white/5 rounded-xl p-4">
            <h3 className="text-xs font-semibold text-white mb-3">Contactgegevens</h3>
            <div className="space-y-2 text-xs text-white/50">
              {customer.email && <p>{customer.email}</p>}
              {customer.phone && <p>{customer.phone}</p>}
              {customer.kvk && <p>KvK: {customer.kvk}</p>}
              {customer.btw && <p>BTW: {customer.btw}</p>}
              {customer.city && <p>{customer.address}, {customer.city}</p>}
            </div>
          </div>

          {/* AI Risk Analysis */}
          <div className="bg-white/[0.06] border border-white/5 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-4 h-4 rounded bg-indigo-500/20 flex items-center justify-center">
                <span className="text-indigo-400 text-[8px] font-bold">AI</span>
              </div>
              <h3 className="text-xs font-semibold text-white">AI Risico Analyse</h3>
            </div>
            <div className="space-y-2">
              {riskFactors.map((rf, i) => (
                <div key={i} className={`flex items-center gap-2 text-xs ${rf.active ? 'text-red-400' : 'text-white/45'}`}>
                  <span className="flex-shrink-0">{rf.icon}</span>
                  <span>{rf.label}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 pt-3 border-t border-white/5">
              <p className="text-[10px] text-white/50">
                {customer.risk_level === 'hoog'
                  ? 'Aanbeveling: Aanscherpen betaalbeleid. Overweeg creditlimiet of vooruitbetaling.'
                  : customer.risk_level === 'midden'
                    ? 'Aanbeveling: Monitor betalingsgedrag. Herinnering sturen bij latere betaling.'
                    : 'Geen verhoogd risico gedetecteerd.'}
              </p>
            </div>
          </div>

          {/* Communication */}
          <div className="bg-white/[0.06] border border-white/5 rounded-xl p-4">
            <h3 className="text-xs font-semibold text-white mb-3">Communicatie</h3>
            {reminders.length === 0 ? (
              <p className="text-xs text-white/50 text-center py-2">Geen berichten</p>
            ) : (
              <div className="space-y-2">
                {reminders.slice(0, 4).map((r) => (
                  <div key={r.id} className="flex items-center justify-between">
                    <span className="text-xs text-white/50">{r.stage.replace(/_/g, ' ')}</span>
                    <span className="text-[10px] text-white/45">{r.sent_at}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
