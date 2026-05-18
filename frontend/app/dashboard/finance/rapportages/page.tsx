import { FileText, TrendingUp, AlertTriangle, ShieldAlert } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function fmt(amount: number) {
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(amount)
}

function fmtPct(part: number, total: number) {
  if (total === 0) return '0%'
  return `${Math.round((part / total) * 100)}%`
}

type Invoice = {
  id: string
  amount_incl: number | null
  amount_paid: number | null
  due_date: string | null
  issued_at: string | null
  status: string | null
  description: string | null
  invoice_nr: string | null
}

function agingBucket(inv: Invoice): 0 | 1 | 2 | 3 {
  if (!inv.due_date) return 3
  const overdueDays = Math.floor((Date.now() - new Date(inv.due_date).getTime()) / 86400000)
  if (overdueDays <= 30) return 0
  if (overdueDays <= 60) return 1
  if (overdueDays <= 90) return 2
  return 3
}

export default async function RapportagesPage() {
  const supabase = await createClient()

  const [
    { data: openInvoices },
    { data: allInvoices },
    { data: transactions },
  ] = await Promise.all([
    supabase.from('fin_invoices')
      .select('id, amount_incl, amount_paid, due_date, issued_at, status, description, invoice_nr')
      .in('status', ['open', 'overdue']),
    supabase.from('fin_invoices')
      .select('id, amount_incl, amount_paid, status, issued_at')
      .order('issued_at', { ascending: false })
      .limit(100),
    supabase.from('cfo_transactions')
      .select('amount_incl, direction, transaction_date')
      .gte('transaction_date', new Date(Date.now() - 90 * 86400000).toISOString()),
  ])

  const open = (openInvoices ?? []) as Invoice[]

  // Aging buckets — only open/overdue invoices with outstanding balance
  const buckets: number[] = [0, 0, 0, 0]
  for (const inv of open) {
    const outstanding = (inv.amount_incl ?? 0) - (inv.amount_paid ?? 0)
    if (outstanding > 0) buckets[agingBucket(inv)] += outstanding
  }
  const agingTotal = buckets.reduce((s, v) => s + v, 0)

  const AGING_ROWS = [
    { label: '0–30 dagen',  amount: buckets[0], color: 'text-green-400',  status: buckets[0] > 0 ? 'bg-amber-500/10 text-amber-400' : 'bg-white/5 text-white/50' },
    { label: '31–60 dagen', amount: buckets[1], color: 'text-amber-400',  status: buckets[1] > 0 ? 'bg-orange-500/10 text-orange-400' : 'bg-white/5 text-white/50' },
    { label: '61–90 dagen', amount: buckets[2], color: 'text-orange-400', status: buckets[2] > 0 ? 'bg-red-500/10 text-red-400' : 'bg-white/5 text-white/50' },
    { label: '90+ dagen',   amount: buckets[3], color: 'text-red-400',    status: buckets[3] > 0 ? 'bg-red-500/10 text-red-400' : 'bg-white/5 text-white/50' },
  ]

  // Cashflow prognose — split 30/60/90 day buckets from open invoices
  const cf30 = open.filter(i => {
    if (!i.due_date) return false
    const d = new Date(i.due_date).getTime()
    const n = Date.now()
    return d >= n && d <= n + 30 * 86400000
  }).reduce((s, i) => s + ((i.amount_incl ?? 0) - (i.amount_paid ?? 0)), 0)

  const cf60 = open.filter(i => {
    if (!i.due_date) return false
    const d = new Date(i.due_date).getTime()
    const n = Date.now()
    return d > n + 30 * 86400000 && d <= n + 60 * 86400000
  }).reduce((s, i) => s + ((i.amount_incl ?? 0) - (i.amount_paid ?? 0)), 0)

  const cf90 = open.filter(i => {
    if (!i.due_date) return false
    const d = new Date(i.due_date).getTime()
    const n = Date.now()
    return d > n + 60 * 86400000 && d <= n + 90 * 86400000
  }).reduce((s, i) => s + ((i.amount_incl ?? 0) - (i.amount_paid ?? 0)), 0)

  // Transaction summary (last 90 days)
  const txRows = transactions ?? []
  const inflow  = txRows.filter(t => t.direction === 'in').reduce((s, t) => s + (t.amount_incl ?? 0), 0)
  const outflow = txRows.filter(t => t.direction === 'out').reduce((s, t) => s + (t.amount_incl ?? 0), 0)

  const allRows = (allInvoices ?? [])
  const paidCount   = allRows.filter(i => i.status === 'paid').length
  const totalCount  = allRows.length
  const payRate     = totalCount > 0 ? Math.round((paidCount / totalCount) * 100) : 0

  const REPORT_CARDS = [
    {
      title: 'Debiteuren Aging',
      desc: `${open.length} openstaande facturen — totaal ${fmt(agingTotal)}`,
      icon: FileText,
      color: 'text-amber-400',
      bg: 'bg-amber-500/10',
      href: '/dashboard/finance/debiteuren',
    },
    {
      title: 'Cashflow Prognose',
      desc: `Verwacht: ${fmt(cf30 + cf60 + cf90)} in 90 dagen`,
      icon: TrendingUp,
      color: 'text-sky-400',
      bg: 'bg-sky-500/10',
      href: '/dashboard/finance/cfo/cashflow',
    },
    {
      title: 'Betaalgedrag',
      desc: `${payRate}% van alle facturen betaald (${paidCount}/${totalCount})`,
      icon: ShieldAlert,
      color: 'text-indigo-400',
      bg: 'bg-indigo-500/10',
      href: '/dashboard/finance/facturen',
    },
    {
      title: 'Transactie Saldo (90d)',
      desc: `In: ${fmt(inflow)} · Uit: ${fmt(outflow)} · Netto: ${fmt(inflow - outflow)}`,
      icon: AlertTriangle,
      color: inflow - outflow >= 0 ? 'text-green-400' : 'text-red-400',
      bg: inflow - outflow >= 0 ? 'bg-green-500/10' : 'bg-red-500/10',
      href: '/dashboard/finance/cfo',
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-base font-semibold text-white">Rapportages</h1>
        <p className="text-xs text-white/50 mt-0.5">CFO-rapportages en financiële analyses op basis van live data.</p>
      </div>

      {/* Report cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {REPORT_CARDS.map((r) => {
          const Icon = r.icon
          return (
            <Link key={r.title} href={r.href} className="bg-white/[0.06] border border-white/5 rounded-xl p-5 flex items-start gap-3 hover:bg-white/[0.09] transition-colors group">
              <div className={`w-9 h-9 rounded-lg ${r.bg} flex items-center justify-center flex-shrink-0`}>
                <Icon size={16} className={r.color} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-white group-hover:text-white/90">{r.title}</h3>
                <p className="text-xs text-white/55 mt-1">{r.desc}</p>
              </div>
            </Link>
          )
        })}
      </div>

      {/* Aging table */}
      <div className="bg-white/[0.06] border border-white/5 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-white mb-4">Debiteuren Aging — Huidig Overzicht</h3>
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/5">
              {['Periode', 'Openstaand', '% van totaal', 'Status'].map(h => (
                <th key={h} className={`pb-3 text-[10px] font-medium text-white/50 uppercase tracking-wider ${h === 'Periode' ? 'text-left' : 'text-right'}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {AGING_ROWS.map((row) => (
              <tr key={row.label}>
                <td className="py-3 text-xs text-white/70">{row.label}</td>
                <td className={`py-3 text-xs font-medium text-right ${row.color}`}>{fmt(row.amount)}</td>
                <td className="py-3 text-xs text-white/50 text-right">{fmtPct(row.amount, agingTotal)}</td>
                <td className="py-3 text-right">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${row.status}`}>
                    {row.amount > 0 ? 'Open' : 'Geen'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-white/10">
              <td className="pt-3 text-xs font-semibold text-white">Totaal</td>
              <td className="pt-3 text-xs font-semibold text-white text-right">{fmt(agingTotal)}</td>
              <td className="pt-3 text-xs text-white/65 text-right">100%</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Cashflow prognose */}
      <div className="bg-white/[0.06] border border-white/5 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-white mb-4">Cashflow Prognose — Verwachte Ontvangsten</h3>
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Volgende 30 dagen', amount: cf30, color: 'text-sky-400' },
            { label: '30–60 dagen',       amount: cf60, color: 'text-indigo-400' },
            { label: '60–90 dagen',       amount: cf90, color: 'text-violet-400' },
          ].map((c) => (
            <div key={c.label} className="bg-white/[0.04] border border-white/5 rounded-lg p-4">
              <p className="text-[11px] text-white/50 mb-2">{c.label}</p>
              <p className={`text-lg font-semibold ${c.color}`}>{fmt(c.amount)}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
