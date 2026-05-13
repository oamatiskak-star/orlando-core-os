import { createClient } from '@/lib/supabase/server'
import { ListChecks, Activity, Clock, CheckCircle2 } from 'lucide-react'
import RoutineList from './RoutineList'

export default async function RoutinesPage() {
  const supabase = await createClient()

  const { data: routines } = await supabase
    .from('oc_routines')
    .select('*')
    .neq('status', 'uitgeschakeld')
    .order('naam', { ascending: true })

  const actief = routines?.filter(r => r.status === 'actief').length ?? 0
  const gepauzeerd = routines?.filter(r => r.status === 'gepauzeerd').length ?? 0

  const { data: recentRuns } = await supabase
    .from('oc_routine_runs')
    .select('status')
    .gte('started_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())

  const success24h = recentRuns?.filter(r => r.status === 'success').length ?? 0

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
          <ListChecks size={16} className="text-amber-400" />
        </div>
        <div>
          <h1 className="text-base font-semibold text-white">Routines</h1>
          <p className="text-xs text-white/50">Terugkerende taken op vaste tijden — cron-gebaseerd</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Totaal', value: routines?.length ?? 0, icon: ListChecks, color: 'text-amber-400', border: 'border-amber-500/20' },
          { label: 'Actief', value: actief, icon: Activity, color: 'text-green-400', border: 'border-green-500/20' },
          { label: 'Gepauzeerd', value: gepauzeerd, icon: Clock, color: 'text-white/45', border: 'border-white/5' },
          { label: 'Geslaagd (24u)', value: success24h, icon: CheckCircle2, color: 'text-indigo-400', border: 'border-indigo-500/20' },
        ].map(s => {
          const Icon = s.icon
          return (
            <div key={s.label} className={`bg-white/[0.06] border ${s.border} rounded-xl p-4`}>
              <Icon size={13} className={`${s.color} mb-2`} />
              <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-[11px] text-white/50 mt-0.5">{s.label}</p>
            </div>
          )
        })}
      </div>

      <RoutineList routines={routines ?? []} />
    </div>
  )
}
