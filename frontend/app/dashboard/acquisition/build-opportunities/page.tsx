import { HardHat, Building2 } from 'lucide-react'
import { getAcqBuildOpps } from '@/lib/supabase/acquisition'

const STAGE_COLORS: Record<string, string> = {
  signalering: 'text-sky-400 bg-sky-500/10',
  analyse: 'text-amber-400 bg-amber-500/10',
  inschrijving: 'text-violet-400 bg-violet-500/10',
  gewonnen: 'text-emerald-400 bg-emerald-500/10',
  verloren: 'text-red-400 bg-red-500/10',
}

function fmt(n: number | null) {
  if (!n) return '—'
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)
}

export default async function BouwRadarPage() {
  const opps = await getAcqBuildOpps()

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
          <HardHat size={16} className="text-orange-400" />
        </div>
        <div>
          <h1 className="text-base font-semibold text-white">BouwRadar</h1>
          <p className="text-xs text-white/50">Bouwopdrachten en ontwikkelkansen — {opps.length} gevonden</p>
        </div>
      </div>

      {opps.length === 0 ? (
        <div className="bg-white/[0.02] border border-white/5 rounded-xl">
          <EmptyState icon={HardHat} label="Geen bouwopdrachten gevonden" sub="Voeg bouwopdrachten toe of configureer BouwRadar agents" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {opps.map(opp => (
            <div key={opp.id} className="bg-white/[0.02] border border-white/5 rounded-xl p-4 hover:border-white/10 transition-colors">
              <div className="flex items-start justify-between gap-2 mb-3">
                <div>
                  <p className="text-sm font-medium text-white">{opp.title}</p>
                  <p className="text-[11px] text-white/40 mt-0.5">{opp.municipality ?? '—'}{opp.province ? `, ${opp.province}` : ''}</p>
                </div>
                <span className={`px-2 py-0.5 rounded text-[10px] font-medium shrink-0 ${STAGE_COLORS[opp.pipeline_stage] ?? 'text-white/40 bg-white/5'}`}>
                  {opp.pipeline_stage}
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-white/50">{opp.client ?? 'Onbekend'}</span>
                <span className="text-white/70 font-medium">{fmt(opp.estimated_value)}</span>
              </div>
              {opp.deadline && (
                <p className="text-[10px] text-white/30 mt-2">Deadline: {new Date(opp.deadline).toLocaleDateString('nl-NL')}</p>
              )}
              {opp.opp_type && (
                <span className="inline-block mt-2 px-1.5 py-0.5 bg-orange-500/10 text-orange-400/80 rounded text-[10px]">{opp.opp_type}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function EmptyState({ icon: Icon, label, sub }: { icon: React.ComponentType<{size?:number;className?:string}>, label: string, sub?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-2">
      <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
        <Icon size={16} className="text-white/20" />
      </div>
      <p className="text-sm text-white/30">{label}</p>
      {sub && <p className="text-xs text-white/20 text-center max-w-xs">{sub}</p>}
    </div>
  )
}
