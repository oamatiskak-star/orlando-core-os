import clsx from 'clsx'
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'

export function MetricDelta({
  current, target, invertGood = false, size = 'sm',
}: {
  current: number
  target: number | null | undefined
  invertGood?: boolean // true wanneer "lager is beter" (bv. spend)
  size?: 'xs' | 'sm' | 'md'
}) {
  if (target === null || target === undefined || target === 0) {
    return <span className="text-[10px] text-white/30">no target</span>
  }
  const delta = current - target
  const pct = (delta / target) * 100
  const positive = invertGood ? delta < 0 : delta > 0
  const neutral = Math.abs(pct) < 1
  const color = neutral
    ? 'text-white/40 border-white/10 bg-white/[0.04]'
    : positive
      ? 'text-emerald-300 border-emerald-400/30 bg-emerald-500/[0.07]'
      : 'text-red-300 border-red-400/30 bg-red-500/[0.07]'
  const Icon = neutral ? Minus : positive ? ArrowUpRight : ArrowDownRight
  return (
    <span className={clsx(
      'inline-flex items-center gap-1 rounded border tabular-nums',
      color,
      size === 'xs' && 'px-1 py-[1px] text-[9px]',
      size === 'sm' && 'px-1.5 py-0.5 text-[10px]',
      size === 'md' && 'px-2 py-0.5 text-xs',
    )}>
      <Icon size={size === 'md' ? 11 : 9} />
      {pct >= 0 ? '+' : ''}{pct.toFixed(0)}%
    </span>
  )
}
