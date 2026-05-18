import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Scale, Shield, AlertTriangle, ChevronRight, Clock } from 'lucide-react'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const RISK_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  critical: { label: 'KRITIEK',  color: 'text-red-400',     bg: 'bg-red-500/10 border-red-500/25' },
  high:     { label: 'HOOG',     color: 'text-orange-400',  bg: 'bg-orange-500/10 border-orange-500/20' },
  medium:   { label: 'MEDIUM',   color: 'text-yellow-400',  bg: 'bg-yellow-500/8 border-white/[0.06]' },
  low:      { label: 'LAAG',     color: 'text-emerald-400', bg: 'bg-white/[0.03] border-white/[0.06]' },
}

const STATUS_LABEL: Record<string, string> = {
  open: 'Open', in_behandeling: 'In behandeling', gesloten: 'Gesloten',
}

const LEGAL_TYPE_LABEL: Record<string, string> = {
  dagvaarding: 'Dagvaarding', sommatiebrief: 'Sommatiebrief',
  ingebrekestelling: 'Ingebrekestelling', faillissement: 'Faillissement',
  curator: 'Curator', incasso: 'Incasso', bezwaar: 'Bezwaar',
  vonnis: 'Vonnis', hoger_beroep: 'Hoger Beroep',
  overeenkomst: 'Overeenkomst', contract: 'Contract', overig: 'Overig',
}

function fmt(str: string) {
  return new Date(str).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })
}

function fmtEur(amount: number) {
  return amount.toLocaleString('nl-NL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

export default async function DossiersPage() {
  const supabase = await createClient()

  const { data: dossiers } = await supabase
    .from('mail_legal_dossiers')
    .select('*, mail_messages(subject, received_at, from_email)')
    .order('risk_level', { ascending: false })
    .order('created_at', { ascending: false })

  const criticalCount = dossiers?.filter(d => d.risk_level === 'critical').length ?? 0
  const highCount     = dossiers?.filter(d => d.risk_level === 'high').length ?? 0
  const mediumCount   = dossiers?.filter(d => d.risk_level === 'medium').length ?? 0
  const lowCount      = dossiers?.filter(d => d.risk_level === 'low').length ?? 0
  const totalClaim    = dossiers?.reduce((s, d) => s + (d.claim_amount ?? 0), 0) ?? 0

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
          <Shield size={16} className="text-indigo-400" />
        </div>
        <div>
          <h1 className="text-base font-semibold text-white">Alle Dossiers</h1>
          <p className="text-xs text-white/50">Juridische dossiers — alle statussen — AI Legal Agent</p>
        </div>
        <Link href="/dashboard/ai-advocaat" className="ml-auto text-[11px] text-indigo-400 hover:text-indigo-300">
          ← Terug
        </Link>
      </div>

      {/* Alert */}
      {criticalCount > 0 && (
        <div className="p-3 bg-red-500/8 border border-red-500/20 rounded-xl flex items-center gap-3">
          <AlertTriangle size={14} className="text-red-400 flex-shrink-0" />
          <p className="text-[12px] text-red-400 font-semibold">{criticalCount}× KRITIEK — directe actie vereist</p>
        </div>
      )}

      {/* Risk breakdown */}
      <div className="flex flex-wrap gap-2">
        {[
          { label: `${criticalCount} Kritiek`, color: 'text-red-400 bg-red-500/10 border-red-500/20' },
          { label: `${highCount} Hoog`,        color: 'text-orange-400 bg-orange-500/10 border-orange-500/20' },
          { label: `${mediumCount} Medium`,    color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20' },
          { label: `${lowCount} Laag`,         color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
        ].map(b => (
          <span key={b.label} className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border ${b.color}`}>
            {b.label}
          </span>
        ))}
        {totalClaim > 0 && (
          <span className="px-2.5 py-1 rounded-lg text-[11px] font-medium border text-red-400 bg-red-500/8 border-red-500/15 ml-auto">
            Totaal claim: € {fmtEur(totalClaim)}
          </span>
        )}
      </div>

      {/* Dossiers lijst */}
      {(!dossiers || dossiers.length === 0) ? (
        <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl py-16 text-center">
          <Shield size={28} className="text-white/15 mx-auto mb-3" />
          <p className="text-[13px] text-white/25">Geen dossiers gevonden</p>
        </div>
      ) : (
        <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-4 space-y-2">
          {dossiers.map((d) => {
            const risk = RISK_CONFIG[d.risk_level] ?? RISK_CONFIG.medium
            const statusLabel = STATUS_LABEL[d.status] ?? d.status
            return (
              <Link
                key={d.id}
                href={`/mobile/mail/legal/${d.id}`}
                className={`flex items-center gap-3 p-3 rounded-xl border transition-colors hover:opacity-80 ${risk.bg}`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <span className={`text-[9px] font-bold ${risk.color}`}>{risk.label}</span>
                    <span className="text-[9px] text-white/40">{LEGAL_TYPE_LABEL[d.legal_type] ?? d.legal_type}</span>
                    {d.company && <span className="text-[9px] text-white/30">{d.company}</span>}
                    <span className="text-[9px] text-white/25 ml-auto">{statusLabel}</span>
                  </div>
                  <p className="text-[12px] text-white/80 truncate font-medium">{d.party_name}</p>
                  <div className="flex items-center gap-3 mt-0.5">
                    {d.claim_amount != null && (
                      <p className="text-[10px] text-red-400">€ {fmtEur(d.claim_amount)}</p>
                    )}
                    <p className="text-[9px] text-white/25">{fmt(d.created_at)}</p>
                  </div>
                </div>
                <ChevronRight size={14} className="text-white/25 flex-shrink-0" />
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
