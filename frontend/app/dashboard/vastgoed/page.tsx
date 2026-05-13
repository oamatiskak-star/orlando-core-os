import { Home, Building2 } from 'lucide-react'
import { getVastgoedDeals } from '@/lib/supabase/queries'
import { createClient } from '@/lib/supabase/server'
import NieuweDealForm from './NieuweDealForm'
import DealCard from './DealCard'
import VastgoedSearchSection from './VastgoedSearchSection'

const PIPELINE_FASES = [
  { key: 'analyse',       label: 'Analyse',         color: 'border-sky-500/40 text-sky-400' },
  { key: 'due_diligence', label: 'Due Diligence',   color: 'border-amber-500/40 text-amber-400' },
  { key: 'bod',           label: 'Bod uitgebracht', color: 'border-violet-500/40 text-violet-400' },
  { key: 'gewonnen',      label: 'Gewonnen',         color: 'border-emerald-500/40 text-emerald-400' },
]

async function getScalperCounts() {
  const supabase = await createClient()
  const [a, b, c, total] = await Promise.all([
    supabase.from('deals').select('id', { count: 'exact', head: true }).is('pipeline_fase', null).eq('class', 'A'),
    supabase.from('deals').select('id', { count: 'exact', head: true }).is('pipeline_fase', null).eq('class', 'B'),
    supabase.from('deals').select('id', { count: 'exact', head: true }).is('pipeline_fase', null).eq('class', 'C'),
    supabase.from('deals').select('id', { count: 'exact', head: true }).is('pipeline_fase', null),
  ])
  return { A: a.count ?? 0, B: b.count ?? 0, C: c.count ?? 0, total: total.count ?? 0 }
}

export default async function VastgoedPage() {
  const [deals, scalperCounts] = await Promise.all([
    getVastgoedDeals(),
    getScalperCounts(),
  ])
  const activeDeals = deals.filter(d => d.pipeline_fase !== 'verloren')

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
            <Home size={16} className="text-amber-400" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-white">Vastgoed Deals</h1>
            <p className="text-xs text-white/50">AI-gedreven dealflow — zoek en filter op provincie, ROI & score</p>
          </div>
        </div>
        <NieuweDealForm />
      </div>

      {/* Search + filter + scalper inbox */}
      <VastgoedSearchSection initialCounts={scalperCounts} />

      {/* Pipeline kanban */}
      <div>
        <p className="text-xs text-white/50 font-medium uppercase tracking-wide mb-3">Pipeline</p>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {PIPELINE_FASES.map((fase) => {
            const faseDeals = activeDeals.filter(d => d.pipeline_fase === fase.key)
            const [borderClass, textClass] = fase.color.split(' ')
            return (
              <div key={fase.key} className={`bg-white/[0.02] border-t-2 border-x border-b border-white/5 rounded-xl ${borderClass}`}>
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
                  <div className="flex items-center gap-2">
                    <h2 className={`text-xs font-semibold ${textClass}`}>{fase.label}</h2>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-white/5 text-white/50">
                      {faseDeals.length}
                    </span>
                  </div>
                </div>
                <div className="p-3 space-y-3 min-h-[200px]">
                  {faseDeals.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 gap-2">
                      <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center">
                        <Building2 size={13} className="text-white/38" />
                      </div>
                      <p className="text-[11px] text-white/38">Geen deals</p>
                    </div>
                  ) : (
                    faseDeals.map(deal => <DealCard key={deal.id} deal={deal} />)
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Verloren deals */}
      {deals.filter(d => d.pipeline_fase === 'verloren').length > 0 && (
        <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
          <h2 className="text-xs font-semibold text-white/50 mb-3">
            Archief — Verloren deals ({deals.filter(d => d.pipeline_fase === 'verloren').length})
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            {deals.filter(d => d.pipeline_fase === 'verloren').map(deal => (
              <DealCard key={deal.id} deal={deal} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
