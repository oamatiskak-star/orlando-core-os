import clsx from 'clsx'
import type { RoutineStatus, RunStatus } from './types'

const ROUTINE_STATUS_STYLE: Record<RoutineStatus, { bg: string; text: string; border: string; label: string }> = {
  active:   { bg: 'bg-emerald-500/10', text: 'text-emerald-300', border: 'border-emerald-400/30', label: 'ACTIVE' },
  paused:   { bg: 'bg-amber-500/10',   text: 'text-amber-300',   border: 'border-amber-400/30',   label: 'PAUSED' },
  disabled: { bg: 'bg-white/[0.04]',   text: 'text-white/40',    border: 'border-white/10',       label: 'DISABLED' },
  draft:    { bg: 'bg-indigo-500/10',  text: 'text-indigo-300',  border: 'border-indigo-400/30',  label: 'DRAFT' },
}

const RUN_STATUS_STYLE: Record<RunStatus, { bg: string; text: string; border: string; label: string }> = {
  queued:            { bg: 'bg-white/[0.04]',  text: 'text-white/60',   border: 'border-white/10',       label: 'QUEUED' },
  running:           { bg: 'bg-blue-500/10',   text: 'text-blue-300',   border: 'border-blue-400/30',    label: 'RUNNING' },
  paused:            { bg: 'bg-amber-500/10',  text: 'text-amber-300',  border: 'border-amber-400/30',   label: 'PAUSED' },
  awaiting_approval: { bg: 'bg-violet-500/10', text: 'text-violet-300', border: 'border-violet-400/30',  label: 'APPROVAL' },
  failed:            { bg: 'bg-red-500/10',    text: 'text-red-300',    border: 'border-red-400/30',     label: 'FAILED' },
  recovered:         { bg: 'bg-cyan-500/10',   text: 'text-cyan-300',   border: 'border-cyan-400/30',    label: 'RECOVERED' },
  completed:         { bg: 'bg-emerald-500/10',text: 'text-emerald-300',border: 'border-emerald-400/30', label: 'COMPLETED' },
  cancelled:         { bg: 'bg-white/[0.04]',  text: 'text-white/40',   border: 'border-white/10',       label: 'CANCELLED' },
}

const HEALTH_STATUS_STYLE = (status: string) => {
  const s = status.toLowerCase()
  if (s === 'idle' || s === 'empty')      return 'bg-white/[0.04] text-white/50 border-white/10'
  if (s === 'busy' || s === 'running' || s === 'live') return 'bg-emerald-500/10 text-emerald-300 border-emerald-400/30'
  if (s === 'overloaded')                                return 'bg-amber-500/10 text-amber-300 border-amber-400/30'
  if (s === 'disabled')                                  return 'bg-white/[0.04] text-white/30 border-white/10'
  if (s === 'failed' || s === 'errored' || s === 'crashed') return 'bg-red-500/10 text-red-300 border-red-400/30'
  if (s.includes('deploy'))                              return 'bg-cyan-500/10 text-cyan-300 border-cyan-400/30'
  return 'bg-indigo-500/10 text-indigo-300 border-indigo-400/30'
}

export function RoutineStatusBadge({ status, size = 'sm' }: { status: RoutineStatus; size?: 'xs' | 'sm' | 'md' }) {
  const s = ROUTINE_STATUS_STYLE[status]
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

export function RunStatusBadge({ status, size = 'sm' }: { status: RunStatus; size?: 'xs' | 'sm' | 'md' }) {
  const s = RUN_STATUS_STYLE[status]
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

export function HealthStatusBadge({ status }: { status: string }) {
  const cls = HEALTH_STATUS_STYLE(status)
  return (
    <span className={clsx(
      'inline-flex items-center font-medium uppercase tracking-wide rounded border px-2 py-0.5 text-[10px]',
      cls,
    )}>
      {status.toUpperCase()}
    </span>
  )
}

export const ROUTINE_KIND_ICON_KEY: Record<string, string> = {
  agent:    'Bot',
  workflow: 'GitMerge',
  cron:     'Clock',
  reactive: 'Zap',
}
