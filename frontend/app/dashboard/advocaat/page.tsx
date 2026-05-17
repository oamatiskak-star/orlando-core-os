'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Scale, Shield, AlertTriangle, FileText, Clock, TrendingUp,
  Upload, Brain, Gavel, Eye, ChevronRight, RefreshCw,
  CheckCircle, XCircle, Zap, Lock, Search,
} from 'lucide-react'
import type { Dossier, LegalRisk, MailDefenseItem } from '@/lib/advocaat/types'

const PRIORITY_COLOR: Record<string, string> = {
  kritiek: 'text-red-400 bg-red-500/10 border-red-500/30',
  hoog:    'text-orange-400 bg-orange-500/10 border-orange-500/25',
  medium:  'text-yellow-400 bg-yellow-500/8 border-white/[0.06]',
  laag:    'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
}

const RISK_BAR_COLOR = (score: number) =>
  score >= 75 ? 'bg-red-500'
  : score >= 50 ? 'bg-orange-500'
  : score >= 25 ? 'bg-yellow-500'
  : 'bg-emerald-500'

function RiskBar({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${RISK_BAR_COLOR(score)}`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-xs font-mono text-white/60 w-7 text-right">{score}</span>
    </div>
  )
}

function daysUntil(d: string) {
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000)
}

function fmt(d: string) {
  return new Date(d).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function AdvocaatDashboard() {
  const [dossiers,    setDossiers]    = useState<Dossier[]>([])
  const [risicos,     setRisicos]     = useState<LegalRisk[]>([])
  const [mailAlerts,  setMailAlerts]  = useState<MailDefenseItem[]>([])
  const [loading,     setLoading]     = useState(true)
  const [refreshing,  setRefreshing]  = useState(false)

  async function load() {
    setRefreshing(true)
    const [dRes, rRes] = await Promise.all([
      fetch('/api/advocaat/dossiers?limit=20').then(r => r.json()).catch(() => ({})),
      fetch('/api/advocaat/risicos?open=true').then(r => r.json()).catch(() => ({})),
    ])
    setDossiers(dRes.dossiers ?? [])
    setRisicos(rRes.risicos ?? [])
    setLoading(false)
    setRefreshing(false)
  }

  useEffect(() => { load() }, [])

  const stats = {
    totaal:   dossiers.length,
    actief:   dossiers.filter(d => d.status === 'actief').length,
    kritiek:  dossiers.filter(d => d.priority === 'kritiek').length,
    avgRisk:  dossiers.length ? Math.round(dossiers.reduce((a, d) => a + d.risk_score, 0) / dossiers.length) : 0,
    openRisicos: risicos.length,
    critRisicos: risicos.filter(r => r.severity === 'kritiek').length,
    deadlines: dossiers.filter(d => d.next_deadline && daysUntil(d.next_deadline) <= 30 && daysUntil(d.next_deadline) > 0).length,
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white p-6 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-violet-500/15 border border-violet-500/25">
            <Scale className="w-6 h-6 text-violet-400" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-white">AI Advocaat OS</h1>
            <p className="text-xs text-white/40 mt-0.5">Juridisch Intelligence Systeem · Orlando</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/dashboard/advocaat/imports" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs text-white/70 hover:text-white hover:bg-white/[0.08] transition-all">
            <Upload className="w-3.5 h-3.5" /> Importeren
          </Link>
          <Link href="/dashboard/advocaat/dossiers" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600 text-white text-xs font-medium hover:bg-violet-500 transition-all">
            <Gavel className="w-3.5 h-3.5" /> Nieuw dossier
          </Link>
          <button onClick={load} disabled={refreshing} className="p-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] transition-all">
            <RefreshCw className={`w-4 h-4 text-white/40 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {[
          { label: 'Dossiers',        value: stats.totaal,       icon: FileText,       color: 'violet' },
          { label: 'Actief',          value: stats.actief,       icon: Scale,          color: 'blue' },
          { label: 'Kritiek',         value: stats.kritiek,      icon: AlertTriangle,  color: 'red' },
          { label: 'Gemiddeld risico', value: `${stats.avgRisk}`, icon: TrendingUp,    color: stats.avgRisk >= 60 ? 'red' : stats.avgRisk >= 40 ? 'orange' : 'emerald' },
          { label: 'Open risico\'s',  value: stats.openRisicos,  icon: Shield,         color: 'orange' },
          { label: 'Crit. risico\'s', value: stats.critRisicos,  icon: XCircle,        color: 'red' },
          { label: 'Deadlines <30d',  value: stats.deadlines,    icon: Clock,          color: stats.deadlines > 0 ? 'orange' : 'emerald' },
        ].map(s => (
          <div key={s.label} className="bg-white/[0.03] border border-white/[0.07] rounded-xl p-3 flex flex-col gap-1.5">
            <s.icon className={`w-4 h-4 text-${s.color}-400`} />
            <div className="text-xl font-bold text-white">{s.value}</div>
            <div className="text-[10px] text-white/40 leading-tight">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Kritieke risico's */}
      {risicos.filter(r => r.severity === 'kritiek' || r.severity === 'hoog').length > 0 && (
        <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            <span className="text-sm font-medium text-red-300">Kritieke & Hoge Risico&apos;s — Directe actie vereist</span>
          </div>
          <div className="space-y-2">
            {risicos.filter(r => r.severity === 'kritiek' || r.severity === 'hoog').slice(0, 5).map(r => (
              <div key={r.id} className="flex items-start gap-3 p-3 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${r.severity === 'kritiek' ? 'text-red-400 bg-red-500/10 border-red-500/25' : 'text-orange-400 bg-orange-500/10 border-orange-500/25'}`}>
                  {r.severity.toUpperCase()}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-white">{r.title}</div>
                  <div className="text-xs text-white/50 mt-0.5 line-clamp-1">{r.description}</div>
                  {r.recommended_action && (
                    <div className="text-xs text-violet-400 mt-1">→ {r.recommended_action}</div>
                  )}
                </div>
                {r.deadline && (
                  <div className={`text-xs font-mono shrink-0 ${daysUntil(r.deadline) <= 7 ? 'text-red-400' : 'text-white/40'}`}>
                    {daysUntil(r.deadline)}d
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Dossiers */}
        <div className="lg:col-span-2 bg-white/[0.03] border border-white/[0.07] rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
            <span className="text-sm font-medium text-white">Actieve Dossiers</span>
            <Link href="/dashboard/advocaat/dossiers" className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1">
              Alle <ChevronRight className="w-3 h-3" />
            </Link>
          </div>

          {loading ? (
            <div className="p-8 text-center text-white/30 text-sm">Laden...</div>
          ) : dossiers.length === 0 ? (
            <div className="p-8 text-center text-white/30 text-sm">
              <Scale className="w-8 h-8 mx-auto mb-2 opacity-20" />
              Geen dossiers. Start met importeren of maak een nieuw dossier aan.
            </div>
          ) : (
            <div className="divide-y divide-white/[0.04]">
              {dossiers.slice(0, 8).map(d => (
                <Link key={d.id} href={`/dashboard/advocaat/dossiers/${d.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.03] transition-all group">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white group-hover:text-violet-300 transition-colors truncate">{d.title}</span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${PRIORITY_COLOR[d.priority]}`}>
                        {d.priority.toUpperCase()}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-white/40">{d.dossier_type}</span>
                      {d.wederpartij && <span className="text-xs text-white/30">vs. {d.wederpartij}</span>}
                      {d.next_deadline && (
                        <span className={`text-xs ${daysUntil(d.next_deadline) <= 14 ? 'text-orange-400' : 'text-white/30'}`}>
                          <Clock className="w-3 h-3 inline mr-0.5" />
                          {fmt(d.next_deadline)}
                        </span>
                      )}
                    </div>
                    <div className="mt-1.5">
                      <RiskBar score={d.risk_score} />
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-white/40 shrink-0" />
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Quick access + tools */}
        <div className="space-y-3">

          {/* Navigation cards */}
          {[
            { href: '/dashboard/advocaat/curator',      icon: Shield,    label: 'Curator Protectie',   desc: 'Curator risico-analyse',      color: 'red' },
            { href: '/dashboard/advocaat/tijdlijn',     icon: Clock,     label: 'Forensische Tijdlijn', desc: 'Chronologische reconstructie', color: 'blue' },
            { href: '/dashboard/advocaat/bewijs',       icon: Lock,      label: 'Bewijs Engine',        desc: 'Evidence management',          color: 'violet' },
            { href: '/dashboard/advocaat/mail-defense', icon: Eye,       label: 'Mail Defense',         desc: 'Juridische mail-analyse',       color: 'orange' },
            { href: '/dashboard/advocaat/strategie',    icon: Brain,     label: 'Strategie Engine',     desc: 'AI juridische strategie',       color: 'emerald' },
            { href: '/dashboard/advocaat/imports',      icon: Upload,    label: 'Data Imports',         desc: 'Chat, mail, bestanden',         color: 'slate' },
          ].map(m => (
            <Link key={m.href} href={m.href} className={`flex items-center gap-3 p-3 rounded-xl bg-${m.color}-500/5 border border-${m.color}-500/15 hover:bg-${m.color}-500/10 hover:border-${m.color}-500/25 transition-all group`}>
              <m.icon className={`w-4 h-4 text-${m.color}-400 shrink-0`} />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-white">{m.label}</div>
                <div className="text-[10px] text-white/40 mt-0.5">{m.desc}</div>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-white/20 group-hover:text-white/50 shrink-0" />
            </Link>
          ))}

          {/* System status */}
          <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06]">
            <div className="text-[10px] text-white/30 font-medium uppercase tracking-wider mb-2">Systeem Status</div>
            {[
              { label: 'Supabase DB',      ok: true },
              { label: 'Vector Search',    ok: true },
              { label: 'OCR Engine',       ok: false },
              { label: 'AI Analyze',       ok: !!process.env.NEXT_PUBLIC_AI_ENABLED },
              { label: 'Mail IMAP Sync',   ok: false },
              { label: 'OneDrive Sync',    ok: false },
            ].map(s => (
              <div key={s.label} className="flex items-center justify-between py-0.5">
                <span className="text-[10px] text-white/40">{s.label}</span>
                {s.ok ? <CheckCircle className="w-3 h-3 text-emerald-400" /> : <XCircle className="w-3 h-3 text-white/20" />}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Disclaimer */}
      <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/5 border border-amber-500/15 text-xs text-amber-400/70">
        <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
        <span>Dit systeem biedt juridische analyse op basis van ingevoerde data. Alle analyses zijn FEIT / INTERPRETATIE / RISICO / VERMOEDEN gelabeld. Raadpleeg altijd een advocaat voor definitieve juridische beslissingen. Het systeem verzendt nooit automatisch mails.</span>
      </div>
    </div>
  )
}
