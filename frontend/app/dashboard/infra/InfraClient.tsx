'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { InfraWorker } from './page'
import { CheckCircle, AlertTriangle, WifiOff, Clock } from 'lucide-react'
import clsx from 'clsx'

function StatusBadge({ status }: { status: InfraWorker['status'] }) {
  const cfg = {
    online:   { icon: CheckCircle,   color: 'text-green-400 bg-green-500/10',  label: 'Online'   },
    degraded: { icon: AlertTriangle, color: 'text-amber-400 bg-amber-500/10',  label: 'Degraded' },
    offline:  { icon: WifiOff,       color: 'text-red-400 bg-red-500/10',      label: 'Offline'  },
  }[status]
  const Icon = cfg.icon
  return (
    <span className={clsx('flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium w-fit', cfg.color)}>
      <Icon size={9} />
      {cfg.label}
    </span>
  )
}

function Bar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = Math.min(100, max > 0 ? (value / max) * 100 : 0)
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
        <div className={clsx('h-full rounded-full transition-all', color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] text-white/50 w-8 text-right">{Math.round(pct)}%</span>
    </div>
  )
}

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60)  return `${s}s`
  if (s < 3600) return `${Math.floor(s / 60)}m`
  return `${Math.floor(s / 3600)}u`
}

export default function InfraClient({
  initialWorkers,
  workerLabels,
}: {
  initialWorkers: InfraWorker[]
  workerLabels:   Record<string, string>
}) {
  const [workers, setWorkers] = useState<InfraWorker[]>(initialWorkers)

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('infra-workers-live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'infra_workers' },
        payload => {
          const updated = payload.new as InfraWorker
          setWorkers(prev => {
            const idx = prev.findIndex(w => w.worker_id === updated.worker_id)
            if (idx >= 0) {
              const next = [...prev]
              next[idx] = updated
              return next
            }
            return [...prev, updated]
          })
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  if (workers.length === 0) return null

  return (
    <div className="bg-white/[0.06] border border-white/5 rounded-xl overflow-hidden">
      <div className="px-5 py-3 border-b border-white/5 flex items-center gap-2">
        <span className="text-xs font-semibold text-white">Workers</span>
        <span className="text-[10px] text-white/40">{workers.length} services</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-white/5">
              {['Service', 'Node', 'Status', 'CPU', 'RAM', 'Queue', 'Done', 'Failed', 'Bijgewerkt'].map(h => (
                <th key={h} className="px-4 py-2.5 text-left text-[10px] font-medium text-white/50 uppercase tracking-wider whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.03]">
            {workers.map(w => (
              <tr key={w.worker_id} className="hover:bg-white/[0.02] transition-colors">
                <td className="px-4 py-3">
                  <p className="font-medium text-white">{workerLabels[w.worker_id] ?? w.worker_id}</p>
                  {w.last_error && (
                    <p className="text-[10px] text-red-400/70 truncate max-w-[180px] mt-0.5">{w.last_error}</p>
                  )}
                </td>
                <td className="px-4 py-3 text-white/50">{w.node}</td>
                <td className="px-4 py-3"><StatusBadge status={w.status} /></td>
                <td className="px-4 py-3 min-w-[100px]">
                  {w.cpu_pct != null ? (
                    <Bar
                      value={w.cpu_pct}
                      max={100}
                      color={w.cpu_pct > 80 ? 'bg-red-400' : w.cpu_pct > 50 ? 'bg-amber-400' : 'bg-indigo-400'}
                    />
                  ) : <span className="text-white/30">—</span>}
                </td>
                <td className="px-4 py-3 min-w-[100px]">
                  {w.ram_mb != null && w.ram_total_mb ? (
                    <>
                      <Bar
                        value={w.ram_mb}
                        max={w.ram_total_mb}
                        color={w.ram_mb / w.ram_total_mb > 0.85 ? 'bg-red-400' : 'bg-violet-400'}
                      />
                      <p className="text-[9px] text-white/35 mt-0.5">{w.ram_mb}MB / {w.ram_total_mb}MB</p>
                    </>
                  ) : <span className="text-white/30">—</span>}
                </td>
                <td className="px-4 py-3">
                  <span className={clsx('font-medium', w.queue_depth > 10 ? 'text-amber-400' : 'text-white/60')}>
                    {w.queue_depth}
                  </span>
                </td>
                <td className="px-4 py-3 text-green-400/70">{w.jobs_done}</td>
                <td className="px-4 py-3">
                  <span className={clsx(w.jobs_failed > 0 ? 'text-red-400' : 'text-white/30')}>
                    {w.jobs_failed}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1 text-white/40">
                    <Clock size={9} />
                    <span className="text-[10px]">{timeAgo(w.updated_at)}</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
