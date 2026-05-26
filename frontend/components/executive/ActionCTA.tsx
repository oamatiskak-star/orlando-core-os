'use client'

import { useState } from 'react'
import clsx from 'clsx'
import { Loader2 } from 'lucide-react'
import type { ReactNode } from 'react'

export type ActionIntent =
  | 'amplify' | 'swarm' | 'clone' | 'expand' | 'push'
  | 'pause' | 'warn' | 'neutral' | 'breakout'

const STYLES: Record<ActionIntent, string> = {
  amplify:  'bg-violet-500/10  border-violet-400/30  text-violet-200  hover:bg-violet-500/20',
  swarm:    'bg-fuchsia-500/10 border-fuchsia-400/30 text-fuchsia-200 hover:bg-fuchsia-500/20',
  clone:    'bg-indigo-500/10  border-indigo-400/30  text-indigo-200  hover:bg-indigo-500/20',
  expand:   'bg-cyan-500/10    border-cyan-400/30    text-cyan-200    hover:bg-cyan-500/20',
  push:     'bg-emerald-500/10 border-emerald-400/30 text-emerald-200 hover:bg-emerald-500/20',
  breakout: 'bg-emerald-500/15 border-emerald-400/40 text-emerald-200 hover:bg-emerald-500/25',
  pause:    'bg-white/[0.04]   border-white/10       text-white/60    hover:bg-white/[0.08]',
  warn:     'bg-amber-500/10   border-amber-400/30   text-amber-200   hover:bg-amber-500/20',
  neutral:  'bg-white/[0.04]   border-white/10       text-white/70    hover:bg-white/[0.08]',
}

export function ActionCTA({
  label, intent = 'amplify', icon, onClick, disabled, size = 'sm', confirm,
}: {
  label: string
  intent?: ActionIntent
  icon?: ReactNode
  onClick?: () => Promise<unknown> | unknown
  disabled?: boolean
  size?: 'xs' | 'sm' | 'md'
  confirm?: string // toon native confirm() met deze tekst voor uitvoeren
}) {
  const [busy, setBusy] = useState(false)
  const handle = async () => {
    if (!onClick || busy || disabled) return
    if (confirm && !window.confirm(confirm)) return
    try {
      setBusy(true)
      await onClick()
    } finally {
      setBusy(false)
    }
  }
  return (
    <button
      type="button"
      onClick={handle}
      disabled={disabled || busy}
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-lg border font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed',
        STYLES[intent],
        size === 'xs' && 'px-2 py-1 text-[10px]',
        size === 'sm' && 'px-2.5 py-1.5 text-[11px]',
        size === 'md' && 'px-3 py-2 text-xs',
      )}
    >
      {busy ? <Loader2 size={size === 'md' ? 13 : 11} className="animate-spin" /> : icon}
      {label}
    </button>
  )
}
