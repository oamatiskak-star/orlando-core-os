'use client'

import clsx from 'clsx'
import { Sparkles } from 'lucide-react'
import { useShowcase } from './ShowcaseProvider'

export function ShowcaseToggle() {
  const { on, toggle } = useShowcase()
  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={on}
      title={on ? 'Showcase mode actief — klik om uit te zetten' : 'Activeer showcase mode (demo / investor view)'}
      className={clsx(
        'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-medium transition-colors',
        on
          ? 'bg-violet-500/20 border-violet-400/50 text-violet-100 exec-glow-amplify'
          : 'bg-white/[0.04] border-white/10 text-white/50 hover:bg-white/[0.08] hover:text-white/80',
      )}
    >
      <Sparkles size={11} className={on ? 'animate-pulse' : ''} />
      Showcase {on ? 'ON' : 'OFF'}
    </button>
  )
}
