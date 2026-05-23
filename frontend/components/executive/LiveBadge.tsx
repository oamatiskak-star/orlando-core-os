import clsx from 'clsx'

export function LiveBadge({ label = 'LIVE', tone = 'breakout' }: {
  label?: string
  tone?: 'breakout' | 'amplify' | 'warn'
}) {
  const text = tone === 'warn'
    ? 'text-amber-300'
    : tone === 'amplify'
      ? 'text-violet-300'
      : 'text-emerald-300'
  return (
    <span className={clsx('inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider', text)}>
      <span className="exec-live-dot" />
      {label}
    </span>
  )
}
