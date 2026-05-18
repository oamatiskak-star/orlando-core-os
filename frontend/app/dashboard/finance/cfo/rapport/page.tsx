'use client'

import { useEffect, useState } from 'react'
import { FileText, Download, RefreshCw, CheckCircle, Clock, ExternalLink } from 'lucide-react'
import type { CfoMonthlyReport } from '@/lib/finance/cfo-types'

function fmt(n: number) {
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)
}

const MAANDEN = ['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec']

export default function RapportPage() {
  const [reports,    setReports]    = useState<CfoMonthlyReport[]>([])
  const [generating, setGenerating] = useState(false)
  const [generated,  setGenerated]  = useState<{ id: string; period: string } | null>(null)
  const [loading,    setLoading]    = useState(true)

  async function loadReports() {
    const res  = await fetch('/api/finance/cfo/report/generate')
    const data = await res.json().catch(() => null)
    setReports(data?.reports ?? [])
    setLoading(false)
  }

  async function generateReport() {
    const now = new Date()
    setGenerating(true)
    setGenerated(null)

    const res = await fetch('/api/finance/cfo/report/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        period_year:  now.getFullYear(),
        period_month: now.getMonth() + 1,
      }),
    })

    const data = await res.json().catch(() => null)
    if (data?.success) {
      setGenerated({ id: data.report_id, period: data.period })
      await loadReports()
    }
    setGenerating(false)
  }

  useEffect(() => { loadReports() }, [])

  const now   = new Date()
  const year  = now.getFullYear()
  const month = now.getMonth() + 1

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-white flex items-center gap-2">
            <FileText size={16} className="text-green-400" />
            CFO Maandrapportages
          </h1>
          <p className="text-xs text-white/50 mt-0.5">Professionele rapportages — Deloitte/EY niveau</p>
        </div>
        <button
          onClick={generateReport}
          disabled={generating}
          className="flex items-center gap-1.5 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-xs font-medium px-3 py-2 rounded-lg transition-colors"
        >
          <RefreshCw size={12} className={generating ? 'animate-spin' : ''} />
          {generating ? 'Genereren...' : `Genereer ${MAANDEN[month - 1]} ${year}`}
        </button>
      </div>

      {/* Success banner */}
      {generated && (
        <div className="bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle size={14} className="text-green-400" />
            <span className="text-xs text-green-400">
              CFO Rapport voor {generated.period} succesvol gegenereerd
            </span>
          </div>
          <a
            href={`/api/finance/cfo/report/pdf?id=${generated.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 bg-green-600 hover:bg-green-500 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
          >
            <ExternalLink size={11} />
            Bekijk Rapport
          </a>
        </div>
      )}

      {/* Rapport kwaliteit uitleg */}
      <div className="bg-white/[0.06] border border-white/5 rounded-xl p-5">
        <h3 className="text-xs font-semibold text-white mb-3">Rapport Inhoud</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[
            { label: '01 Executive Summary', desc: 'AI-geschreven door CFO-laag, McKinsey niveau' },
            { label: '02 Financiële KPIs', desc: 'Omzet, kosten, marge, burnrate, runway' },
            { label: '03 Cashflow Analyse', desc: '30/60/90 dagenprognose met risicomomenten' },
            { label: '04 Belasting Status', desc: 'BTW, VPB, deadlines, reserveringen, gaps' },
            { label: '05 AI Adviezen', desc: 'Kostenoptimalisatie, groei, risico signalen' },
            { label: '06 CEO Actie Lijst', desc: 'Prioriteitsgeordende acties met impact' },
          ].map(item => (
            <div key={item.label} className="flex items-start gap-2">
              <CheckCircle size={12} className="text-green-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-medium text-white">{item.label}</p>
                <p className="text-[10px] text-white/50 mt-0.5">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Rapport archief */}
      <div className="bg-white/[0.06] border border-white/5 rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-white/5">
          <h3 className="text-xs font-semibold text-white">Rapport Archief</h3>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw size={14} className="text-white/30 animate-spin" />
          </div>
        ) : reports.length === 0 ? (
          <div className="p-8 text-center">
            <FileText size={24} className="text-white/20 mx-auto mb-3" />
            <p className="text-xs text-white/40">Nog geen rapporten gegenereerd.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr>
                {['Periode','Type','Omzet','Kosten','Nettowinst','Marge','Status','Acties'].map(h => (
                  <th key={h} className="text-left text-[10px] font-medium text-white/50 uppercase tracking-wider px-4 py-2.5 first:pl-5 last:pr-5">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {reports.map(report => (
                <tr key={report.id}>
                  <td className="px-4 py-3 first:pl-5">
                    <span className="text-xs font-semibold text-white">
                      {MAANDEN[report.period_month - 1]} {report.period_year}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-white/60 capitalize">{report.report_type.replace('_', ' ')}</td>
                  <td className="px-4 py-3 text-xs text-white/70">{fmt(report.revenue_total)}</td>
                  <td className="px-4 py-3 text-xs text-white/70">{fmt(report.costs_total)}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold ${report.profit_net >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {fmt(report.profit_net)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs ${report.profit_margin_pct >= 20 ? 'text-green-400' : report.profit_margin_pct >= 10 ? 'text-amber-400' : 'text-red-400'}`}>
                      {report.profit_margin_pct.toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                      report.status === 'gereed'    ? 'bg-green-500/10 text-green-400'
                      : report.status === 'concept' ? 'bg-amber-500/10 text-amber-400'
                      : report.status === 'fout'    ? 'bg-red-500/10 text-red-400'
                      : 'bg-white/5 text-white/50'
                    }`}>{report.status}</span>
                  </td>
                  <td className="px-4 py-3 last:pr-5">
                    {report.status === 'gereed' ? (
                      <a
                        href={`/api/finance/cfo/report/pdf?id=${report.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                      >
                        <ExternalLink size={11} />
                        Bekijk
                      </a>
                    ) : (
                      <span className="text-xs text-white/30">—</span>
                    )}
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
