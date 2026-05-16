'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Shield, AlertTriangle, Clock, ChevronRight, Scale } from 'lucide-react'

type Dossier = {
  id: string
  party_name: string
  party_domain: string | null
  legal_type: string
  company: string | null
  risk_level: string
  legal_basis: string | null
  claim_amount: number | null
  status: string
  ai_analysis: string | null
  ai_strategy: string | null
  ai_confidence: number
  reference: string | null
  created_at: string
  mail_messages: { subject: string | null; received_at: string | null; from_email: string | null } | null
}

type Deadline = {
  id: string
  title: string
  deadline_at: string
  type: string
  status: string
  mail_legal_dossiers: { party_name: string; company: string | null; legal_type: string } | null
}

const RISK_CONFIG: Record<string, { label: string; color: string; bg: string; icon: typeof AlertTriangle }> = {
  critical: { label: 'KRITIEK',  color: 'text-red-400',    bg: 'bg-red-500/15 border-red-500/30',    icon: AlertTriangle },
  high:     { label: 'HOOG',     color: 'text-orange-400', bg: 'bg-orange-500/15 border-orange-500/20', icon: AlertTriangle },
  medium:   { label: 'MEDIUM',   color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-white/[0.08]', icon: Shield },
  low:      { label: 'LAAG',     color: 'text-emerald-400',bg: 'bg-[#0d0d1a] border-white/[0.08]',   icon: Shield },
}

const LEGAL_TYPE_LABEL: Record<string, string> = {
  dagvaarding: 'Dagvaarding', sommatiebrief: 'Sommatiebrief',
  ingebrekestelling: 'Ingebrekestelling', faillissement: 'Faillissement',
  curator: 'Curator', incasso: 'Incasso', bezwaar: 'Bezwaar',
  vonnis: 'Vonnis', hoger_beroep: 'Hoger Beroep', overig: 'Overig',
}

const COMPANY_COLOR: Record<string, string> = {
  STRKBOUW: 'text-blue-400', STRKBEHEER: 'text-purple-400',
  BOUWPROFFS: 'text-amber-400', MODIWERIJO: 'text-emerald-400',
  INTELLIGENCE: 'text-teal-400', YOUTUBE: 'text-red-400', PRIVÉ: 'text-white/40',
}

function daysUntil(date: string): number {
  return Math.ceil((new Date(date).getTime() - Date.now()) / 86400000)
}

function formatDate(str: string): string {
  return new Date(str).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function LegalDossierListClient({
  initialDossiers,
  upcomingDeadlines,
  criticalCount,
  highCount,
}: {
  initialDossiers: Dossier[]
  upcomingDeadlines: Deadline[]
  criticalCount: number
  highCount: number
}) {
  const router = useRouter()
  const [dossiers] = useState(initialDossiers)
  const [activeTab, setActiveTab] = useState<'dossiers' | 'deadlines'>('dossiers')

  return (
    <div className="max-w-lg mx-auto pb-8" style={{ paddingTop: 'calc(1rem + env(safe-area-inset-top))' }}>
      {/* Header */}
      <div className="px-4 mb-4">
        <div className="flex items-center gap-3 mb-3">
          <button onClick={() => router.back()} className="p-2 -ml-2 text-white/50 hover:text-white/80 transition-colors">
            <ArrowLeft size={20} />
          </button>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Scale size={18} className="text-indigo-400" />
              <h1 className="text-lg font-bold text-white">Juridisch Dossier</h1>
            </div>
            <p className="text-[11px] text-white/30">Juridische bescherming — AI Legal Agent</p>
          </div>
        </div>

        {/* Alert banner */}
        {(criticalCount > 0 || highCount > 0) && (
          <div className="p-3 mb-3 bg-red-500/10 border border-red-500/25 rounded-xl flex items-center gap-3">
            <AlertTriangle size={16} className="text-red-400 flex-shrink-0" />
            <div>
              {criticalCount > 0 && (
                <p className="text-[12px] text-red-400 font-semibold">{criticalCount}× KRITIEK — directe actie vereist</p>
              )}
              {highCount > 0 && (
                <p className="text-[11px] text-orange-400">{highCount}× hoog risico</p>
              )}
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1">
          {(['dossiers', 'deadlines'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`flex-1 py-1.5 text-[12px] font-medium rounded-xl transition-colors ${
                activeTab === tab ? 'bg-indigo-600 text-white' : 'bg-white/[0.06] text-white/50'
              }`}>
              {tab === 'dossiers'
                ? `Dossiers (${dossiers.length})`
                : `Termijnen (${upcomingDeadlines.length})`}
            </button>
          ))}
        </div>
      </div>

      {/* Dossiers */}
      {activeTab === 'dossiers' && (
        <div className="space-y-2 px-4">
          {dossiers.length === 0 ? (
            <div className="py-16 text-center">
              <Shield size={32} className="text-white/20 mx-auto mb-3" />
              <p className="text-white/30 text-sm">Geen open juridische dossiers</p>
              <p className="text-white/20 text-[11px] mt-1">Legal Agent bewaakt actief alle inkomende mail</p>
            </div>
          ) : (
            dossiers.map(d => {
              const risk = RISK_CONFIG[d.risk_level] ?? RISK_CONFIG.medium
              const RiskIcon = risk.icon
              return (
                <button
                  key={d.id}
                  onClick={() => router.push(`/mobile/mail/legal/${d.id}`)}
                  className={`w-full text-left p-4 rounded-2xl border transition-colors hover:opacity-90 ${risk.bg}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className={`text-[9px] font-bold ${risk.color}`}>
                          <RiskIcon size={9} className="inline mr-0.5" />
                          {risk.label}
                        </span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/[0.08] text-white/50">
                          {LEGAL_TYPE_LABEL[d.legal_type] ?? d.legal_type}
                        </span>
                        {d.company && (
                          <span className={`text-[9px] font-semibold ${COMPANY_COLOR[d.company] ?? 'text-white/40'}`}>
                            {d.company}
                          </span>
                        )}
                      </div>

                      <p className="text-[13px] font-semibold text-white truncate">{d.party_name}</p>

                      {d.reference && (
                        <p className="text-[10px] text-white/40 mt-0.5">Ref: {d.reference}</p>
                      )}

                      {d.claim_amount != null && (
                        <p className="text-[11px] text-red-400 font-medium mt-0.5">
                          € {d.claim_amount.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
                        </p>
                      )}

                      {d.legal_basis && (
                        <p className="text-[10px] text-white/35 mt-1 line-clamp-1">{d.legal_basis}</p>
                      )}

                      <p className="text-[10px] text-white/25 mt-1">{formatDate(d.created_at)}</p>
                    </div>
                    <ChevronRight size={16} className="text-white/30 flex-shrink-0 mt-1" />
                  </div>
                </button>
              )
            })
          )}
        </div>
      )}

      {/* Deadlines */}
      {activeTab === 'deadlines' && (
        <div className="space-y-2 px-4">
          {upcomingDeadlines.length === 0 ? (
            <div className="py-16 text-center text-white/30 text-sm">Geen openstaande termijnen</div>
          ) : (
            upcomingDeadlines.map(dl => {
              const days = daysUntil(dl.deadline_at)
              const urgentColor = days <= 2 ? 'text-red-400' : days <= 7 ? 'text-orange-400' : 'text-white/60'
              const d = dl.mail_legal_dossiers

              return (
                <div key={dl.id} className="p-3 bg-[#0d0d1a] border border-white/[0.08] rounded-xl">
                  <div className="flex items-start gap-3">
                    <Clock size={14} className={`${urgentColor} flex-shrink-0 mt-0.5`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] text-white/80 font-medium">{dl.title}</p>
                      {d && (
                        <p className="text-[10px] text-white/40 truncate mt-0.5">
                          {d.party_name} · {LEGAL_TYPE_LABEL[d.legal_type] ?? d.legal_type}
                          {d.company && ` · ${d.company}`}
                        </p>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className={`text-[12px] font-bold ${urgentColor}`}>
                        {days === 0 ? 'VANDAAG' : days < 0 ? `${Math.abs(days)}d verlopen` : `${days}d`}
                      </p>
                      <p className="text-[9px] text-white/30">{formatDate(dl.deadline_at)}</p>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
