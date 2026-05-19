import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import {
  Scale, Shield, ScrollText, Clock, AlertTriangle,
  ChevronRight, Euro, FileWarning, CalendarClock,
} from 'lucide-react'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const RISK_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  critical: { label: 'KRITIEK', color: 'text-red-400',    bg: 'bg-red-500/10 border-red-500/25' },
  high:     { label: 'HOOG',    color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/20' },
  medium:   { label: 'MEDIUM',  color: 'text-yellow-400', bg: 'bg-yellow-500/8 border-white/[0.06]' },
  low:      { label: 'LAAG',    color: 'text-emerald-400', bg: 'bg-white/[0.03] border-white/[0.06]' },
}

const LEGAL_TYPE_LABEL: Record<string, string> = {
  dagvaarding: 'Dagvaarding', sommatiebrief: 'Sommatiebrief',
  ingebrekestelling: 'Ingebrekestelling', faillissement: 'Faillissement',
  curator: 'Curator', incasso: 'Incasso', bezwaar: 'Bezwaar',
  vonnis: 'Vonnis', hoger_beroep: 'Hoger Beroep',
  overeenkomst: 'Overeenkomst', contract: 'Contract', overig: 'Overig',
}

function daysUntil(date: string) {
  return Math.ceil((new Date(date).getTime() - Date.now()) / 86400000)
}

function fmt(str: string) {
  return new Date(str).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })
}

function fmtEur(amount: number) {
  return amount.toLocaleString('nl-NL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

export default async function AiAdvocaatPage() {
  const supabase = await createClient()

  const [{ data: dossiers }, { data: allDeadlines }] = await Promise.all([
    supabase
      .from('mail_legal_dossiers')
      .select('*, mail_messages(subject, received_at, from_email)')
      .in('status', ['open', 'in_behandeling'])
      .order('risk_level', { ascending: false })
      .order('created_at', { ascending: false }),
    supabase
      .from('mail_legal_deadlines')
      .select('*, mail_legal_dossiers(party_name, company, legal_type)')
      .eq('status', 'open')
      .order('deadline_at', { ascending: true }),
  ])

  const criticalCount = dossiers?.filter(d => d.risk_level === 'critical').length ?? 0
  const highCount = dossiers?.filter(d => d.risk_level === 'high').length ?? 0
  const deadlinesThisWeek = allDeadlines?.filter(d => daysUntil(d.deadline_at) <= 7 && daysUntil(d.deadline_at) >= 0).length ?? 0
  const totalClaim = dossiers?.reduce((sum, d) => sum + (d.claim_amount ?? 0), 0) ?? 0
  const recentDossiers = dossiers?.slice(0, 8) ?? []
  const upcomingDeadlines = allDeadlines?.slice(0, 8) ?? []

  const KPI_CARDS = [
    {
      label: 'Open Dossiers',
      value: String(dossiers?.length ?? 0),
      icon: Scale,
      color: 'text-indigo-400',
      bg: 'bg-indigo-500/10 border-indigo-500/20',
    },
    {
      label: 'Kritiek / Hoog',
      value: `${criticalCount + highCount}`,
      icon: Shield,
      color: criticalCount > 0 ? 'text-red-400' : highCount > 0 ? 'text-orange-400' : 'text-white/40',
      bg: criticalCount > 0 ? 'bg-red-500/10 border-red-500/20' : highCount > 0 ? 'bg-orange-500/10 border-orange-500/20' : 'bg-white/5 border-white/5',
    },
    {
      label: 'Deadlines (7d)',
      value: String(deadlinesThisWeek),
      icon: CalendarClock,
      color: deadlinesThisWeek > 0 ? 'text-orange-400' : 'text-white/40',
      bg: deadlinesThisWeek > 0 ? 'bg-orange-500/10 border-orange-500/20' : 'bg-white/5 border-white/5',
    },
    {
      label: 'Totale Claim',
      value: totalClaim > 0 ? `€ ${fmtEur(totalClaim)}` : '€ 0',
      icon: Euro,
      color: totalClaim > 0 ? 'text-red-400' : 'text-white/40',
      bg: totalClaim > 0 ? 'bg-red-500/10 border-red-500/20' : 'bg-white/5 border-white/5',
    },
  ]

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
          <Scale size={16} className="text-indigo-400" />
        </div>
        <div>
          <h1 className="text-base font-semibold text-white">AI Advocaat OS</h1>
          <p className="text-xs text-white/50">Juridisch risicobeheer — contracten, dossiers, deadlines — AI-powered</p>
        </div>
      </div>

      {/* Alert banner */}
      {(criticalCount > 0 || highCount > 0) && (
        <div className="p-3 bg-red-500/8 border border-red-500/20 rounded-xl flex items-center gap-3">
          <AlertTriangle size={14} className="text-red-400 flex-shrink-0" />
          <div>
            {criticalCount > 0 && (
              <p className="text-[12px] text-red-400 font-semibold">{criticalCount}× KRITIEK — directe actie vereist</p>
            )}
            {highCount > 0 && (
              <p className="text-[11px] text-orange-400">{highCount}× hoog risico dossier</p>
            )}
          </div>
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {KPI_CARDS.map((card) => {
          const Icon = card.icon
          return (
            <div key={card.label} className="bg-white/[0.06] border border-white/5 rounded-xl p-4 flex flex-col gap-3">
              <div className={`w-8 h-8 rounded-lg border flex items-center justify-center ${card.bg}`}>
                <Icon size={15} className={card.color} />
              </div>
              <div>
                <p className={`text-xl font-bold ${card.color} leading-none`}>{card.value}</p>
                <p className="text-[11px] text-white/50 mt-1">{card.label}</p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { href: '/dashboard/ai-advocaat/dossiers', icon: Shield, label: 'Alle Dossiers', color: 'text-indigo-400' },
          { href: '/dashboard/ai-advocaat/contracten', icon: ScrollText, label: 'Contracten', color: 'text-violet-400' },
          { href: '/dashboard/ai-advocaat/deadlines', icon: Clock, label: 'Deadline Monitor', color: 'text-orange-400' },
        ].map((action) => {
          const Icon = action.icon
          return (
            <Link
              key={action.href}
              href={action.href}
              className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-3 flex items-center gap-2.5 hover:bg-white/[0.07] transition-colors"
            >
              <Icon size={14} className={action.color} />
              <span className="text-[12px] text-white/70 font-medium">{action.label}</span>
              <ChevronRight size={12} className="text-white/25 ml-auto" />
            </Link>
          )
        })}
      </div>

      {/* Dossiers + Deadlines grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Recente dossiers */}
        <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[13px] font-semibold text-white">Open Dossiers</h2>
            <Link href="/dashboard/ai-advocaat/dossiers" className="text-[11px] text-indigo-400 hover:text-indigo-300">
              Alle →
            </Link>
          </div>

          {recentDossiers.length === 0 ? (
            <div className="py-10 text-center">
              <Shield size={24} className="text-white/15 mx-auto mb-2" />
              <p className="text-[12px] text-white/25">Geen open dossiers</p>
            </div>
          ) : (
            <div className="space-y-2">
              {recentDossiers.map((d) => {
                const risk = RISK_CONFIG[d.risk_level] ?? RISK_CONFIG.medium
                return (
                  <Link
                    key={d.id}
                    href={`/dashboard/advocaat/dossiers/${d.id}`}
                    className={`flex items-center gap-3 p-3 rounded-xl border transition-colors hover:opacity-80 ${risk.bg}`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className={`text-[9px] font-bold ${risk.color}`}>{risk.label}</span>
                        <span className="text-[9px] text-white/40">{LEGAL_TYPE_LABEL[d.legal_type] ?? d.legal_type}</span>
                        {d.company && <span className="text-[9px] text-white/30">{d.company}</span>}
                      </div>
                      <p className="text-[12px] text-white/80 truncate">{d.party_name}</p>
                      {d.claim_amount != null && (
                        <p className="text-[10px] text-red-400">€ {fmtEur(d.claim_amount)}</p>
                      )}
                      <p className="text-[9px] text-white/25 mt-0.5">{fmt(d.created_at)}</p>
                    </div>
                    <ChevronRight size={14} className="text-white/25 flex-shrink-0" />
                  </Link>
                )
              })}
            </div>
          )}
        </div>

        {/* Naderende deadlines */}
        <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[13px] font-semibold text-white">Naderende Deadlines</h2>
            <Link href="/dashboard/ai-advocaat/deadlines" className="text-[11px] text-indigo-400 hover:text-indigo-300">
              Alle →
            </Link>
          </div>

          {upcomingDeadlines.length === 0 ? (
            <div className="py-10 text-center">
              <CalendarClock size={24} className="text-white/15 mx-auto mb-2" />
              <p className="text-[12px] text-white/25">Geen openstaande termijnen</p>
            </div>
          ) : (
            <div className="space-y-2">
              {upcomingDeadlines.map((dl) => {
                const days = daysUntil(dl.deadline_at)
                const urgentColor = days <= 2 ? 'text-red-400' : days <= 7 ? 'text-orange-400' : 'text-white/50'
                const d = dl.mail_legal_dossiers as { party_name: string; company: string | null; legal_type: string } | null
                return (
                  <div
                    key={dl.id}
                    className="flex items-start gap-3 p-3 bg-white/[0.03] border border-white/[0.05] rounded-xl"
                  >
                    <Clock size={13} className={`${urgentColor} flex-shrink-0 mt-0.5`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] text-white/75">{dl.title}</p>
                      {d && (
                        <p className="text-[10px] text-white/35 truncate">
                          {d.party_name} · {LEGAL_TYPE_LABEL[d.legal_type] ?? d.legal_type}
                        </p>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className={`text-[12px] font-bold ${urgentColor}`}>
                        {days === 0 ? 'VANDAAG' : days < 0 ? `${Math.abs(days)}d verlopen` : `${days}d`}
                      </p>
                      <p className="text-[9px] text-white/25">{fmt(dl.deadline_at)}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
