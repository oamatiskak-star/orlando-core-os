import type { Worker } from '@/lib/orchestrator/types'

type EnrichedWorker = Worker & { age_seconds?: number; health?: 'green' | 'amber' | 'red' }

interface Props {
  workers: EnrichedWorker[]
}

const HEALTH_DOT: Record<string, string> = {
  green: 'bg-emerald-400',
  amber: 'bg-amber-400',
  red:   'bg-rose-400',
}

export default function WorkersPanel({ workers }: Props) {
  return (
    <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] overflow-hidden">
      <div className="px-3 py-2 border-b border-white/[0.06] flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-wider text-white/60">Workers</span>
        <span className="text-[11px] text-white/40">{workers.length}</span>
      </div>
      {workers.length === 0 ? (
        <div className="px-3 py-8 text-center text-[11px] text-white/30">
          geen worker heartbeats — start sterkbouw-saas-executor met ORCHESTRATOR_ENABLED=1
        </div>
      ) : (
        <ul className="divide-y divide-white/[0.04]">
          {workers.map((w) => {
            const ageSec = w.age_seconds ?? Math.round((Date.now() - new Date(w.last_seen).getTime()) / 1000)
            const health =
              w.health ??
              (ageSec <= 30 ? 'green' : ageSec <= 90 ? 'amber' : 'red')
            return (
              <li key={w.worker_id} className="px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${HEALTH_DOT[health]}`} />
                    <p className="text-sm text-white/85 truncate">{w.worker_id}</p>
                  </div>
                  <span className="text-[10px] uppercase text-white/40">{w.status}</span>
                </div>
                <div className="flex items-center justify-between mt-0.5">
                  <p className="text-[11px] text-white/40 truncate">
                    {w.hostname ?? '—'} · last seen {ageSec}s
                  </p>
                  <p className="text-[10px] text-white/35">
                    {w.cpu_pct !== null ? `cpu ${w.cpu_pct.toFixed(0)}%` : ''}
                    {w.ram_mb !== null ? ` · ram ${Math.round(w.ram_mb)}mb` : ''}
                  </p>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
