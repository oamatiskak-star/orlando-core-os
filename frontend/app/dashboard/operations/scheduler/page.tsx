import { createClient } from '@/lib/supabase/server'
import { Clock, Activity, CheckCircle2, AlertCircle } from 'lucide-react'
import SchedulerList from './SchedulerList'

export default async function SchedulerPage() {
  const supabase = await createClient()

  const { data: tasks } = await supabase
    .from('oc_scheduler_tasks')
    .select('*')
    .order('naam', { ascending: true })

  const actief = tasks?.filter(t => t.status === 'actief').length ?? 0
  const gepauzeerd = tasks?.filter(t => t.status === 'gepauzeerd').length ?? 0
  const totalRuns = tasks?.reduce((s, t) => s + (t.run_count ?? 0), 0) ?? 0

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center">
          <Clock size={16} className="text-sky-400" />
        </div>
        <div>
          <h1 className="text-base font-semibold text-white">Scheduler</h1>
          <p className="text-xs text-white/50">Tijdgestuurde taken — cron-schema's per bedrijf en timezone</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Totaal', value: tasks?.length ?? 0, icon: Clock, color: 'text-sky-400', border: 'border-sky-500/20' },
          { label: 'Actief', value: actief, icon: Activity, color: 'text-green-400', border: 'border-green-500/20' },
          { label: 'Gepauzeerd', value: gepauzeerd, icon: AlertCircle, color: 'text-amber-400', border: 'border-amber-500/20' },
          { label: 'Totale Runs', value: totalRuns, icon: CheckCircle2, color: 'text-indigo-400', border: 'border-indigo-500/20' },
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

      <SchedulerList tasks={tasks ?? []} />
    </div>
  )
}
