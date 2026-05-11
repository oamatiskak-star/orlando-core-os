'use client'

import { useState } from 'react'
import { FileText, Download, Eye } from 'lucide-react'

const REPORTS = [
  {
    id: 'aging',
    title: 'Debiteuren Aging Report',
    description: 'Overzicht van alle openstaande facturen gesorteerd per vervalperiode (30/60/90/90+ dagen)',
    icon: FileText,
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
  },
  {
    id: 'cashflow',
    title: 'Cashflow Prognose',
    description: 'Verwachte inkomsten per periode (30/60/90 dagen) op basis van openstaande facturen',
    icon: FileText,
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
  },
  {
    id: 'incasso',
    title: 'Incasso Overzicht',
    description: 'Status rapport van alle incasso dossiers: kosten, rente, herstelpercentage',
    icon: FileText,
    color: 'text-red-400',
    bg: 'bg-red-500/10',
  },
  {
    id: 'risico',
    title: 'Klant Risico Rapport',
    description: 'AI-gegenereerde risicoscore per klant met betaalgedrag analyse en aanbevelingen',
    icon: FileText,
    color: 'text-purple-400',
    bg: 'bg-purple-500/10',
  },
]

const AGING_BUCKETS = [
  { label: '0–30 dagen', amount: 0, color: 'text-green-400' },
  { label: '31–60 dagen', amount: 0, color: 'text-amber-400' },
  { label: '61–90 dagen', amount: 0, color: 'text-orange-400' },
  { label: '90+ dagen', amount: 0, color: 'text-red-400' },
]

function fmt(amount: number) {
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(amount)
}

export default function RapportagesPage() {
  const [generating, setGenerating] = useState<string | null>(null)

  async function handleGenerate(id: string) {
    setGenerating(id)
    await new Promise((r) => setTimeout(r, 1500))
    setGenerating(null)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-lg font-semibold text-white">Rapportages</h1>
        <p className="text-xs text-white/30 mt-0.5">CFO-rapportages en financiële analyses</p>
      </div>

      {/* Report cards */}
      <div className="grid grid-cols-2 gap-4">
        {REPORTS.map((report) => {
          const Icon = report.icon
          const isGenerating = generating === report.id
          return (
            <div key={report.id} className="bg-white/[0.03] border border-white/5 rounded-xl p-5">
              <div className="flex items-start gap-3 mb-4">
                <div className={`w-9 h-9 rounded-lg ${report.bg} flex items-center justify-center flex-shrink-0`}>
                  <Icon size={16} className={report.color} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-white">{report.title}</h3>
                  <p className="text-xs text-white/40 mt-1 leading-relaxed">{report.description}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleGenerate(report.id)}
                  disabled={isGenerating}
                  className="border border-white/10 text-white/50 hover:text-white text-xs px-4 py-2 rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Download size={11} />
                  {isGenerating ? 'Genereren...' : 'Genereer PDF'}
                </button>
                <button className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium px-4 py-2 rounded-lg transition-colors flex items-center gap-1.5">
                  <Eye size={11} />
                  Bekijk
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Aging table */}
      <div className="bg-white/[0.03] border border-white/5 rounded-xl p-5">
        <h3 className="text-xs font-semibold text-white mb-4">Debiteuren Aging — Huidig Overzicht</h3>
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/5">
              <th className="pb-3 text-left text-[10px] font-medium text-white/30 uppercase tracking-wider">Periode</th>
              <th className="pb-3 text-right text-[10px] font-medium text-white/30 uppercase tracking-wider">Bedrag</th>
              <th className="pb-3 text-right text-[10px] font-medium text-white/30 uppercase tracking-wider">% van totaal</th>
              <th className="pb-3 text-right text-[10px] font-medium text-white/30 uppercase tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {AGING_BUCKETS.map((bucket) => (
              <tr key={bucket.label}>
                <td className="py-3 text-xs text-white/70">{bucket.label}</td>
                <td className={`py-3 text-xs font-medium text-right ${bucket.color}`}>{fmt(bucket.amount)}</td>
                <td className="py-3 text-xs text-white/30 text-right">0%</td>
                <td className="py-3 text-right">
                  <span className="bg-white/5 text-white/30 px-2 py-0.5 rounded-full text-[10px] font-medium">
                    Geen data
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-white/10">
              <td className="pt-3 text-xs font-semibold text-white">Totaal</td>
              <td className="pt-3 text-xs font-semibold text-white text-right">{fmt(0)}</td>
              <td className="pt-3 text-xs text-white/40 text-right">100%</td>
              <td />
            </tr>
          </tfoot>
        </table>
        <p className="text-[10px] text-white/20 mt-3">
          Data wordt geladen vanuit fin_invoices. Installeer de Finance OS database om live data te zien.
        </p>
      </div>
    </div>
  )
}
