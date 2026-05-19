import { createClient } from '@/lib/supabase/server'
import { Server, Cpu, MemoryStick, Activity, AlertTriangle, CheckCircle, WifiOff } from 'lucide-react'
import InfraClient from './InfraClient'

export const dynamic  = 'force-dynamic'
export const revalidate = 0

export type InfraWorker = {
  id:           string
  worker_id:    string
  node:         string
  status:       'online' | 'offline' | 'degraded'
  cpu_pct:      number | null
  ram_mb:       number | null
  ram_total_mb: number | null
  queue_depth:  number
  jobs_done:    number
  jobs_failed:  number
  last_error:   string | null
  version:      string | null
  updated_at:   string
}

const WORKER_LABELS: Record<string, string> = {
  'redis':           'Redis',
  'youtube-engine':  'YouTube Engine',
  'mail-engine':     'Mail Engine',
  'planning-engine': 'Planning Engine',
  'local-agent':     'Local Agent',
  'ai-router':       'AI Router',
  'ai-worker-node':  'AI Worker Node',
  'ollama':          'Ollama',
  'monitoring-agent':'Monitoring Agent',
}

export default async function InfraPage() {
  const supabase = await createClient()

  const { data: workers } = await supabase
    .from('infra_workers')
    .select('*')
    .order('worker_id')

  const rows = (workers ?? []) as InfraWorker[]

  const online   = rows.filter(w => w.status === 'online').length
  const degraded = rows.filter(w => w.status === 'degraded').length
  const offline  = rows.filter(w => w.status === 'offline').length
  const totalQ   = rows.reduce((s, w) => s + w.queue_depth, 0)
  const totalFail= rows.reduce((s, w) => s + w.jobs_failed, 0)

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
          <Server size={16} className="text-indigo-400" />
        </div>
        <div>
          <h1 className="text-base font-semibold text-white">Infrastructuur · CLI-R</h1>
          <p className="text-xs text-white/50">Live worker status — Docker containers + queue depths</p>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
          <span className="text-[11px] text-white/45">Realtime · 30s</span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Online',      value: online,   color: 'text-green-400',  icon: CheckCircle },
          { label: 'Degraded',    value: degraded, color: 'text-amber-400',  icon: AlertTriangle },
          { label: 'Offline',     value: offline,  color: 'text-red-400',    icon: WifiOff },
          { label: 'Queue totaal',value: totalQ,   color: 'text-indigo-400', icon: Activity },
          { label: 'Jobs failed', value: totalFail,color: totalFail > 0 ? 'text-red-400' : 'text-white/40', icon: AlertTriangle },
        ].map(s => {
          const Icon = s.icon
          return (
            <div key={s.label} className="bg-white/[0.06] border border-white/5 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <Icon size={12} className={s.color} />
                <p className="text-[10px] text-white/50">{s.label}</p>
              </div>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            </div>
          )
        })}
      </div>

      {/* Coolify setup instructie als geen workers */}
      {rows.length === 0 && (
        <div className="bg-amber-500/8 border border-amber-500/20 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle size={14} className="text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-xs font-medium text-amber-400">Geen workers gevonden</p>
            <p className="text-[11px] text-white/50">
              Start de CLI-R stack via Coolify of direct:
            </p>
            <code className="text-[10px] text-white/60 bg-white/5 px-2 py-1 rounded block mt-1">
              docker compose -f docker-compose.cli-r.yml up -d
            </code>
          </div>
        </div>
      )}

      {/* Worker tabel — realtime via InfraClient */}
      <InfraClient initialWorkers={rows} workerLabels={WORKER_LABELS} />
    </div>
  )
}
