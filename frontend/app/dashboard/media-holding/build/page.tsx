import { createClient } from '@/lib/supabase/server'
import { Layers, CheckCircle2, Zap, Circle, AlertTriangle } from 'lucide-react'
import ModuleStatusGrid from './ModuleStatusGrid'

const FASE_STATUS_STYLE: Record<string, string> = {
  active:    'bg-violet-500/15 border-violet-500/25 text-violet-400',
  building:  'bg-amber-500/15 border-amber-500/25 text-amber-400',
  pending:   'bg-white/5 border-white/10 text-white/35',
  completed: 'bg-emerald-500/15 border-emerald-500/25 text-emerald-400',
}

const FASE_STATUS_LABEL: Record<string, string> = {
  active:    'Actief',
  building:  'Bouwen',
  pending:   'Gepland',
  completed: 'Voltooid',
}

export default async function BuildTrackerPage() {
  const supabase = await createClient()

  const [{ data: phases }, { data: modules }] = await Promise.all([
    supabase.from('media_holding_phases').select('*').order('fase_nr'),
    supabase.from('media_holding_modules').select('*').order('fase_nr').order('naam'),
  ])

  const phList  = phases  ?? []
  const modList = modules ?? []

  const totalLive    = modList.filter(m => m.status === 'live').length
  const totalBuilding = modList.filter(m => m.status === 'building').length
  const totalPending = modList.filter(m => m.status === 'pending').length

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
            <Layers size={16} className="text-violet-400" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-white">Build Tracker</h1>
            <p className="text-xs text-white/45">Media Holding OS — module voortgang per fase</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg">
            <CheckCircle2 size={11} /> {totalLive} live
          </span>
          <span className="flex items-center gap-1.5 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-lg">
            <Zap size={11} /> {totalBuilding} bouwen
          </span>
          <span className="flex items-center gap-1.5 text-xs text-white/40 bg-white/5 border border-white/10 px-2.5 py-1 rounded-lg">
            <Circle size={11} /> {totalPending} gepland
          </span>
        </div>
      </div>

      {/* Fase overzicht */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {phList.map(fase => {
          const faseMods = modList.filter(m => m.fase_nr === fase.fase_nr)
          const live = faseMods.filter(m => m.status === 'live').length
          return (
            <div key={fase.id} className="bg-white/[0.04] border border-white/8 rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-white/35 uppercase">Fase {fase.fase_nr}</span>
                <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full border ${FASE_STATUS_STYLE[fase.status]}`}>
                  {FASE_STATUS_LABEL[fase.status]}
                </span>
              </div>
              <p className="text-xs font-semibold text-white/80 leading-tight">{fase.naam}</p>
              <div className="w-full h-1 bg-white/8 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${fase.voortgang}%`,
                    backgroundColor: fase.status === 'active' ? '#a78bfa' : fase.status === 'building' ? '#fbbf24' : fase.status === 'completed' ? '#34d399' : '#ffffff20',
                  }}
                />
              </div>
              <p className="text-[10px] text-white/30">{live}/{faseMods.length} modules</p>
            </div>
          )
        })}
      </div>

      {/* Module grid — client component for status updates */}
      <div className="bg-white/[0.04] border border-white/8 rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-white mb-5 flex items-center gap-2">
          <Layers size={14} className="text-white/50" />
          Alle modules
          <span className="text-[11px] text-white/35 font-normal ml-1">— klik op een module om status te updaten</span>
        </h2>
        <ModuleStatusGrid initialModules={modList} />
      </div>
    </div>
  )
}
