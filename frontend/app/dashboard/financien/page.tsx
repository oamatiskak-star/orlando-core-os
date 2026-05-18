import { TrendingUp, Euro, FileText, ArrowUpDown, Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function fmtEur(n: number) {
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)
}

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('nl-NL', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default async function FinancienPage() {
  const supabase = await createClient()

  const [
    { data: invoices },
    { data: transactions },
    { data: companies },
  ] = await Promise.all([
    supabase.from('fin_invoices')
      .select('id, company_id, amount_incl, amount_paid, status, issued_at, due_date, description, invoice_nr')
      .order('issued_at', { ascending: false })
      .limit(10),
    supabase.from('cfo_transactions')
      .select('id, company_id, direction, amount_incl, description, transaction_date, category')
      .order('transaction_date', { ascending: false })
      .limit(20),
    supabase.from('companies').select('id, name'),
  ])

  const companyMap: Record<string, string> = {}
  for (const c of companies ?? []) companyMap[c.id] = c.name

  const invoiceRows = invoices ?? []
  const txRows      = transactions ?? []

  const totalOmzet      = txRows.filter(t => t.direction === 'in').reduce((s, t) => s + (t.amount_incl ?? 0), 0)
  const totalKosten     = txRows.filter(t => t.direction === 'out').reduce((s, t) => s + (t.amount_incl ?? 0), 0)
  const openFacturen    = invoiceRows.filter(i => i.status === 'open' || i.status === 'overdue').length
  const openBedrag      = invoiceRows.filter(i => i.status === 'open' || i.status === 'overdue').reduce((s, i) => s + ((i.amount_incl ?? 0) - (i.amount_paid ?? 0)), 0)

  const STATUS_COLORS: Record<string, string> = {
    paid:    'bg-green-500/10 text-green-400',
    open:    'bg-amber-500/10 text-amber-400',
    overdue: 'bg-red-500/10 text-red-400',
    draft:   'bg-white/5 text-white/50',
  }

  const STATUS_LABELS: Record<string, string> = {
    paid: 'Betaald', open: 'Open', overdue: 'Verlopen', draft: 'Concept',
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-center">
            <TrendingUp size={16} className="text-green-400" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-white">Financiën</h1>
            <p className="text-xs text-white/50">Cashflow, omzet, BTW en financieel overzicht per BV.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/dashboard/finance/cfo" className="border border-white/10 text-white/50 hover:text-white hover:border-white/20 text-xs font-medium px-4 py-2 rounded-lg transition-colors">
            CFO Dashboard
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Totale Omzet',          value: fmtEur(totalOmzet),   icon: TrendingUp,  color: 'text-green-400',  bg: 'bg-green-500/10 border-green-500/20' },
          { label: 'Maandelijkse Kosten',   value: fmtEur(totalKosten),  icon: Euro,         color: 'text-red-400',    bg: 'bg-red-500/10 border-red-500/20' },
          { label: 'Openstaande Facturen',  value: String(openFacturen), icon: FileText,     color: 'text-amber-400',  bg: 'bg-amber-500/10 border-amber-500/20' },
          { label: 'Open bedrag',           value: fmtEur(openBedrag),   icon: ArrowUpDown,  color: 'text-sky-400',    bg: 'bg-sky-500/10 border-sky-500/20' },
        ].map((card) => {
          const Icon = card.icon
          return (
            <div key={card.label} className="bg-white/[0.06] border border-white/5 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[11px] text-white/50">{card.label}</p>
                <div className={`w-7 h-7 rounded-lg border flex items-center justify-center ${card.bg}`}>
                  <Icon size={13} className={card.color} />
                </div>
              </div>
              <p className="text-xl font-semibold text-white">{card.value}</p>
            </div>
          )
        })}
      </div>

      {/* Invoices */}
      <div className="bg-white/[0.06] border border-white/5 rounded-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
          <h2 className="text-sm font-semibold text-white">Recente Facturen</h2>
          <Link href="/dashboard/finance/facturen" className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors">
            <Plus size={11} /> Factuur
          </Link>
        </div>
        {invoiceRows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
              <FileText size={18} className="text-white/30" />
            </div>
            <p className="text-sm text-white/50">Geen facturen</p>
            <p className="text-[11px] text-white/35">Facturen worden zichtbaar zodra ze zijn aangemaakt.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  {['Factuur', 'BV', 'Omschrijving', 'Bedrag', 'Datum', 'Status'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-[10px] font-medium text-white/50 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {invoiceRows.map((inv) => (
                  <tr key={inv.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3 text-xs text-white/70 font-mono">{inv.invoice_nr ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-white/60">{companyMap[inv.company_id] ?? inv.company_id ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-white/70 max-w-[200px] truncate">{inv.description ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-white/80 font-mono">{fmtEur(inv.amount_incl ?? 0)}</td>
                    <td className="px-4 py-3 text-xs text-white/50 whitespace-nowrap">{fmtDate(inv.issued_at)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${STATUS_COLORS[inv.status ?? 'draft'] ?? 'bg-white/5 text-white/50'}`}>
                        {STATUS_LABELS[inv.status ?? 'draft'] ?? inv.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recent Transactions */}
      {txRows.length > 0 && (
        <div className="bg-white/[0.06] border border-white/5 rounded-xl">
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
            <h2 className="text-sm font-semibold text-white">Recente Transacties</h2>
            <Link href="/dashboard/finance/cfo" className="text-[11px] text-indigo-400 hover:text-indigo-300">Alles zien</Link>
          </div>
          <div className="divide-y divide-white/5">
            {txRows.slice(0, 8).map((tx) => (
              <div key={tx.id} className="flex items-center gap-3 px-5 py-3 hover:bg-white/[0.02] transition-colors">
                <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${tx.direction === 'in' ? 'bg-green-400' : 'bg-red-400'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-white/70 truncate">{tx.description ?? '—'}</p>
                  <p className="text-[11px] text-white/40">{tx.category ?? '—'} · {fmtDate(tx.transaction_date)}</p>
                </div>
                <span className={`text-xs font-mono font-medium ${tx.direction === 'in' ? 'text-green-400' : 'text-red-400'}`}>
                  {tx.direction === 'in' ? '+' : '−'}{fmtEur(tx.amount_incl ?? 0)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
