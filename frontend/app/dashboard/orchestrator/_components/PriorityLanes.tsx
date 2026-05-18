import type { OrchestratorTask, TaskPriorityBand } from '@/lib/orchestrator/types'
import { AlertTriangle, Flag, Layers } from 'lucide-react'

interface Props {
  lanes: Record<TaskPriorityBand, OrchestratorTask[]>
}

const BAND_META: Record<TaskPriorityBand, { label: string; tone: string; icon: typeof Flag }> = {
  hoog:    { label: 'Hoog',    tone: 'rose',   icon: AlertTriangle },
  normaal: { label: 'Normaal', tone: 'sky',    icon: Flag },
  laag:    { label: 'Laag',    tone: 'violet', icon: Layers },
}

const STATUS_TONE: Record<string, string> = {
  running:   'text-indigo-400',
  open:      'text-sky-400',
  retry:     'text-amber-400',
  paused:    'text-violet-400',
  waiting:   'text-amber-400',
  failed:    'text-rose-400',
  completed: 'text-emerald-400',
}

export default function PriorityLanes({ lanes }: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      {(['hoog', 'normaal', 'laag'] as TaskPriorityBand[]).map((band) => {
        const meta = BAND_META[band]
        const Icon = meta.icon
        const items = lanes[band] ?? []
        return (
          <div
            key={band}
            className="rounded-lg bg-white/[0.03] border border-white/[0.06] overflow-hidden"
          >
            <div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.06]">
              <div className="flex items-center gap-2">
                <Icon size={14} className={`text-${meta.tone}-400`} />
                <span className="text-[11px] uppercase tracking-wider text-white/60">
                  {meta.label}
                </span>
              </div>
              <span className="text-[11px] text-white/40">{items.length}</span>
            </div>
            {items.length === 0 ? (
              <div className="px-3 py-6 text-center text-[11px] text-white/30">
                geen taken
              </div>
            ) : (
              <ul className="divide-y divide-white/[0.04]">
                {items.map((t) => (
                  <li key={t.id} className="px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm text-white/85 truncate">{t.title}</p>
                      <span className={`text-[10px] uppercase ${STATUS_TONE[t.status] ?? 'text-white/40'}`}>
                        {t.status}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <p className="text-[11px] text-white/40 truncate">
                        {t.task_type ?? t.executor} · {t.company_id}
                      </p>
                      <p className="text-[10px] text-white/35">
                        p{t.priority} · {t.attempts}/{t.max_attempts}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )
      })}
    </div>
  )
}
