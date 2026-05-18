'use client'

import { useState } from 'react'
import { FileText, Download, Loader2, Calendar, TrendingUp, AlertTriangle, CheckCircle2 } from 'lucide-react'

type ReportData = {
  generated_at: string
  mode: string
  snapshot: {
    ar_open: number
    ar_overdue: number
    ar_incasso: number
    active_projects: number
    budget_utilization_pct: number
    active_cfo_alerts: number
    active_osil_alerts: number
    survival_mode: boolean
    growth_mode: boolean
  }
  analysis: string
  recommendations: Array<{ priority: string; action: string; category: string }>
}

function fmt(n: number) {
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)
}

function ModeChip({ mode }: { mode: string }) {
  const cfg = {
    SURVIVAL: 'text-red-400 bg-red-500/15 border-red-500/25',
    GROEI:    'text-emerald-400 bg-emerald-500/15 border-emerald-500/25',
    BALANS:   'text-indigo-400 bg-indigo-500/15 border-indigo-500/25',
  }[mode] ?? 'text-white/50 bg-white/5 border-white/10'
  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${cfg}`}>{mode}</span>
  )
}

function downloadHtml(data: ReportData) {
  const date = new Date(data.generated_at).toLocaleDateString('nl-NL', { dateStyle: 'long' })
  const analysis = data.analysis.split('\n').filter(l => l.trim()).map(l => `<p style="margin:4px 0;color:#ccc;font-size:13px">${l}</p>`).join('')
  const recs = data.recommendations.map(r => `
    <div style="display:flex;gap:10px;align-items:center;margin:6px 0">
      <span style="padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;background:${r.priority === 'kritiek' ? '#7f1d1d' : r.priority === 'hoog' ? '#78350f' : '#1e1b4b'};color:${r.priority === 'kritiek' ? '#fca5a5' : r.priority === 'hoog' ? '#fcd34d' : '#a5b4fc'}">
        ${r.priority.toUpperCase()}
      </span>
      <span style="color:#d1d5db;font-size:13px">${r.action}</span>
    </div>
  `).join('')

  const html = `<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="utf-8">
  <title>OSIL Strategisch Rapport — ${date}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #09090b; color: #e4e4e7; padding: 40px; }
    .header { border-bottom: 1px solid #27272a; padding-bottom: 24px; margin-bottom: 32px; }
    .logo { font-size: 11px; font-weight: 700; color: #6366f1; letter-spacing: 0.15em; text-transform: uppercase; margin-bottom: 12px; }
    h1 { font-size: 26px; font-weight: 700; color: #fff; }
    .meta { font-size: 12px; color: #71717a; margin-top: 8px; }
    .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 28px; }
    .kpi { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; padding: 14px; }
    .kpi-label { font-size: 10px; color: #71717a; text-transform: uppercase; letter-spacing: 0.08em; }
    .kpi-value { font-size: 18px; font-weight: 700; color: #fff; margin-top: 4px; }
    .section { margin-bottom: 28px; }
    .section-title { font-size: 11px; font-weight: 700; color: #6366f1; text-transform: uppercase; letter-spacing: 0.1em; border-bottom: 1px solid rgba(99,102,241,0.2); padding-bottom: 8px; margin-bottom: 14px; }
    .analysis { background: rgba(255,255,255,0.03); border-radius: 10px; padding: 16px; }
    .footer { margin-top: 40px; border-top: 1px solid #27272a; padding-top: 16px; font-size: 11px; color: #52525b; }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">Orlando Strategic Intelligence Layer</div>
    <h1>Strategisch Rapport</h1>
    <div class="meta">${date} &nbsp;·&nbsp; Modus: <strong style="color:${data.mode === 'SURVIVAL' ? '#f87171' : data.mode === 'GROEI' ? '#34d399' : '#818cf8'}">${data.mode}</strong></div>
  </div>

  <div class="section">
    <div class="section-title">KPI Snapshot</div>
    <div class="kpi-grid">
      <div class="kpi"><div class="kpi-label">Open AR</div><div class="kpi-value">${fmt(data.snapshot.ar_open)}</div></div>
      <div class="kpi"><div class="kpi-label">Vervallen AR</div><div class="kpi-value" style="color:#f87171">${fmt(data.snapshot.ar_overdue)}</div></div>
      <div class="kpi"><div class="kpi-label">Incasso</div><div class="kpi-value" style="color:#fbbf24">${fmt(data.snapshot.ar_incasso)}</div></div>
      <div class="kpi"><div class="kpi-label">Actieve Projecten</div><div class="kpi-value">${data.snapshot.active_projects}</div></div>
      <div class="kpi"><div class="kpi-label">Budget Utilization</div><div class="kpi-value">${data.snapshot.budget_utilization_pct}%</div></div>
      <div class="kpi"><div class="kpi-label">CFO Alerts</div><div class="kpi-value">${data.snapshot.active_cfo_alerts}</div></div>
      <div class="kpi"><div class="kpi-label">OSIL Alerts</div><div class="kpi-value">${data.snapshot.active_osil_alerts}</div></div>
      <div class="kpi"><div class="kpi-label">Modus</div><div class="kpi-value" style="font-size:14px">${data.mode}</div></div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">AI Strategische Analyse</div>
    <div class="analysis">${analysis}</div>
  </div>

  <div class="section">
    <div class="section-title">Prioritaire Acties</div>
    ${recs}
  </div>

  <div class="footer">
    Gegenereerd door Orlando AI OS &nbsp;·&nbsp; OSIL v1 &nbsp;·&nbsp; ${new Date(data.generated_at).toLocaleString('nl-NL')}
  </div>
</body>
</html>`

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `osil-rapport-${new Date(data.generated_at).toISOString().slice(0, 10)}.html`
  a.click()
  URL.revokeObjectURL(url)
}

export default function RapportPage() {
  const [loading, setLoading] = useState(false)
  const [report, setReport] = useState<ReportData | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function generate() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/osil/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error ?? 'Onbekende fout')
      setReport({
        generated_at: new Date().toISOString(),
        mode: d.mode,
        snapshot: d.snapshot,
        analysis: d.analysis,
        recommendations: d.recommendations,
      })
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  const analysisLines = report?.analysis.split('\n').filter(l => l.trim()) ?? []

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-white">Strategisch Rapport</h1>
          <p className="text-xs text-white/50 mt-0.5">Executive rapport op basis van live data</p>
        </div>
        {report && (
          <button
            onClick={() => downloadHtml(report)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium hover:bg-emerald-500/20 transition-colors"
          >
            <Download size={12} />
            Download HTML
          </button>
        )}
      </div>

      {/* Generate trigger */}
      {!report && (
        <div className="py-16 text-center space-y-4">
          <FileText size={36} className="text-indigo-400/30 mx-auto" />
          <div>
            <p className="text-sm text-white/50">Genereer een live strategisch rapport</p>
            <p className="text-xs text-white/28 mt-0.5">Verzamelt live data → AI analyse → exporteerbaar</p>
          </div>
          <button
            onClick={generate}
            disabled={loading}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-500/15 border border-indigo-500/25 text-indigo-300 text-sm font-medium hover:bg-indigo-500/25 transition-colors disabled:opacity-50"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <TrendingUp size={14} />}
            {loading ? 'Genereren...' : 'Rapport Genereren'}
          </button>
          {error && (
            <p className="text-xs text-red-400 mt-2">{error}</p>
          )}
        </div>
      )}

      {/* Report view */}
      {report && (
        <div className="space-y-4">
          {/* Meta bar */}
          <div className="flex items-center gap-3 p-3 bg-white/[0.04] border border-white/5 rounded-xl">
            <Calendar size={13} className="text-white/38" />
            <span className="text-xs text-white/55">
              {new Date(report.generated_at).toLocaleString('nl-NL', { dateStyle: 'medium', timeStyle: 'short' })}
            </span>
            <div className="ml-auto">
              <ModeChip mode={report.mode} />
            </div>
          </div>

          {/* KPI strip */}
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: 'Open AR', value: fmt(report.snapshot.ar_open), color: 'text-white/80' },
              { label: 'Vervallen AR', value: fmt(report.snapshot.ar_overdue), color: 'text-red-400' },
              { label: 'Incasso', value: fmt(report.snapshot.ar_incasso), color: 'text-amber-400' },
              { label: 'Budget', value: `${report.snapshot.budget_utilization_pct}%`, color: 'text-indigo-400' },
            ].map(k => (
              <div key={k.label} className="bg-white/[0.04] border border-white/5 rounded-xl p-3 text-center">
                <p className="text-[9px] text-white/38">{k.label}</p>
                <p className={`text-sm font-bold mt-0.5 ${k.color}`}>{k.value}</p>
              </div>
            ))}
          </div>

          {/* AI analysis */}
          <div className="bg-white/[0.04] border border-white/5 rounded-xl p-4">
            <p className="text-[10px] font-semibold text-white/45 uppercase tracking-wider mb-3">AI Strategische Analyse</p>
            <div className="space-y-1.5 max-h-96 overflow-y-auto">
              {analysisLines.map((line, i) => (
                <p key={i} className={`text-xs leading-relaxed ${
                  line.match(/^\d\./) ? 'text-white/85 font-semibold mt-2' :
                  line.startsWith('-') ? 'text-white/60 pl-3' :
                  'text-white/50'
                }`}>{line}</p>
              ))}
            </div>
          </div>

          {/* Recommendations */}
          <div className="bg-white/[0.04] border border-white/5 rounded-xl p-4">
            <p className="text-[10px] font-semibold text-white/45 uppercase tracking-wider mb-3">Prioritaire Acties</p>
            <div className="space-y-2">
              {report.recommendations.map((r, i) => (
                <div key={i} className="flex items-center gap-3">
                  {r.priority === 'kritiek' ? (
                    <AlertTriangle size={13} className="text-red-400 flex-shrink-0" />
                  ) : (
                    <CheckCircle2 size={13} className={r.priority === 'hoog' ? 'text-amber-400' : 'text-indigo-400'} />
                  )}
                  <span className="text-xs text-white/65">{r.action}</span>
                  <span className={`ml-auto text-[10px] font-medium px-1.5 py-0.5 rounded flex-shrink-0 ${
                    r.priority === 'kritiek' ? 'text-red-400 bg-red-500/10' :
                    r.priority === 'hoog' ? 'text-amber-400 bg-amber-500/10' :
                    'text-indigo-400 bg-indigo-500/10'
                  }`}>{r.priority}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Regenerate */}
          <button
            onClick={generate}
            disabled={loading}
            className="w-full py-2 rounded-xl border border-white/8 text-xs text-white/35 hover:text-white/55 hover:border-white/15 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading && <Loader2 size={11} className="animate-spin" />}
            Nieuw rapport genereren
          </button>
        </div>
      )}
    </div>
  )
}
