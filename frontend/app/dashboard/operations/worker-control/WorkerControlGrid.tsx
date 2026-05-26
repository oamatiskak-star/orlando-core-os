'use client'

import { useEffect, useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Power, RotateCw, Cpu, MemoryStick, Layers, AlertTriangle, Loader2, Cloud, RefreshCw, Server } from 'lucide-react'
import clsx from 'clsx'
import { setWorkerState, restartWorker, restartAllControllable } from './actions'

export type Worker = {
  id: string
  worker_type: string | null
  display_name: string | null
  host: string | null
  status: string | null
  desired_state: string | null
  controllable: boolean | null
  queue_depth: number | null
  cpu_percent: number | null
  ram_mb: number | null
  tasks_today: number | null
  tasks_total: number | null
  current_task_description: string | null
  last_error: string | null
  last_heartbeat: string | null
  restart_requested_at: string | null
  last_command: string | null
  last_command_at: string | null
  last_command_result: string | null
  updated_at: string | null
}

const SELECT_COLS =
  'id, worker_type, display_name, host, status, desired_state, controllable, queue_depth, cpu_percent, ram_mb, tasks_today, tasks_total, current_task_description, last_error, last_heartbeat, restart_requested_at, last_command, last_command_at, last_command_result, updated_at'

function fmtTime(s: string | null) {
  if (!s) return '—'
  return new Date(s).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function WorkerCard({ w, staleMs, onChanged }: { w: Worker; staleMs: number; onChanged: () => void }) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const stale = !w.last_heartbeat || Date.now() - new Date(w.last_heartbeat).getTime() > staleMs
  const stopped = w.desired_state === 'stopped'
  const offline = stopped || stale || w.status === 'offline'
  const pendingRestart = !!w.restart_requested_at
  const controllable = !!w.controllable

  const dot = stopped
    ? 'bg-white/30'
    : pendingRestart
    ? 'bg-amber-400 animate-pulse'
    : offline
    ? 'bg-red-400'
    : w.status === 'busy'
    ? 'bg-amber-400 animate-pulse'
    : 'bg-emerald-400'

  const stateLabel = stopped
    ? 'Gestopt'
    : pendingRestart
    ? 'Herstart aangevraagd…'
    : stale
    ? 'Geen heartbeat'
    : w.status === 'busy'
    ? 'Bezig'
    : w.status === 'offline'
    ? 'Offline'
    : 'Online'

  function act(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null)
    startTransition(async () => {
      const res = await fn()
      if (!res.ok) setError(res.error ?? 'Actie mislukt')
      onChanged()
    })
  }

  const name = w.display_name || w.id
  const sub = [w.worker_type, w.host].filter(Boolean).join(' · ') || '—'

  return (
    <div className={clsx('rounded-xl border p-4 flex flex-col gap-3', offline ? 'bg-white/[0.03] border-white/5' : 'bg-white/[0.06] border-white/10')}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white truncate">{name}</p>
          <p className="text-[10px] text-white/45 truncate">{sub}</p>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className={clsx('w-1.5 h-1.5 rounded-full', dot)} />
          <span className={clsx('text-[10px]', offline ? 'text-white/45' : 'text-white/55')}>{stateLabel}</span>
        </div>
      </div>

      {w.current_task_description && (
        <p className="text-[10.5px] text-white/55 bg-white/[0.04] rounded px-2 py-1 truncate">{w.current_task_description}</p>
      )}

      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-sm font-bold text-white flex items-center justify-center gap-1"><Layers size={10} className="text-white/40" />{w.queue_depth ?? 0}</p>
          <p className="text-[9px] text-white/38">Queue</p>
        </div>
        <div>
          <p className="text-sm font-bold text-white flex items-center justify-center gap-1"><Cpu size={10} className="text-white/40" />{w.cpu_percent != null ? `${Math.round(w.cpu_percent)}%` : '—'}</p>
          <p className="text-[9px] text-white/38">CPU</p>
        </div>
        <div>
          <p className="text-sm font-bold text-white flex items-center justify-center gap-1"><MemoryStick size={10} className="text-white/40" />{w.ram_mb != null ? `${Math.round(w.ram_mb)}` : '—'}</p>
          <p className="text-[9px] text-white/38">RAM mb</p>
        </div>
      </div>

      {w.last_error && (
        <div className="flex items-start gap-1 text-[10px] text-red-400/80">
          <AlertTriangle size={10} className="mt-0.5 flex-shrink-0" />
          <span className="line-clamp-2">{w.last_error}</span>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-1 text-[10px] text-amber-400">
          <AlertTriangle size={10} className="mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex items-center gap-2 pt-1 border-t border-white/[0.06]">
        {controllable ? (
          <>
            {stopped ? (
              <button
                onClick={() => act(() => setWorkerState(w.id, 'running'))}
                disabled={pending}
                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-emerald-400/30 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20 disabled:opacity-50 text-[11px] transition-colors"
              >
                {pending ? <Loader2 size={11} className="animate-spin" /> : <Power size={11} />} Aanzetten
              </button>
            ) : (
              <button
                onClick={() => act(() => setWorkerState(w.id, 'stopped'))}
                disabled={pending}
                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-white/10 text-white/60 hover:text-amber-300 hover:border-amber-500/30 disabled:opacity-50 text-[11px] transition-colors"
              >
                {pending ? <Loader2 size={11} className="animate-spin" /> : <Power size={11} />} Uitzetten
              </button>
            )}
            <button
              onClick={() => act(() => restartWorker(w.id))}
              disabled={pending || pendingRestart}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-white/10 text-white/60 hover:text-sky-300 hover:border-sky-500/30 disabled:opacity-40 text-[11px] transition-colors"
            >
              {pending ? <Loader2 size={11} className="animate-spin" /> : <RotateCw size={11} />} Herstart
            </button>
          </>
        ) : (
          <span className="flex items-center gap-1.5 text-[10px] text-white/35 py-1.5">
            <Cloud size={11} /> Render — niet lokaal bestuurbaar
          </span>
        )}
      </div>

      {w.last_command && (
        <p className="text-[9px] text-white/30">
          Laatste commando: <span className="text-white/50">{w.last_command}</span> om {fmtTime(w.last_command_at)}
          {w.last_command_result ? ` — ${w.last_command_result}` : ''}
        </p>
      )}
    </div>
  )
}

export default function WorkerControlGrid({ initialWorkers, staleMs }: { initialWorkers: Worker[]; staleMs: number }) {
  const [workers, setWorkers] = useState<Worker[]>(initialWorkers)
  const [pendingAll, startAll] = useTransition()
  const [allMsg, setAllMsg] = useState<string | null>(null)

  async function refresh() {
    const supabase = createClient()
    const { data } = await supabase
      .from('worker_registry')
      .select(SELECT_COLS)
      .order('controllable', { ascending: false })
      .order('display_name', { ascending: true, nullsFirst: false })
    if (data) setWorkers(data as Worker[])
  }

  useEffect(() => {
    const iv = setInterval(refresh, 10_000)
    return () => clearInterval(iv)
  }, [])

  const controllableCount = workers.filter((w) => w.controllable).length

  function handleRestartAll() {
    if (!window.confirm(`${controllableCount} lokale worker(s) herstarten?`)) return
    setAllMsg(null)
    startAll(async () => {
      const res = await restartAllControllable()
      setAllMsg(res.ok ? `Herstart aangevraagd voor ${res.count} worker(s)` : (res.error ?? 'Mislukt'))
      await refresh()
    })
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <button onClick={refresh} className="flex items-center gap-1.5 text-[11px] text-white/45 hover:text-white/70 transition-colors">
          <RefreshCw size={11} /> Ververs · auto 10s
        </button>
        <div className="flex items-center gap-3">
          {allMsg && <span className="text-[11px] text-white/50">{allMsg}</span>}
          <button
            onClick={handleRestartAll}
            disabled={pendingAll || controllableCount === 0}
            className="flex items-center gap-1.5 bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white text-xs font-medium px-4 py-2 rounded-lg transition-colors"
          >
            {pendingAll ? <Loader2 size={13} className="animate-spin" /> : <RotateCw size={13} />}
            Herstart alle lokale workers
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {workers.map((w) => <WorkerCard key={w.id} w={w} staleMs={staleMs} onChanged={refresh} />)}
        {workers.length === 0 && (
          <div className="col-span-3 flex flex-col items-center justify-center py-16 gap-3 bg-white/[0.02] border border-white/5 rounded-xl">
            <Server size={24} className="text-white/20" />
            <p className="text-sm text-white/50">Geen workers geregistreerd</p>
          </div>
        )}
      </div>
    </div>
  )
}
