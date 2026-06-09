'use client'

import { useState } from 'react'
import { Download } from 'lucide-react'

export type SeoRevenueRow = {
  slug: string
  url: string
  title: string | null
  is_clir: boolean
  sessions: number
  distinct_visitors: number
  top_channel: string | null
  lead_signals: number
  financing_signals: number
  checkout_signals: number
  membership_signals: number
  report_sales: number
  report_revenue_eur: number
  membership_sales: number
  membership_mrr_eur: number
  total_revenue_eur: number
  revenue_per_session: number | null
  revenue_per_lead: number | null
  revenue_score: number
  revenue_rank: number
  lead_rank: number
  membership_rank: number
  finance_rank: number
  authority_rank: number
}

type SortKey = 'revenue_score' | 'total_revenue_eur' | 'report_sales' | 'membership_mrr_eur' | 'lead_signals' | 'financing_signals' | 'sessions'

const fmtEur = (n: number) => (!n ? '€ 0' : new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n))
const fmtNum = (n: number | null) => (n == null ? '—' : n.toLocaleString('nl-NL', { maximumFractionDigits: 2 }))

const COLS: [SortKey, string][] = [
  ['revenue_score', 'Score'],
  ['total_revenue_eur', 'Omzet'],
  ['report_sales', 'Rapp.'],
  ['membership_mrr_eur', 'MRR'],
  ['lead_signals', 'Leads'],
  ['financing_signals', 'Fin.'],
  ['sessions', 'Sessies'],
]

export default function SeoRevenueTable({ rows }: { rows: SeoRevenueRow[] }) {
  const [clir, setClir] = useState(false)
  const [sort, setSort] = useState<SortKey>('revenue_score')

  const view = rows
    .filter((r) => (clir ? r.is_clir : true))
    .sort((a, b) => (Number(b[sort]) || 0) - (Number(a[sort]) || 0))

  const exportCsv = () => {
    const cols: (keyof SeoRevenueRow)[] = ['slug', 'revenue_score', 'total_revenue_eur', 'report_sales', 'membership_mrr_eur', 'lead_signals', 'financing_signals', 'sessions', 'revenue_per_session', 'revenue_rank']
    const head = cols.join(',')
    const body = view.map((r) => cols.map((c) => JSON.stringify(r[c] ?? '')).join(',')).join('\n')
    const blob = new Blob([head + '\n' + body], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'aquier-seo-revenue.csv'
    a.click()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs uppercase tracking-widest text-white/40">{view.length} pagina&apos;s · sortering: {sort}</span>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-xs text-white/60 cursor-pointer">
            <input type="checkbox" checked={clir} onChange={(e) => setClir(e.target.checked)} /> alleen CLI-R
          </label>
          <button onClick={exportCsv} className="inline-flex items-center gap-1 text-xs text-white/60 hover:text-white">
            <Download size={14} /> CSV
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-white/10 bg-white/[0.02] overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 text-xs uppercase tracking-wider text-white/40">
              <th className="text-left py-3 px-4 font-medium">Pagina</th>
              {COLS.map(([k, lbl]) => (
                <th
                  key={k}
                  onClick={() => setSort(k)}
                  className="text-right py-3 px-4 font-medium cursor-pointer hover:text-white/80 select-none"
                >
                  {lbl}{sort === k ? ' ↓' : ''}
                </th>
              ))}
              <th className="text-right py-3 px-4 font-medium">€/sess</th>
              <th className="text-right py-3 px-4 font-medium">Rank</th>
            </tr>
          </thead>
          <tbody>
            {view.length === 0 ? (
              <tr>
                <td colSpan={10} className="text-center py-12 text-white/30">Geen data (echte 0/NULL — geen mockdata).</td>
              </tr>
            ) : (
              view.map((r) => (
                <tr key={r.slug} className="border-b border-white/5 hover:bg-white/[0.02]">
                  <td className="py-2.5 px-4">
                    <a href={`https://aquier.com${r.url}`} target="_blank" rel="noreferrer" className="text-white/80 hover:text-white hover:underline">
                      {r.slug}{r.is_clir ? ' ·' : ''}
                    </a>
                  </td>
                  <td className="text-right py-2.5 px-4 font-medium">{fmtNum(r.revenue_score)}</td>
                  <td className="text-right py-2.5 px-4">{fmtEur(r.total_revenue_eur)}</td>
                  <td className="text-right py-2.5 px-4">{r.report_sales}</td>
                  <td className="text-right py-2.5 px-4">{fmtEur(r.membership_mrr_eur)}</td>
                  <td className="text-right py-2.5 px-4">{r.lead_signals}</td>
                  <td className="text-right py-2.5 px-4">{r.financing_signals}</td>
                  <td className="text-right py-2.5 px-4">{r.sessions}</td>
                  <td className="text-right py-2.5 px-4 text-white/70">{fmtNum(r.revenue_per_session)}</td>
                  <td className="text-right py-2.5 px-4 text-white/40">{r.revenue_rank}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
