import { FileText, Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import IntegrationsPanel from './IntegrationsPanel'
import Link from 'next/link'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function fmtEur(n: number) {
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(n)
}

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('nl-NL', { day: '2-digit', month: 'short', year: 'numeric' })
}

const STATUS_COLORS: Record<string, string> = {
  paid:     'bg-green-500/10 text-green-400',
  received: 'bg-sky-500/10 text-sky-400',
  open:     'bg-amber-500/10 text-amber-400',
  overdue:  'bg-red-500/10 text-red-400',
  draft:    'bg-white/5 text-white/50',
}

const STATUS_LABELS: Record<string, string> = {
  paid: 'Betaald', received: 'Ontvangen', open: 'Open', overdue: 'Verlopen', draft: 'Concept',
}

export default async function AdminPage() {
  const supabase = await createClient()

  const [{ data: companies }, { data: invoices }] = await Promise.all([
    supabase.from('companies').select('id, name'),
    supabase.from('invoices')
      .select('id, company_id, type, counterparty, invoice_number, amount, amount_paid, invoice_date, status, description')
      .order('invoice_date', { ascending: false })
      .limit(10),
  ])

  const companyMap: Record<string, string> = {}
  for (const c of companies ?? []) companyMap[c.id] = c.name

  const rows = invoices ?? []

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
          <FileText size={16} className="text-violet-400" />
        </div>
        <div>
          <h1 className="text-base font-semibold text-white">Administratie</h1>
          <p className="text-xs text-white/50">Centrale administratie per bedrijf — koppelingen, mutaties en belastingaangifte.</p>
        </div>
      </div>

      <IntegrationsPanel />

      <div className="bg-white/[0.06] border border-white/5 rounded-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
          <h2 className="text-sm font-semibold text-white">Recente Mutaties</h2>
          <div className="flex items-center gap-2">
            <Link href="/dashboard/financien" className="text-[11px] text-indigo-400 hover:text-indigo-300">Alles zien</Link>
            <Link href="/dashboard/finance/facturen" className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors">
              <Plus size={11} /> Factuur
            </Link>
          </div>
        </div>

        {rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
              <FileText size={18} className="text-white/30" />
            </div>
            <p className="text-sm text-white/50">Geen mutaties</p>
            <p className="text-[11px] text-white/35">Facturen en transacties verschijnen hier zodra ze zijn aangemaakt.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  {['Datum', 'Omschrijving', 'Tegenpartij', 'Bedrag', 'BV', 'Status'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-[10px] font-medium text-white/50 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3 text-xs text-white/65 whitespace-nowrap">{fmtDate(row.invoice_date)}</td>
                    <td className="px-4 py-3 text-xs text-white/70 max-w-[200px] truncate">{row.description ?? row.invoice_number ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-white/60">{row.counterparty ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-white/80 font-mono whitespace-nowrap">{fmtEur(row.amount ?? 0)}</td>
                    <td className="px-4 py-3 text-xs text-white/65">{companyMap[row.company_id] ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${STATUS_COLORS[row.status ?? 'draft'] ?? 'bg-white/5 text-white/50'}`}>
                        {STATUS_LABELS[row.status ?? 'draft'] ?? row.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
