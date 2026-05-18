import type { OrchestratorEvent } from '@/lib/orchestrator/types'
import { Bell } from 'lucide-react'

interface Props {
  events: OrchestratorEvent[]
}

const SEVERITY_TONE: Record<string, string> = {
  info:     'text-sky-400',
  warn:     'text-amber-400',
  error:    'text-rose-400',
  critical: 'text-rose-300',
}

export default function SystemEvents({ events }: Props) {
  return (
    <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] overflow-hidden">
      <div className="px-3 py-2 border-b border-white/[0.06] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell size={13} className="text-amber-400" />
          <span className="text-[11px] uppercase tracking-wider text-white/60">
            Systeem events
          </span>
        </div>
        <span className="text-[11px] text-white/40">{events.length}</span>
      </div>
      {events.length === 0 ? (
        <div className="px-3 py-8 text-center text-[11px] text-white/30">
          geen onresolved events (watchdog activeert in F3)
        </div>
      ) : (
        <ul className="divide-y divide-white/[0.04]">
          {events.map((e) => (
            <li key={e.id} className="px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm text-white/85 truncate">{e.type}</p>
                <span className={`text-[10px] uppercase ${SEVERITY_TONE[e.severity]}`}>
                  {e.severity}
                </span>
              </div>
              <p className="text-[11px] text-white/35 mt-0.5">
                {new Date(e.created_at).toLocaleString('nl-NL')}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
