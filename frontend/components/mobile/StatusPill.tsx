import clsx from 'clsx'

type Status = 'online' | 'offline' | 'busy' | 'error' | 'warning' | 'unknown' | 'actief' | 'gepauzeerd' | 'gestopt' | 'success' | 'failed' | 'pending' | 'running'

const CONFIG: Record<Status | string, { label: string; cls: string }> = {
  online:     { label: 'Online',    cls: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' },
  actief:     { label: 'Actief',    cls: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' },
  success:    { label: 'Geslaagd',  cls: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' },
  running:    { label: 'Actief',    cls: 'bg-sky-500/10 text-sky-400 border border-sky-500/20' },
  busy:       { label: 'Bezig',     cls: 'bg-amber-500/10 text-amber-400 border border-amber-500/20' },
  pending:    { label: 'Wacht',     cls: 'bg-amber-500/10 text-amber-400 border border-amber-500/20' },
  warning:    { label: 'Waarschuwing', cls: 'bg-amber-500/10 text-amber-400 border border-amber-500/20' },
  offline:    { label: 'Offline',   cls: 'bg-red-500/10 text-red-400 border border-red-500/20' },
  error:      { label: 'Fout',      cls: 'bg-red-500/10 text-red-400 border border-red-500/20' },
  failed:     { label: 'Mislukt',   cls: 'bg-red-500/10 text-red-400 border border-red-500/20' },
  gestopt:    { label: 'Gestopt',   cls: 'bg-slate-500/10 text-slate-400 border border-slate-500/20' },
  gepauzeerd: { label: 'Gepauzeerd', cls: 'bg-slate-500/10 text-slate-400 border border-slate-500/20' },
  unknown:    { label: 'Onbekend',  cls: 'bg-white/5 text-white/40 border border-white/10' },
}

interface Props {
  status: string
  label?: string
  size?: 'xs' | 'sm'
}

export default function StatusPill({ status, label, size = 'xs' }: Props) {
  const cfg = CONFIG[status] ?? CONFIG.unknown
  return (
    <span className={clsx(
      'inline-flex items-center rounded-full font-medium',
      size === 'xs' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs',
      cfg.cls
    )}>
      {label ?? cfg.label}
    </span>
  )
}
