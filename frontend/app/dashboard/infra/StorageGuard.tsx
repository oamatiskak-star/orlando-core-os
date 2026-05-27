'use client'

import { useEffect, useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  HardDrive, Database, Trash2, Zap, AlertOctagon, RefreshCw, RotateCw,
  Loader2, AlertTriangle, CheckCircle, Clock, Wifi, WifiOff,
} from 'lucide-react'
import clsx from 'clsx'
import { queueStorageCommand } from './storage-actions'

export type HostStorage = {
  host_id: string
  disk_pct: number | null
  free_gb: number | null
  used_gb: number | null
  size_gb: number | null
  docker_raw_gb: number | null
  tier: string | null
  last_actions: unknown
  last_truncated: unknown
  reclaimed_gb_total: number | null
  last_error: string | null
  updated_at: string
}

export type StorageCommand = {
  id: string
  host_id: string
  command: string
  status: string
  requested_at: string
  finished_at: string | null
  result: string | null
}

const STALE_MS = 3 * 60 * 1000 // watchdog heartbeat-venster (storage-tick = 5min, marge)

function fmtTime(s: string | null) {
  if (!s) return '—'
  return new Date(s).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })
}

function tierStyle(tier: string | null, stale: boolean) {
  if (stale) return { dot: 'bg-white/30', text: 'text-white/45', label: 'Geen heartbeat' }
  switch (tier) {
    case 'emergency':  return { dot: 'bg-red-400 animate-pulse',    text: 'text-red-300',    label: 'EMERGENCY' }
    case 'aggressive': return { dot: 'bg-orange-400 animate-pulse', text: 'text-orange-300', label: 'Aggressive cleanup' }
    case 'warning':    return { dot: 'bg-amber-400',                text: 'text-amber-300',  label: 'Waarschuwing' }
    default:           return { dot: 'bg-emerald-400',              text: 'text-emerald-300',label: 'Gezond' }
  }
}

function barColor(pct: number | null) {
  if (pct == null) return 'bg-white/20'
  if (pct >= 90) return 'bg-red-500'
  if (pct >= 80) return 'bg-orange-500'
  if (pct >= 70) return 'bg-amber-500'
  return 'bg-emerald-500'
}

function asList(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x))
  return []
}

function HostCard({ h, onChanged }: { h: HostStorage; onChanged: () => void }) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [busyCmd, setBusyCmd] = useState<string | null>(null)

  const stale = !h.updated_at || Date.now() - new Date(h.updated_at).getTime() > STALE_MS
  const ts = tierStyle(h.tier, stale)
  const actions = asList(h.last_actions)
  const truncated = asList(h.last_truncated)

  function run(command: string, confirmMsg?: string) {
    if (confirmMsg && !window.confirm(confirmMsg)) return
    setError(null)
    setBusyCmd(command)
    startTransition(async () => {
      const res = await queueStorageCommand(h.host_id, command)
      if (!res.ok) setError(res.error ?? 'Actie mislukt')
      setBusyCmd(null)
      onChanged()
    })
  }

  const Btn = ({ cmd, icon: Icon, label, cls, confirmMsg }: {
    cmd: string; icon: typeof Trash2; label: string; cls: string; confirmMsg?: string
  }) => (
    <button
      onClick={() => run(cmd, confirmMsg)}
      disabled={pending}
      className={clsx('flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg border text-[11px] transition-colors disabled:opacity-40', cls)}
    >
      {pending && busyCmd === cmd ? <Loader2 size={11} className="animate-spin" /> : <Icon size={11} />}
      {label}
    </button>
  )

  return (
    <div className={clsx('rounded-xl border p-4 flex flex-col gap-3', stale ? 'bg-white/[0.03] border-white/5' : 'bg-white/[0.06] border-white/10')}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <HardDrive size={14} className="text-indigo-400 flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate uppercase">{h.host_id}</p>
            <p className="text-[10px] text-white/45 flex items-center gap-1">
              {stale ? <WifiOff size={9} /> : <Wifi size={9} />} watchdog · {fmtTime(h.updated_at)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className={clsx('w-1.5 h-1.5 rounded-full', ts.dot)} />
          <span className={clsx('text-[10px]', ts.text)}>{ts.label}</span>
        </div>
      </div>

      {/* Disk bar */}
      <div>
        <div className="flex items-center justify-between text-[10px] mb-1">
          <span className="text-white/50">Interne SSD</span>
          <span className={clsx('font-semibold', (h.disk_pct ?? 0) >= 80 ? 'text-orange-300' : 'text-white/70')}>
            {h.disk_pct ?? '—'}% · {h.free_gb ?? '—'} GB vrij
          </span>
        </div>
        <div className="h-2 rounded-full bg-white/10 overflow-hidden">
          <div className={clsx('h-full rounded-full transition-all', barColor(h.disk_pct))} style={{ width: `${Math.min(h.disk_pct ?? 0, 100)}%` }} />
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-2 text-center">
        <div className="bg-white/[0.04] rounded-lg py-2">
          <p className="text-sm font-bold text-white flex items-center justify-center gap-1"><Database size={10} className="text-white/40" />{h.docker_raw_gb ?? '—'} GB</p>
          <p className="text-[9px] text-white/38">Docker.raw</p>
        </div>
        <div className="bg-white/[0.04] rounded-lg py-2">
          <p className="text-sm font-bold text-white">{h.used_gb ?? '—'} GB</p>
          <p className="text-[9px] text-white/38">Gebruikt</p>
        </div>
      </div>

      {h.last_error && (
        <div className="flex items-start gap-1 text-[10px] text-red-400/80">
          <AlertTriangle size={10} className="mt-0.5 flex-shrink-0" />
          <span className="line-clamp-2">{h.last_error}</span>
        </div>
      )}

      {(actions.length > 0 || truncated.length > 0) && (
        <div className="text-[9.5px] text-white/45 bg-white/[0.03] rounded px-2 py-1 space-y-0.5">
          {actions.length > 0 && <p>Acties: <span className="text-white/60">{actions.join(', ')}</span></p>}
          {truncated.length > 0 && <p>Getrunceerd: <span className="text-white/60">{truncated.join(', ')}</span></p>}
        </div>
      )}

      {error && (
        <div className="flex items-start gap-1 text-[10px] text-amber-400">
          <AlertTriangle size={10} className="mt-0.5 flex-shrink-0" /><span>{error}</span>
        </div>
      )}

      {/* Command buttons */}
      <div className="grid grid-cols-2 gap-2 pt-1 border-t border-white/[0.06]">
        <Btn cmd="run-cleanup"    icon={Trash2}      label="Cleanup"       cls="border-white/10 text-white/60 hover:text-sky-300 hover:border-sky-500/30" />
        <Btn cmd="reclaim-space"  icon={RefreshCw}   label="Reclaim ruimte" cls="border-white/10 text-white/60 hover:text-emerald-300 hover:border-emerald-500/30" />
        <Btn cmd="aggressive-cleanup" icon={Zap}     label="Aggressive"    cls="border-amber-500/25 text-amber-200/80 hover:bg-amber-500/10"
             confirmMsg={`Aggressive cleanup op ${h.host_id}? Truncate logs >500MB + prune.`} />
        <Btn cmd="restart-docker" icon={RotateCw}    label="Docker herstart" cls="border-white/10 text-white/60 hover:text-orange-300 hover:border-orange-500/30"
             confirmMsg={`Docker herstarten op ${h.host_id}? Containers herstarten kort.`} />
        <button
          onClick={() => run('emergency-cleanup', `EMERGENCY cleanup op ${h.host_id}? Truncate alle logs >100MB + prune + fstrim.`)}
          disabled={pending}
          className="col-span-2 flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-red-500/30 bg-red-500/10 text-red-200 hover:bg-red-500/20 disabled:opacity-40 text-[11px] transition-colors"
        >
          {pending && busyCmd === 'emergency-cleanup' ? <Loader2 size={11} className="animate-spin" /> : <AlertOctagon size={11} />} Emergency cleanup
        </button>
      </div>
    </div>
  )
}

export default function StorageGuard({
  initialStatus, initialCommands,
}: { initialStatus: HostStorage[]; initialCommands: StorageCommand[] }) {
  const [hosts, setHosts] = useState<HostStorage[]>(initialStatus)
  const [commands, setCommands] = useState<StorageCommand[]>(initialCommands)

  async function refresh() {
    const supabase = createClient()
    const [{ data: s }, { data: c }] = await Promise.all([
      supabase.from('host_storage_status').select('*').order('host_id'),
      supabase.from('storage_commands').select('id, host_id, command, status, requested_at, finished_at, result').order('requested_at', { ascending: false }).limit(8),
    ])
    if (s) setHosts(s as HostStorage[])
    if (c) setCommands(c as StorageCommand[])
  }

  useEffect(() => {
    const iv = setInterval(refresh, 10_000)
    return () => clearInterval(iv)
  }, [])

  const cmdIcon = (status: string) =>
    status === 'done' ? <CheckCircle size={11} className="text-emerald-400" />
    : status === 'error' ? <AlertTriangle size={11} className="text-red-400" />
    : status === 'running' ? <Loader2 size={11} className="text-amber-400 animate-spin" />
    : <Clock size={11} className="text-white/40" />

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <HardDrive size={13} className="text-indigo-400" />
        <h2 className="text-sm font-semibold text-white">Storage Watchdog</h2>
        <button onClick={refresh} className="ml-auto flex items-center gap-1.5 text-[11px] text-white/45 hover:text-white/70 transition-colors">
          <RefreshCw size={11} /> auto 10s
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {hosts.map((h) => <HostCard key={h.host_id} h={h} onChanged={refresh} />)}
        {hosts.length === 0 && (
          <div className="col-span-3 flex flex-col items-center justify-center py-12 gap-2 bg-white/[0.02] border border-white/5 rounded-xl">
            <HardDrive size={22} className="text-white/20" />
            <p className="text-sm text-white/50">Nog geen storage-status — watchdog rapporteert binnen 5 min</p>
          </div>
        )}
      </div>

      {commands.length > 0 && (
        <div className="bg-white/[0.03] border border-white/5 rounded-xl p-3">
          <p className="text-[11px] text-white/50 mb-2">Recente commando&apos;s</p>
          <div className="space-y-1">
            {commands.map((c) => (
              <div key={c.id} className="flex items-center gap-2 text-[10.5px]">
                {cmdIcon(c.status)}
                <span className="text-white/70 font-medium uppercase">{c.host_id}</span>
                <span className="text-white/55">{c.command}</span>
                <span className="text-white/30 ml-auto">{fmtTime(c.finished_at ?? c.requested_at)}</span>
                {c.result && <span className="text-white/40 truncate max-w-[40%]">· {c.result}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
