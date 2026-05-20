import { Landmark } from 'lucide-react'
import { getAcqMunicipalities } from '@/lib/supabase/acquisition'

function ScoreBar({ value, color }: { value: number | null; color: string }) {
  if (value === null) return <div className="h-1.5 bg-white/5 rounded-full w-full" />
  return (
    <div className="h-1.5 bg-white/5 rounded-full w-full overflow-hidden">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${value}%` }} />
    </div>
  )
}

export default async function MunicipalitiesPage() {
  const municipalities = await getAcqMunicipalities()

  const byProvince: Record<string, typeof municipalities> = {}
  for (const m of municipalities) {
    if (!byProvince[m.province]) byProvince[m.province] = []
    byProvince[m.province].push(m)
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center">
          <Landmark size={16} className="text-sky-400" />
        </div>
        <div>
          <h1 className="text-base font-semibold text-white">Gemeente Intelligentie</h1>
          <p className="text-xs text-white/50">Woningtekort, vergunningsbereidheid en groeigebieden per gemeente — {municipalities.length} gemeentes</p>
        </div>
      </div>

      {municipalities.length === 0 ? (
        <div className="bg-white/[0.02] border border-white/5 rounded-xl">
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
              <Landmark size={16} className="text-white/20" />
            </div>
            <p className="text-sm text-white/30">Geen gemeente data</p>
            <p className="text-xs text-white/20 text-center max-w-xs">MunicipalityAI agent analyseert gemeentelijke beleidsdocumenten en woningbouwprogramma's</p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Summary header */}
          <div className="bg-white/[0.02] border border-white/5 rounded-xl overflow-hidden">
            <div className="grid grid-cols-5 px-4 py-2.5 border-b border-white/5 text-[11px] text-white/40 font-medium">
              <span className="col-span-2">Gemeente</span>
              <span>Woningtekort</span>
              <span>Vergunningsbereidheid</span>
              <span>Politiek</span>
            </div>
            <div className="divide-y divide-white/[0.04]">
              {municipalities.map(m => (
                <div key={m.id} className="grid grid-cols-5 items-center px-4 py-3 hover:bg-white/[0.02] transition-colors">
                  <div className="col-span-2">
                    <p className="text-xs font-medium text-white">{m.name}</p>
                    <p className="text-[10px] text-white/30">{m.province}{m.population ? ` · ${m.population.toLocaleString('nl-NL')} inw.` : ''}</p>
                  </div>
                  <div className="pr-4">
                    <div className="flex items-center gap-2">
                      <ScoreBar value={m.housing_shortage_score} color="bg-rose-500/60" />
                      <span className="text-[10px] text-white/40 w-6 text-right">{m.housing_shortage_score ?? '—'}</span>
                    </div>
                  </div>
                  <div className="pr-4">
                    <div className="flex items-center gap-2">
                      <ScoreBar value={m.permit_lenience_score} color="bg-emerald-500/60" />
                      <span className="text-[10px] text-white/40 w-6 text-right">{m.permit_lenience_score ?? '—'}</span>
                    </div>
                  </div>
                  <div>
                    {m.political_stance ? (
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-white/5 text-white/50">{m.political_stance}</span>
                    ) : (
                      <span className="text-[10px] text-white/20">—</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Growth areas by province */}
          {Object.entries(byProvince).map(([province, muns]) => {
            const withGrowth = muns.filter(m => Array.isArray(m.growth_areas) && m.growth_areas.length > 0)
            if (withGrowth.length === 0) return null
            return (
              <div key={province} className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
                <p className="text-xs text-white/50 font-medium uppercase tracking-wide mb-3">{province} — Groeigebieden</p>
                <div className="space-y-2">
                  {withGrowth.map(m => (
                    <div key={m.id} className="flex items-start gap-3">
                      <span className="text-xs text-white/70 min-w-[120px]">{m.name}</span>
                      <div className="flex flex-wrap gap-1">
                        {m.growth_areas.map((area: string) => (
                          <span key={area} className="px-1.5 py-0.5 bg-sky-500/10 text-sky-400 rounded text-[10px]">{area}</span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
