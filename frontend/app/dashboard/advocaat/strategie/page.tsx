'use client'

import { useEffect, useState } from 'react'
import { Brain, Zap, Shield, TrendingUp, AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react'
import type { Dossier } from '@/lib/advocaat/types'

type StrategieResult = {
  strategie: Record<string, unknown>
  analyse: string
}

const ANALYSE_TYPES = [
  { key: 'volledig',         label: 'Volledig',          desc: 'Complete juridische analyse' },
  { key: 'curator',          label: 'Curator Defense',   desc: 'Focus: faillissement & curator' },
  { key: 'contractueel',     label: 'Contractueel',      desc: 'Contractgeschillen & nakoming' },
  { key: 'aansprakelijkheid',label: 'Aansprakelijkheid', desc: 'Bestuurdersaansprakelijkheid' },
  { key: 'mediatie',         label: 'Mediatie',          desc: 'Schikking & onderhandeling' },
  { key: 'snelanalyse',      label: 'Snelanalyse',       desc: 'Beknopte risico-inschatting' },
]

function parseAnalysis(text: string) {
  const sections: { title: string; content: string }[] = []
  const lines = text.split('\n')
  let current: { title: string; content: string } | null = null

  for (const line of lines) {
    if (/^\d+\./.test(line.trim()) || /^#{1,3}\s/.test(line.trim())) {
      if (current) sections.push(current)
      current = { title: line.replace(/^[\d.#\s]+/, '').trim(), content: '' }
    } else if (current) {
      current.content += (current.content ? '\n' : '') + line
    }
  }
  if (current) sections.push(current)
  return sections.length > 1 ? sections : [{ title: 'Analyse', content: text }]
}

export default function StrategiePage() {
  const [dossiers,   setDossiers]   = useState<Dossier[]>([])
  const [selected,   setSelected]   = useState('')
  const [type,       setType]       = useState('volledig')
  const [loading,    setLoading]    = useState(false)
  const [result,     setResult]     = useState<StrategieResult | null>(null)
  const [history,    setHistory]    = useState<Record<string, unknown>[]>([])

  useEffect(() => {
    fetch('/api/advocaat/dossiers?limit=50').then(r => r.json()).then(d => setDossiers(d.dossiers ?? [])).catch(() => {})
  }, [])

  async function analyze() {
    if (!selected) return
    setLoading(true)
    setResult(null)
    const res = await fetch('/api/advocaat/analyze', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ dossier_id: selected, analyse_type: type }),
    }).then(r => r.json()).catch(() => null)
    setResult(res)
    setLoading(false)
  }

  const sections = result?.analyse ? parseAnalysis(result.analyse) : []

  const SECTION_ICONS: Record<number, typeof Brain> = {
    0: Brain, 1: Shield, 2: AlertTriangle, 3: TrendingUp, 4: Zap, 5: CheckCircle, 6: Brain,
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white p-6 space-y-6">

      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
          <Brain className="w-5 h-5 text-emerald-400" />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-white">Juridische Strategie Engine</h1>
          <p className="text-xs text-white/40 mt-0.5">AI juridische analyse · Niveau topkantoor 25+ jaar ervaring</p>
        </div>
      </div>

      {/* Config */}
      <div className="bg-white/[0.03] border border-white/[0.07] rounded-xl p-4 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-[10px] text-white/40 uppercase tracking-wider">Dossier</label>
            <select value={selected} onChange={e => setSelected(e.target.value)}
              className="w-full mt-1 px-3 py-2 rounded-lg bg-white/[0.05] border border-white/[0.08] text-sm text-white focus:outline-none focus:border-emerald-500/40">
              <option value="">Selecteer dossier...</option>
              {dossiers.map(d => <option key={d.id} value={d.id}>{d.title}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] text-white/40 uppercase tracking-wider">Analyse type</label>
            <div className="flex gap-2 mt-1 flex-wrap">
              {ANALYSE_TYPES.map(t => (
                <button key={t.key} onClick={() => setType(t.key)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs border transition-all ${type === t.key ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-white/[0.04] border-white/[0.08] text-white/50 hover:text-white hover:bg-white/[0.08]'}`}
                  title={t.desc}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <button onClick={analyze} disabled={!selected || loading}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
          <Brain className={`w-4 h-4 ${loading ? 'animate-pulse' : ''}`} />
          {loading ? 'AI Analyse uitvoeren — even geduld...' : 'Juridische Strategie Analyse Starten'}
        </button>

        <div className="text-[10px] text-white/25 text-center">
          Alle analyses worden gelabeld als FEIT / INTERPRETATIE / RISICO / VERMOEDEN. Confidence score wordt meegeleverd.
          Raadpleeg altijd een advocaat voor definitieve beslissingen.
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="bg-emerald-500/5 border border-emerald-500/15 rounded-xl p-6 text-center space-y-3">
          <div className="flex items-center justify-center gap-2">
            <Brain className="w-5 h-5 text-emerald-400 animate-pulse" />
            <span className="text-sm text-emerald-300">AI analyseert het volledige dossier...</span>
          </div>
          <p className="text-xs text-white/30">Documenten worden verwerkt, risico&apos;s worden geëvalueerd, tijdlijn wordt geanalyseerd</p>
        </div>
      )}

      {/* Result */}
      {result && !loading && (
        <div className="space-y-4">

          {/* Summary cards */}
          {result.strategie && (
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Sterke punten', icon: CheckCircle, color: 'emerald', value: (result.strategie as any).sterke_punten?.length ?? 0 },
                { label: 'Zwakke punten', icon: AlertTriangle, color: 'orange', value: (result.strategie as any).zwakke_punten?.length ?? 0 },
                { label: 'Slagingskans', icon: TrendingUp, color: 'blue',
                  value: (result.strategie as any).rechtbank_kansen != null ? `${(result.strategie as any).rechtbank_kansen}%` : '—' },
              ].map(s => (
                <div key={s.label} className={`p-3 rounded-xl bg-${s.color}-500/5 border border-${s.color}-500/15`}>
                  <s.icon className={`w-4 h-4 text-${s.color}-400 mb-1`} />
                  <div className={`text-xl font-bold text-${s.color}-400`}>{s.value}</div>
                  <div className="text-[10px] text-white/40">{s.label}</div>
                </div>
              ))}
            </div>
          )}

          {/* Analysis sections */}
          {sections.map((s, i) => {
            const Icon = SECTION_ICONS[i] ?? Brain
            return (
              <div key={i} className="bg-white/[0.03] border border-white/[0.07] rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Icon className="w-4 h-4 text-emerald-400" />
                  <span className="text-sm font-medium text-white">{s.title}</span>
                </div>
                <div className="text-sm text-white/70 leading-relaxed whitespace-pre-wrap">{s.content.trim()}</div>
              </div>
            )
          })}

          {/* Full raw analysis */}
          <details className="bg-white/[0.02] border border-white/[0.06] rounded-xl overflow-hidden">
            <summary className="px-4 py-3 text-xs text-white/40 cursor-pointer hover:text-white/60">
              Volledige analyse tekst (raw)
            </summary>
            <div className="px-4 pb-4 text-xs text-white/50 whitespace-pre-wrap leading-relaxed font-mono">
              {result.analyse}
            </div>
          </details>
        </div>
      )}
    </div>
  )
}
