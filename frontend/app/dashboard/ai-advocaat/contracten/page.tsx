import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { ScrollText, ChevronRight, FileText, ExternalLink } from 'lucide-react'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const RISK_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  critical: { label: 'KRITIEK',  color: 'text-red-400',     bg: 'bg-red-500/10 border-red-500/25' },
  high:     { label: 'HOOG',     color: 'text-orange-400',  bg: 'bg-orange-500/10 border-orange-500/20' },
  medium:   { label: 'MEDIUM',   color: 'text-yellow-400',  bg: 'bg-yellow-500/8 border-white/[0.06]' },
  low:      { label: 'LAAG',     color: 'text-emerald-400', bg: 'bg-white/[0.03] border-white/[0.06]' },
}

function fmt(str: string) {
  return new Date(str).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })
}

function fmtEur(amount: number) {
  return amount.toLocaleString('nl-NL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

export default async function ContractenPage() {
  const supabase = await createClient()

  // Haal contracten op uit mail_legal_dossiers (type = overeenkomst of contract)
  const { data: contracten } = await supabase
    .from('mail_legal_dossiers')
    .select('*')
    .in('legal_type', ['overeenkomst', 'contract'])
    .order('created_at', { ascending: false })

  // Ook documenten uit documenten tabel als die bestaat
  const { data: docs } = await supabase
    .from('documenten')
    .select('*')
    .eq('type', 'contract')
    .order('created_at', { ascending: false })
    .limit(20)

  const hasData = (contracten && contracten.length > 0) || (docs && docs.length > 0)

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
          <ScrollText size={16} className="text-violet-400" />
        </div>
        <div>
          <h1 className="text-base font-semibold text-white">Contracten</h1>
          <p className="text-xs text-white/50">Contractbeheer — overeenkomsten, huurcontracten, aannemingscontracten</p>
        </div>
        <Link href="/dashboard/ai-advocaat" className="ml-auto text-[11px] text-indigo-400 hover:text-indigo-300">
          ← Terug
        </Link>
      </div>

      {/* Actie balk */}
      <div className="flex items-center gap-3 p-3 bg-white/[0.04] border border-white/[0.06] rounded-xl">
        <FileText size={13} className="text-violet-400" />
        <p className="text-[12px] text-white/60">Upload contracten via de <strong className="text-white/80">Documenten</strong> module of voeg ze toe via de Mail Engine.</p>
        <Link
          href="/dashboard/documenten"
          className="ml-auto text-[11px] text-violet-400 hover:text-violet-300 flex items-center gap-1"
        >
          Documenten <ExternalLink size={11} />
        </Link>
      </div>

      {/* Contracten uit dossiers */}
      {contracten && contracten.length > 0 && (
        <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-4">
          <h2 className="text-[13px] font-semibold text-white mb-3">Contracten in Dossiers ({contracten.length})</h2>
          <div className="space-y-2">
            {contracten.map((c) => {
              const risk = RISK_CONFIG[c.risk_level] ?? RISK_CONFIG.low
              return (
                <Link
                  key={c.id}
                  href={`/mobile/mail/legal/${c.id}`}
                  className={`flex items-center gap-3 p-3 rounded-xl border transition-colors hover:opacity-80 ${risk.bg}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={`text-[9px] font-bold ${risk.color}`}>{risk.label}</span>
                      {c.company && <span className="text-[9px] text-white/35">{c.company}</span>}
                      <span className="text-[9px] text-white/25 ml-auto">{c.status}</span>
                    </div>
                    <p className="text-[12px] text-white/80 truncate font-medium">{c.party_name}</p>
                    <div className="flex items-center gap-3 mt-0.5">
                      {c.claim_amount != null && (
                        <p className="text-[10px] text-white/50">€ {fmtEur(c.claim_amount)}</p>
                      )}
                      <p className="text-[9px] text-white/25">{fmt(c.created_at)}</p>
                    </div>
                  </div>
                  <ChevronRight size={14} className="text-white/25 flex-shrink-0" />
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* Documenten uit documenten tabel */}
      {docs && docs.length > 0 && (
        <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-4">
          <h2 className="text-[13px] font-semibold text-white mb-3">Contractdocumenten ({docs.length})</h2>
          <div className="space-y-2">
            {docs.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center gap-3 p-3 bg-white/[0.03] border border-white/[0.05] rounded-xl"
              >
                <ScrollText size={13} className="text-violet-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] text-white/80 truncate">{doc.naam ?? doc.name ?? doc.bestandsnaam ?? 'Contract'}</p>
                  {doc.created_at && (
                    <p className="text-[9px] text-white/30 mt-0.5">{fmt(doc.created_at)}</p>
                  )}
                </div>
                {doc.url && (
                  <a
                    href={doc.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-violet-400 hover:text-violet-300"
                  >
                    <ExternalLink size={13} />
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Lege state */}
      {!hasData && (
        <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl py-16 text-center">
          <ScrollText size={28} className="text-white/15 mx-auto mb-3" />
          <p className="text-[13px] text-white/25 mb-1">Geen contracten gevonden</p>
          <p className="text-[11px] text-white/18">
            Upload contracten via de Documenten module of verwerk ze via de Mail Engine.
          </p>
        </div>
      )}
    </div>
  )
}
