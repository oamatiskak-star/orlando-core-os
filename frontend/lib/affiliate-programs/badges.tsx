import clsx from 'clsx'
import type { AccountStatus, LoginStatus, RunStatus, ProgramCategory } from './types'

const ACCOUNT_STATUS_STYLE: Record<AccountStatus, { bg: string; text: string; border: string; label: string }> = {
  not_started:   { bg: 'bg-white/[0.04]',    text: 'text-white/45',    border: 'border-white/10',       label: 'NOT STARTED' },
  applied:       { bg: 'bg-indigo-500/10',   text: 'text-indigo-300',  border: 'border-indigo-400/30',  label: 'APPLIED' },
  pending:       { bg: 'bg-amber-500/10',    text: 'text-amber-300',   border: 'border-amber-400/30',   label: 'PENDING' },
  approved:      { bg: 'bg-cyan-500/10',     text: 'text-cyan-300',    border: 'border-cyan-400/30',    label: 'APPROVED' },
  active:        { bg: 'bg-emerald-500/10',  text: 'text-emerald-300', border: 'border-emerald-400/30', label: 'ACTIVE' },
  payout_active: { bg: 'bg-emerald-500/15',  text: 'text-emerald-200', border: 'border-emerald-400/40', label: 'PAYOUT' },
  rejected:      { bg: 'bg-red-500/10',      text: 'text-red-300',     border: 'border-red-400/30',     label: 'REJECTED' },
  suspended:     { bg: 'bg-red-500/10',      text: 'text-red-300',     border: 'border-red-400/30',     label: 'SUSPENDED' },
}

const LOGIN_STATUS_STYLE: Record<LoginStatus, { text: string; label: string }> = {
  none:        { text: 'text-white/35', label: 'no login' },
  created:     { text: 'text-indigo-300', label: 'created' },
  verified:    { text: 'text-emerald-300', label: 'verified' },
  mfa_pending: { text: 'text-amber-300', label: 'mfa pending' },
  locked:      { text: 'text-red-300', label: 'locked' },
}

const RUN_STATUS_STYLE: Record<RunStatus, { bg: string; text: string; border: string; label: string }> = {
  queued:            { bg: 'bg-white/[0.04]',   text: 'text-white/60',    border: 'border-white/10',       label: 'QUEUED' },
  running:           { bg: 'bg-blue-500/10',    text: 'text-blue-300',    border: 'border-blue-400/30',    label: 'RUNNING' },
  awaiting_action:   { bg: 'bg-amber-500/10',   text: 'text-amber-300',   border: 'border-amber-400/30',   label: 'ACTION' },
  awaiting_approval: { bg: 'bg-violet-500/10',  text: 'text-violet-300',  border: 'border-violet-400/30',  label: 'APPROVAL' },
  failed:            { bg: 'bg-red-500/10',     text: 'text-red-300',     border: 'border-red-400/30',     label: 'FAILED' },
  recovered:         { bg: 'bg-cyan-500/10',    text: 'text-cyan-300',    border: 'border-cyan-400/30',    label: 'RECOVERED' },
  completed:         { bg: 'bg-emerald-500/10', text: 'text-emerald-300', border: 'border-emerald-400/30', label: 'COMPLETED' },
  cancelled:         { bg: 'bg-white/[0.04]',   text: 'text-white/40',    border: 'border-white/10',       label: 'CANCELLED' },
}

const CATEGORY_STYLE: Record<ProgramCategory, string> = {
  saas_ai:           'text-violet-300 border-violet-400/30 bg-violet-500/10',
  finance_crypto:    'text-amber-300 border-amber-400/30 bg-amber-500/10',
  vastgoed_data:     'text-cyan-300 border-cyan-400/30 bg-cyan-500/10',
  affiliate_network: 'text-indigo-300 border-indigo-400/30 bg-indigo-500/10',
  other:             'text-white/50 border-white/10 bg-white/[0.04]',
}

const SIZE = {
  xs: 'px-1.5 py-0.5 text-[9px]',
  sm: 'px-2 py-0.5 text-[10px]',
  md: 'px-2.5 py-1 text-xs',
}

export function AccountStatusBadge({ status, size = 'sm' }: { status: AccountStatus; size?: 'xs' | 'sm' | 'md' }) {
  const s = ACCOUNT_STATUS_STYLE[status]
  return (
    <span className={clsx('inline-flex items-center font-medium uppercase tracking-wide rounded border', s.bg, s.text, s.border, SIZE[size])}>
      {s.label}
    </span>
  )
}

export function RunStatusBadge({ status, size = 'sm' }: { status: RunStatus; size?: 'xs' | 'sm' | 'md' }) {
  const s = RUN_STATUS_STYLE[status]
  return (
    <span className={clsx('inline-flex items-center font-medium uppercase tracking-wide rounded border', s.bg, s.text, s.border, SIZE[size])}>
      {s.label}
    </span>
  )
}

export function LoginStatusLabel({ status }: { status: LoginStatus }) {
  const s = LOGIN_STATUS_STYLE[status]
  return <span className={clsx('text-[10px]', s.text)}>{s.label}</span>
}

export function CategoryBadge({ category, label, size = 'sm' }: { category: ProgramCategory; label: string; size?: 'xs' | 'sm' | 'md' }) {
  return (
    <span className={clsx('inline-flex items-center font-medium rounded border', CATEGORY_STYLE[category], SIZE[size])}>
      {label}
    </span>
  )
}
