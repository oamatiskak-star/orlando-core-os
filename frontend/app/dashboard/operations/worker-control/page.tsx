import { Server, Activity, Power, AlertTriangle } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import WorkerControlGrid, { type Worker } from './WorkerControlGrid'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const STALE_MS = 90_000

export default async function WorkerControlPage() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('worker_registry')
    .select('id, worker_type, display_name, host, status, desired_state, controllable, queue_depth, cpu_percent, ram_mb, tasks_today, tasks_total, current_task_description, last_error, last_heartbeat, restart_requested_at, last_command, last_command_at, last_command_result, updated_at')
    .order('controllable', { ascending: false })
    .order('display_name', { ascending: true, nullsFirst: false })

  const workers = (data ?? []) as Worker[]
  const now = Date.now()
  const isStale = (hb: string | null) => !hb || now - new Date(hb).getTime() > STALE_MS

  const total = workers.length
  const online = workers.filter((w) => !isStale(w.last_heartbeat) && w.status !== 'offline' && w.desired_state !== 'stopped').length
  const stopped = workers.filter((w) => w.desired_state === 'stopped').length
  const errored = workers.filter((w) => !!w.last_error).length

  const kpis = [
    { label: 'Workers', value: total, icon: Server, color: 'text-sky-400', border: 'border-sky-500/20' },
    { label: 'Online', value: online, icon: Activity, color: online > 0 ? 'text-emerald-400' : 'text-white/38', border: online > 0 ? 'border-emerald-500/20' : 'border-white/5' },
    { label: 'Gestopt', value: stopped, icon: Power, color: stopped > 0 ? 'text-amber-400' : 'text-white/38', border: stopped > 0 ? 'border-amber-500/20' : 'border-white/5' },
    { label: 'Met fout', value: errored, icon: AlertTriangle, color: errored > 0 ? 'text-red-400' : 'text-white/38', border: errored > 0 ? 'border-red-500/20' : 'border-white/5' },
  ]

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center">
          <Server size={16} className="text-sky-400" />
        </div>
        <div>
          <h1 className="text-base font-semibold text-white">Worker Control Center</h1>
          <p className="text-xs text-white/50">Aan / uit / herstart van de volledige worker-fleet · PM2 via local-watchdog</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {kpis.map((s) => {
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

      <WorkerControlGrid initialWorkers={workers} staleMs={STALE_MS} />
    </div>
  )
}
