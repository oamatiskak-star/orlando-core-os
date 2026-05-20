import clsx from 'clsx'
import { ReactNode } from 'react'

export type Kpi = {
  label: string
  value: string | number
  hint?: string
  icon?: ReactNode
  accent?: 'violet' | 'indigo' | 'emerald' | 'red' | 'amber' | 'white'
}

const ACCENT_BORDER: Record<NonNullable<Kpi['accent']>, string> = {
  violet:   'border-violet-400/20',
  indigo:   'border-indigo-400/20',
  emerald:  'border-emerald-400/20',
  red:      'border-red-400/20',
  amber:    'border-amber-400/20',
  white:    'border-white/10',
}

const ACCENT_TEXT: Record<NonNullable<Kpi['accent']>, string> = {
  violet:   'text-violet-300',
  indigo:   'text-indigo-300',
  emerald:  'text-emerald-300',
  red:      'text-red-300',
  amber:    'text-amber-300',
  white:    'text-white',
}

export function KpiStrip({ items }: { items: Kpi[] }) {
  if (items.length === 0) return null
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {items.map(k => (
        <div
          key={k.label}
          className={clsx(
            'bg-white/[0.04] rounded-xl border p-3',
            ACCENT_BORDER[k.accent ?? 'white']
          )}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="text-[10px] uppercase tracking-wide text-white/40">{k.label}</div>
            {k.icon ? <div className="text-white/30">{k.icon}</div> : null}
          </div>
          <div className={clsx('text-lg font-semibold tabular-nums', ACCENT_TEXT[k.accent ?? 'white'])}>
            {k.value}
          </div>
          {k.hint ? <div className="text-[10px] text-white/40 mt-1">{k.hint}</div> : null}
        </div>
      ))}
    </div>
  )
}
