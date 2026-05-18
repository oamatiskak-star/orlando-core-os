import type { SystemStateRow } from '@/lib/orchestrator/types'

interface Props {
  totals: {
    hoog: number; normaal: number; laag: number
    running: number; waiting: number
    completed_24h: number; failed_24h: number
  }
  counters: SystemStateRow[]
}

export default function StatusStrip({ totals, counters }: Props) {
  const get = (status: string) =>
    counters.filter((c) => c.status === status).reduce((s, c) => s + c.count, 0)

  const items = [
    { label: 'Actief',    value: get('running'),   tone: 'indigo'  },
    { label: 'Wachtend',  value: get('waiting'),   tone: 'amber'   },
    { label: 'Open',      value: get('open'),      tone: 'sky'     },
    { label: 'Retry',     value: get('retry'),     tone: 'amber'   },
    { label: 'Paused',    value: get('paused'),    tone: 'violet'  },
    { label: 'Gereed',    value: get('completed'), tone: 'emerald' },
    { label: 'Fout',      value: get('failed'),    tone: 'rose'    },
  ]

  const toneClass: Record<string, string> = {
    indigo:  'text-indigo-400',
    amber:   'text-amber-400',
    sky:     'text-sky-400',
    violet:  'text-violet-400',
    emerald: 'text-emerald-400',
    rose:    'text-rose-400',
  }

  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-7 gap-2">
      {items.map((it) => (
        <div
          key={it.label}
          className="rounded-lg bg-white/[0.03] border border-white/[0.06] px-3 py-2.5"
        >
          <p className="text-[10px] uppercase tracking-wider text-white/40">{it.label}</p>
          <p className={`text-lg font-semibold ${toneClass[it.tone]}`}>
            {it.value}
          </p>
        </div>
      ))}
    </div>
  )
}
