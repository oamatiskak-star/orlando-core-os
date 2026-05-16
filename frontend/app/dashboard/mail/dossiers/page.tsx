import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Scale, AlertTriangle, Clock, ChevronRight, Shield } from 'lucide-react'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const RISK_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  critical: { label: 'KRITIEK',  color: 'text-red-400',     bg: 'bg-red-500/10 border-red-500/25' },
  high:     { label: 'HOOG',     color: 'text-orange-400',  bg: 'bg-orange-500/10 border-orange-500/20' },
  medium:   { label: 'MEDIUM',   color: 'text-yellow-400',  bg: 'bg-yellow-500/8 border-white/[0.06]' },
  low:      { label: 'LAAG',     color: 'text-emerald-400', bg: 'bg-white/[0.03] border-white/[0.06]' },
}

const LEGAL_TYPE_LABEL: Record<string, string> = {
  dagvaarding: 'Dagvaarding', sommatiebrief: 'Sommatiebrief',
  ingebrekestelling: 'Ingebrekestelling', faillissement: 'Faillissement',
  curator: 'Curator', incasso: 'Incasso', bezwaar: 'Bezwaar',
  vonnis: 'Vonnis', hoger_beroep: 'Hoger Beroep', overig: 'Overig',
}

function daysUntil(date: string) {
  return Math.ceil((new Date(date).getTime() - Date.now()) / 86400000)
}

function fmt(str: string) {
  return new Date(str).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default async function MailDossiersPage() {
  const supabase = await createClient()

  const [{ data: dossiers }, { data: deadlines }] = await Promise.all([
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
      .order('deadline_at', { ascending: true })
      .limit(20),
  ])

  const criticalCount = dossiers?.filter(d => d.risk_level === 'critical').length ?? 0
  const highCount = dossiers?.filter(d => d.risk_level === 'high').length ?? 0

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
          <Scale size={16} className="text-amber-400" />
        </div>
        <div>
          <h1 className="text-base font-semibold text-white">Juridische Dossiers</h1>
          <p className="text-xs text-white/50">Alle open juridische zaken — AI Legal Agent — Advocaat niveau</p>
        </div>
        <Link href="/mobile/mail/legal" className="ml-auto text-[11px] text-indigo-400 hover:text-indigo-300">
          Mobile view →
        </Link>
      </div>

      {(criticalCount > 0 || highCount > 0) && (
        <div className="p-3 bg-red-500/8 border border-red-500/20 rounded-xl flex items-center gap-3">
          <AlertTriangle size={14} className="text-red-400 flex-shrink-0" />
          <div>
            {criticalCount > 0 && <p className="text-[12px] text-red-400 font-semibold">{criticalCount}× KRITIEK — directe actie vereist</p>}
            {highCount > 0 && <p className="text-[11px] text-orange-400">{highCount}× hoog risico</p>}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Dossiers */}
        <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-4">
          <h2 className="text-[13px] font-semibold text-white mb-3">Dossiers ({dossiers?.length ?? 0})</h2>
          {(!dossiers || dossiers.length === 0) ? (
            <div className="py-8 text-center">
              <Shield size={24} className="text-white/15 mx-auto mb-2" />
              <p className="text-[12px] text-white/25">Geen open dossiers</p>
            </div>
          ) : (
            <div className="space-y-2">
              {dossiers.map(d => {
                const risk = RISK_CONFIG[d.risk_level] ?? RISK_CONFIG.medium
                return (
                  <Link
                    key={d.id}
                    href={`/mobile/mail/legal/${d.id}`}
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
                        <p className="text-[10px] text-red-400">€ {d.claim_amount.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}</p>
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

        {/* Deadlines */}
        <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-4">
          <h2 className="text-[13px] font-semibold text-white mb-3">Openstaande Termijnen ({deadlines?.length ?? 0})</h2>
          {(!deadlines || deadlines.length === 0) ? (
            <div className="py-8 text-center text-[12px] text-white/25">Geen openstaande termijnen</div>
          ) : (
            <div className="space-y-2">
              {deadlines.map(dl => {
                const days = daysUntil(dl.deadline_at)
                const urgentColor = days <= 2 ? 'text-red-400' : days <= 7 ? 'text-orange-400' : 'text-white/50'
                const d = dl.mail_legal_dossiers as { party_name: string; company: string | null; legal_type: string } | null
                return (
                  <div key={dl.id} className="flex items-start gap-3 p-3 bg-white/[0.03] border border-white/[0.05] rounded-xl">
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
