import { UserPlus, Mail, Phone } from 'lucide-react'
import { getAcqInvestors } from '@/lib/supabase/acquisition'

const RISK_COLORS: Record<string, string> = {
  laag: 'text-emerald-400 bg-emerald-500/10',
  midden: 'text-amber-400 bg-amber-500/10',
  hoog: 'text-red-400 bg-red-500/10',
}

function fmt(n: number | null) {
  if (!n) return '—'
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)
}

export default async function InvestorsPage() {
  const investors = await getAcqInvestors()

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
            <UserPlus size={16} className="text-emerald-400" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-white">Investor Match Engine</h1>
            <p className="text-xs text-white/50">Investeerder profielen en deal koppeling — {investors.length} actief</p>
          </div>
        </div>
      </div>

      {investors.length === 0 ? (
        <div className="bg-white/[0.02] border border-white/5 rounded-xl">
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
              <UserPlus size={16} className="text-white/20" />
            </div>
            <p className="text-sm text-white/30">Geen investeerders geregistreerd</p>
            <p className="text-xs text-white/20 text-center max-w-xs">Voeg investeerder profielen toe om automatische deal matching te activeren</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {investors.map(inv => (
            <a key={inv.id} href={`/dashboard/acquisition/investors/${inv.id}`}
              className="bg-white/[0.02] border border-white/5 rounded-xl p-4 hover:border-emerald-500/20 transition-all group block">
              <div className="flex items-start justify-between gap-2 mb-3">
                <div>
                  <p className="text-sm font-medium text-white group-hover:text-emerald-300 transition-colors">{inv.name}</p>
                  {inv.company && <p className="text-[11px] text-white/40">{inv.company}</p>}
                </div>
                <span className={`px-2 py-0.5 rounded text-[10px] font-medium shrink-0 ${RISK_COLORS[inv.risk_profile] ?? 'text-white/40 bg-white/5'}`}>
                  {inv.risk_profile}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div>
                  <p className="text-[10px] text-white/30">Min investering</p>
                  <p className="text-xs font-medium text-white/70">{fmt(inv.investment_min)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-white/30">Max investering</p>
                  <p className="text-xs font-medium text-white/70">{fmt(inv.investment_max)}</p>
                </div>
              </div>
              {inv.return_target_pct && (
                <p className="text-[11px] text-emerald-400/70 mb-2">Target rendement: {inv.return_target_pct.toFixed(1)}%</p>
              )}
              {Array.isArray(inv.regions) && inv.regions.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {inv.regions.slice(0, 3).map((r: string) => (
                    <span key={r} className="px-1.5 py-0.5 bg-white/5 text-white/40 rounded text-[10px]">{r}</span>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-3 mt-3 pt-3 border-t border-white/[0.04]">
                {inv.email && <a href={`mailto:${inv.email}`} onClick={e => e.stopPropagation()} className="text-white/30 hover:text-white/60 transition-colors"><Mail size={12} /></a>}
                {inv.phone && <a href={`tel:${inv.phone}`} onClick={e => e.stopPropagation()} className="text-white/30 hover:text-white/60 transition-colors"><Phone size={12} /></a>}
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
