'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, Loader2, AlertTriangle, TrendingUp, TrendingDown,
  Shield, Zap, CheckCircle, XCircle, ArrowRight, FileBarChart,
} from 'lucide-react'

const fmt = (n: number | null | undefined) =>
  n != null ? new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n) : '—'

const SEV_STYLE: Record<string, string> = {
  Laag:      'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  Gemiddeld: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  Hoog:      'bg-red-500/10 text-red-400 border-red-500/20',
  'Zeer hoog':'bg-red-600/15 text-red-300 border-red-600/30',
}

const CLASS_STYLE: Record<string, { badge: string; glow: string }> = {
  A: { badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30', glow: 'border-emerald-500/20' },
  B: { badge: 'bg-amber-500/20 text-amber-300 border-amber-500/30',       glow: 'border-amber-500/20'   },
  C: { badge: 'bg-red-500/20 text-red-300 border-red-500/30',             glow: 'border-red-500/20'     },
}

type Report = {
  dealType: string
  executiveSummary: string
  whyInteresting: string
  totalInvestment: number
  endValue: number
  netProfit: number
  roiPercentage: number
  timeline: string
  exitStrategy: string
  riskScore: string
  riskScoreNumeric: number
  developmentPlan: {
    recommendedStrategy: string
    steps: string[]
    reasoning: string
    keyDataPoints: string[]
  }
  financialAnalysis: {
    costs: { label: string; amount: number }[]
    revenues: { label: string; amount: number }[]
    kpis: { roi: number; roe: number; irr: number; netProfit: number; breakEvenMonths: number; profitPerSqm: number; riskIndex: number }
  }
  riskAnalysis: { category: string; items: { name: string; level: string; description: string }[] }[]
  aiConclusion: string
}

type Deal = { id: string; address: string | null; city: string | null; asking_price: number | null; sqm: number | null; class: string | null; deal_score: number | null; energy_label: string | null; labels: string[] }

export default function RapportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [deal, setDeal]     = useState<Deal | null>(null)
  const [report, setReport] = useState<Report | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/vastgoed/deals/${id}/rapport`)
      .then(r => r.ok ? r.json() : Promise.reject('Niet gevonden'))
      .then(d => { setDeal(d.deal); setReport(d.report) })
      .catch(() => setError('Rapport kon niet worden geladen.'))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-96 gap-4">
      <div className="relative">
        <Loader2 className="w-10 h-10 text-amber-400 animate-spin" />
      </div>
      <div className="text-center">
        <p className="text-sm font-semibold text-white">AI rapport genereren...</p>
        <p className="text-xs text-white/50 mt-1">Claude analyseert de deal — even geduld</p>
      </div>
    </div>
  )

  if (error || !deal || !report) return (
    <div className="flex flex-col items-center justify-center h-96 gap-4">
      <AlertTriangle className="w-8 h-8 text-red-400" />
      <p className="text-sm text-white/60">{error ?? 'Rapport niet beschikbaar'}</p>
      <button onClick={() => router.push('/dashboard/vastgoed')}
        className="flex items-center gap-2 px-4 py-2 text-xs bg-white/5 hover:bg-white/10 text-white rounded-lg transition-colors">
        <ArrowLeft size={14} /> Terug
      </button>
    </div>
  )

  const cls = CLASS_STYLE[deal.class ?? ''] ?? CLASS_STYLE.B
  const score = deal.deal_score ?? report.riskScoreNumeric ?? 5

  return (
    <div className="space-y-5 max-w-5xl mx-auto pb-16">

      {/* Top bar */}
      <div className="flex items-center justify-between">
        <button onClick={() => router.push('/dashboard/vastgoed')}
          className="flex items-center gap-2 text-xs text-white/65 hover:text-white transition-colors">
          <ArrowLeft size={14} /> Vastgoed Deals
        </button>
        <button onClick={() => window.print()}
          className="text-xs text-white/50 hover:text-white/60 transition-colors">
          Print rapport
        </button>
      </div>

      {/* ── HERO ── */}
      <div className={`bg-white/[0.06] border ${cls.glow} rounded-2xl overflow-hidden`}>
        <div className="px-6 py-5">
          <div className="flex items-start justify-between gap-4 mb-5">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className={`text-[10px] font-black px-2.5 py-1 rounded-lg border tracking-widest ${cls.badge}`}>
                  {deal.class}-DEAL
                </span>
                <span className="text-[10px] font-bold text-white/50 uppercase tracking-widest">{report.dealType}</span>
              </div>
              <h1 className="text-xl font-black text-white">{deal.address ?? 'Onbekend adres'}</h1>
              <p className="text-sm text-white/65 mt-0.5">{deal.city}{deal.energy_label ? ` · Label ${deal.energy_label}` : ''}{deal.sqm ? ` · ${deal.sqm}m²` : ''}</p>
            </div>
            <div className={`text-xs font-bold px-3 py-1.5 rounded-lg border ${SEV_STYLE[report.riskScore] ?? SEV_STYLE.Gemiddeld}`}>
              Risico: {report.riskScore}
            </div>
          </div>

          {/* KPI tiles */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            {[
              { label: 'Vraagprijs',      value: fmt(deal.asking_price),    sub: deal.sqm && deal.asking_price ? `${fmt(Math.round(deal.asking_price / deal.sqm))}/m²` : '' },
              { label: 'Investering',     value: fmt(report.totalInvestment), sub: 'totaal incl. kosten' },
              { label: 'Eindwaarde',      value: fmt(report.endValue),       sub: 'na ontwikkeling' },
              { label: 'Netto winst',     value: fmt(report.netProfit),      sub: `ROI ${report.roiPercentage.toFixed(1)}%`, hi: report.netProfit > 0 },
            ].map(t => (
              <div key={t.label} className={`rounded-xl border p-4 ${t.hi ? 'bg-emerald-500/8 border-emerald-500/20' : 'bg-white/[0.06] border-white/8'}`}>
                <p className="text-[9px] font-semibold text-white/50 uppercase tracking-wider mb-1">{t.label}</p>
                <p className={`text-lg font-black ${t.hi ? 'text-emerald-300' : 'text-white'}`}>{t.value}</p>
                {t.sub && <p className="text-[9px] text-white/45 mt-0.5">{t.sub}</p>}
              </div>
            ))}
          </div>

          {/* Stat row */}
          <div className="grid grid-cols-3 lg:grid-cols-6 gap-2">
            {[
              { label: 'ROI',       value: `${report.roiPercentage.toFixed(1)}%`, color: report.roiPercentage >= 15 ? 'text-emerald-400' : 'text-white' },
              { label: 'Looptijd',  value: report.timeline,           color: 'text-white' },
              { label: 'Exit',      value: report.exitStrategy,       color: 'text-white/70' },
              { label: 'Risico',    value: report.riskScore,          color: report.riskScore === 'Laag' ? 'text-emerald-400' : report.riskScore === 'Hoog' ? 'text-red-400' : 'text-amber-400' },
              { label: 'Score',     value: `${score}/10`,             color: score >= 7 ? 'text-emerald-400' : 'text-white' },
              { label: 'Type',      value: report.dealType,           color: 'text-indigo-400' },
            ].map(t => (
              <div key={t.label} className="bg-white/[0.06] rounded-lg border border-white/8 px-3 py-2.5">
                <p className="text-[9px] font-semibold text-white/50 uppercase tracking-wider mb-0.5">{t.label}</p>
                <p className={`text-xs font-bold truncate ${t.color}`}>{t.value}</p>
              </div>
            ))}
          </div>

          {/* Score bar */}
          <div className="mt-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[9px] text-white/50 uppercase tracking-wider">AI Deal Score</span>
              <span className="text-xs font-black text-amber-400">{score}/10</span>
            </div>
            <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${score >= 7 ? 'bg-emerald-500' : score >= 5 ? 'bg-amber-500' : 'bg-red-500'}`}
                style={{ width: `${(score / 10) * 100}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* ── EXECUTIVE SUMMARY ── */}
      <div className="bg-white/[0.06] border border-white/8 rounded-2xl p-6 space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <FileBarChart size={16} className="text-indigo-400" />
          <h2 className="text-sm font-bold text-white">Executive Summary</h2>
        </div>
        <div className="bg-white/[0.06] rounded-xl border border-white/5 p-4">
          <p className="text-[10px] font-semibold text-white/50 uppercase tracking-wider mb-2">Waarom interessant</p>
          <p className="text-sm text-white/70 leading-relaxed">{report.whyInteresting}</p>
        </div>
        <p className="text-sm text-white/50 leading-relaxed">{report.executiveSummary}</p>
      </div>

      {/* ── ONTWIKKELPLAN ── */}
      <div className="bg-white/[0.06] border border-white/8 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-white/5 flex items-center gap-2">
          <Zap size={16} className="text-amber-400" />
          <h2 className="text-sm font-bold text-white">AI Ontwikkelplan</h2>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-0">
          <div className="lg:col-span-3 p-6 space-y-4">
            <div className="bg-amber-500/8 border border-amber-500/20 rounded-xl p-4">
              <p className="text-[9px] font-bold text-amber-400/70 uppercase tracking-wider mb-1">Aanbevolen strategie</p>
              <p className="text-sm font-bold text-white">{report.developmentPlan.recommendedStrategy}</p>
            </div>
            <div>
              <p className="text-[9px] font-bold text-white/50 uppercase tracking-wider mb-3">Stappenplan</p>
              <div className="space-y-2">
                {report.developmentPlan.steps.map((step, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <span className="w-5 h-5 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 text-[10px] font-black flex items-center justify-center flex-shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    <p className="text-xs text-white/60">{step}</p>
                  </div>
                ))}
              </div>
            </div>
            <p className="text-xs text-white/65 leading-relaxed border-t border-white/5 pt-4">
              {report.developmentPlan.reasoning}
            </p>
          </div>
          <div className="lg:col-span-2 p-6 bg-white/[0.02] border-t lg:border-t-0 lg:border-l border-white/5 space-y-3">
            <p className="text-[9px] font-bold text-white/50 uppercase tracking-wider">Onderbouwing</p>
            {report.developmentPlan.keyDataPoints.map((pt, i) => (
              <div key={i} className="flex items-start gap-2 py-2 border-b border-white/5 last:border-0">
                <CheckCircle size={12} className="text-emerald-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-white/50">{pt}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── FINANCIEEL ── */}
      <div className="bg-white/[0.06] border border-white/8 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-white/5 flex items-center gap-2">
          <TrendingUp size={16} className="text-emerald-400" />
          <h2 className="text-sm font-bold text-white">Financiële Analyse</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-white/5">
          {/* Kosten */}
          <div className="p-6">
            <div className="flex items-center gap-1.5 mb-4">
              <TrendingDown size={14} className="text-red-400" />
              <p className="text-[9px] font-bold text-white/50 uppercase tracking-wider">Kostenkant</p>
            </div>
            <div className="space-y-0">
              {report.financialAnalysis.costs.map((c, i) => (
                <div key={i} className="flex justify-between py-2 border-b border-white/5 last:border-0">
                  <span className="text-xs text-white/50">{c.label}</span>
                  <span className="text-xs font-semibold text-white">{fmt(c.amount)}</span>
                </div>
              ))}
              <div className="flex justify-between pt-3 border-t border-white/15 mt-1">
                <span className="text-xs font-black text-white">Totale investering</span>
                <span className="text-xs font-black text-white">{fmt(report.totalInvestment)}</span>
              </div>
            </div>
          </div>
          {/* Opbrengsten */}
          <div className="p-6">
            <div className="flex items-center gap-1.5 mb-4">
              <TrendingUp size={14} className="text-emerald-400" />
              <p className="text-[9px] font-bold text-white/50 uppercase tracking-wider">Opbrengsten</p>
            </div>
            <div className="space-y-0">
              {report.financialAnalysis.revenues.map((r, i) => (
                <div key={i} className="flex justify-between py-2 border-b border-white/5 last:border-0">
                  <span className="text-xs text-white/50">{r.label}</span>
                  <span className="text-xs font-semibold text-white">{fmt(r.amount)}</span>
                </div>
              ))}
            </div>
            <div className={`mt-4 p-4 rounded-xl border ${report.netProfit >= 0 ? 'bg-emerald-500/8 border-emerald-500/20' : 'bg-red-500/8 border-red-500/20'}`}>
              <p className="text-[9px] text-white/50 uppercase font-medium mb-1">Netto resultaat</p>
              <div className="flex items-end justify-between">
                <p className={`text-2xl font-black ${report.netProfit >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>{fmt(report.netProfit)}</p>
                <p className={`text-sm font-bold ${report.netProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>ROI {report.roiPercentage.toFixed(1)}%</p>
              </div>
            </div>
          </div>
        </div>
        {/* KPI blok */}
        <div className="border-t border-white/5 px-6 py-5">
          <p className="text-[9px] font-bold text-white/50 uppercase tracking-wider mb-3">Key Performance Indicators</p>
          <div className="grid grid-cols-3 lg:grid-cols-7 gap-2">
            {Object.entries(report.financialAnalysis.kpis).map(([key, val]) => {
              const labels: Record<string, string> = { roi: 'ROI', roe: 'ROE', irr: 'IRR', netProfit: 'Winst', breakEvenMonths: 'Break-even', profitPerSqm: 'Winst/m²', riskIndex: 'Risico' }
              const isEur = key === 'netProfit' || key === 'profitPerSqm'
              const isMnd = key === 'breakEvenMonths'
              const display = isEur ? fmt(val) : isMnd ? `${val}mnd` : `${typeof val === 'number' ? val.toFixed(1) : val}${key !== 'riskIndex' && !isMnd ? '%' : ''}`
              return (
                <div key={key} className="bg-white/[0.06] rounded-lg border border-white/5 p-2.5 text-center">
                  <p className="text-[8px] text-white/45 uppercase font-medium mb-1">{labels[key] ?? key}</p>
                  <p className="text-xs font-black text-white">{display}</p>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── RISICO ── */}
      <div className="bg-white/[0.06] border border-white/8 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield size={16} className="text-red-400" />
            <h2 className="text-sm font-bold text-white">Risico Analyse</h2>
          </div>
          <span className={`text-xs font-bold px-3 py-1 rounded-lg border ${SEV_STYLE[report.riskScore] ?? SEV_STYLE.Gemiddeld}`}>
            {report.riskScore}
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-6">
          {report.riskAnalysis.map(cat => (
            <div key={cat.category} className="bg-white/[0.02] rounded-xl border border-white/5 overflow-hidden">
              <div className="px-4 py-2.5 border-b border-white/5">
                <p className="text-xs font-bold text-white/70">{cat.category}</p>
              </div>
              <div className="divide-y divide-white/5">
                {cat.items.map((item, i) => (
                  <div key={i} className="px-4 py-3">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-semibold text-white/80">{item.name}</p>
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded border ${SEV_STYLE[item.level] ?? SEV_STYLE.Gemiddeld}`}>
                        {item.level}
                      </span>
                    </div>
                    <p className="text-[11px] text-white/58 leading-relaxed">{item.description}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── CONCLUSIE ── */}
      <div className="bg-white/[0.06] border border-white/8 rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <CheckCircle size={16} className="text-indigo-400" />
          <h2 className="text-sm font-bold text-white">AI Conclusie</h2>
        </div>
        <div className="bg-gradient-to-br from-indigo-500/8 to-slate-900/50 border border-indigo-500/15 rounded-xl p-5">
          <p className="text-sm text-white/80 leading-relaxed">{report.aiConclusion}</p>
        </div>
      </div>

      {/* ── UPSELL ── */}
      <div className="space-y-3">
        <div className="bg-gradient-to-r from-amber-500/10 to-white/[0.02] border border-amber-500/20 rounded-2xl p-5 flex items-center justify-between">
          <div>
            <p className="text-sm font-black text-white mb-1">Direct laten uitwerken?</p>
            <p className="text-xs text-white/65">Van rapport naar volledige ontwikkelstraat</p>
          </div>
          <div className="hidden lg:flex items-center gap-1 text-[10px] text-white/50">
            {['Calculatie', 'Tekeningen', 'Vergunning', 'Bouw', 'Exit'].map((s, i, a) => (
              <span key={s} className="flex items-center gap-1">
                <span className="text-white/50">{s}</span>
                {i < a.length - 1 && <ArrowRight size={10} className="text-white/38" />}
              </span>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {[
            { title: 'Bouwcalculatie',       price: '€1.500 – €7.500',  desc: 'STABU calculatie op aannemersniveau', hi: true },
            { title: 'Architect tekeningen', price: '€5.000 – €25.000', desc: 'Plattegronden, VO/DO, vergunning' },
            { title: 'Constructieberekening',price: '€2.500 – €10.000', desc: 'NEN-berekeningen, funderingsadvies' },
            { title: 'Installatietekeningen',price: '€2.500 – €15.000', desc: 'E+W installaties, warmtepomp, ventilatie' },
            { title: '3D Renders',           price: '€750 – €5.000',   desc: 'Fotorealistische visualisaties' },
            { title: 'Vergunningstraject',   price: '€2.500 – €15.000', desc: 'Omgevingsvergunning van A tot Z' },
          ].map(s => (
            <div key={s.title} className={`bg-white/[0.06] rounded-xl border p-4 hover:border-white/15 transition-colors ${s.hi ? 'border-amber-500/25' : 'border-white/8'}`}>
              <p className="text-xs font-bold text-white mb-0.5">{s.title}</p>
              <p className="text-[10px] text-white/58 mb-3">{s.desc}</p>
              <div className="flex items-center justify-between">
                <span className={`text-xs font-black ${s.hi ? 'text-amber-400' : 'text-white/60'}`}>{s.price}</span>
                <button className={`flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1 rounded-lg transition-colors ${s.hi ? 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30' : 'bg-white/5 text-white/65 hover:bg-white/10 hover:text-white/70'}`}>
                  Aanvragen <ArrowRight size={10} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}
