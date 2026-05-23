import clsx from 'clsx'
import { ReactNode } from 'react'

export function SectionCard({
  title, icon, accent, action, glow, children, className,
}: {
  title?: ReactNode
  icon?: ReactNode
  accent?: 'amplify' | 'breakout' | 'warn' | 'decay' | 'neutral'
  action?: ReactNode
  glow?: boolean
  children: ReactNode
  className?: string
}) {
  const glowClass = glow ? `exec-glow-${accent ?? 'amplify'}` : ''
  return (
    <section
      className={clsx(
        'bg-white/[0.04] rounded-xl border border-white/5 p-4',
        glowClass,
        className,
      )}
    >
      {(title || action) && (
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs font-medium text-white/70 flex items-center gap-2">
            {icon ? <span className="text-white/50">{icon}</span> : null}
            {title}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  )
}
