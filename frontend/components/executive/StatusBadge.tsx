import clsx from 'clsx'

type Status =
  | 'promising' | 'breakout' | 'scale_ready' | 'saturated'
  | 'underperforming' | 'terminated' | null | undefined

const STYLES: Record<Exclude<Status, null | undefined>, { bg: string; text: string; border: string; label: string }> = {
  breakout:         { bg: 'bg-emerald-500/10',  text: 'text-emerald-300', border: 'border-emerald-400/30',  label: 'BREAKOUT' },
  scale_ready:      { bg: 'bg-violet-500/10',   text: 'text-violet-300',  border: 'border-violet-400/30',   label: 'SCALE READY' },
  promising:        { bg: 'bg-indigo-500/10',   text: 'text-indigo-300',  border: 'border-indigo-400/30',   label: 'PROMISING' },
  saturated:        { bg: 'bg-amber-500/10',    text: 'text-amber-300',   border: 'border-amber-400/30',    label: 'SATURATED' },
  underperforming:  { bg: 'bg-orange-500/10',   text: 'text-orange-300',  border: 'border-orange-400/30',   label: 'UNDERPERFORMING' },
  terminated:       { bg: 'bg-red-500/10',      text: 'text-red-300',     border: 'border-red-400/30',      label: 'TERMINATED' },
}

export function StatusBadge({ status, size = 'sm' }: { status: Status; size?: 'xs' | 'sm' | 'md' }) {
  if (!status) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide rounded border border-white/10 text-white/30">
        N/A
      </span>
    )
  }
  const s = STYLES[status]
  return (
    <span className={clsx(
      'inline-flex items-center font-medium uppercase tracking-wide rounded border',
      s.bg, s.text, s.border,
      size === 'xs' && 'px-1.5 py-0.5 text-[9px]',
      size === 'sm' && 'px-2 py-0.5 text-[10px]',
      size === 'md' && 'px-2.5 py-1 text-xs',
    )}>
      {s.label}
    </span>
  )
}
