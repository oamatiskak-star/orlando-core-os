'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Play, Square, RefreshCw, Pause, Trash2, Bug, RotateCcw,
  Cpu, MemoryStick, Clock, CheckCircle, AlertCircle, Wifi, WifiOff,
  ChevronDown, ChevronRight,
} from 'lucide-react'
import clsx from 'clsx'

type Worker = {
  id: string
  worker_type: string
  display_name: string
  host: string
  status: string
  current_task_description: string | null
  queue_depth: number
  cpu_percent: number | null
  ram_mb: number | null
  tasks_today: number
  tasks_total: number
  avg_task_duration_s: number | null
  last_error: string | null
  uptime_seconds: number | null
  last_heartbeat: string | null
  updated_at: string
}

const STATUS_CFG: Record<string, { label: string; color: string; dot: string }> = {
  online:  { label: 'Online',  color: 'text-green-400',  dot: 'bg-green-400' },
  busy:    { label: 'Bezig',   color: 'text-sky-400',    dot: 'bg-sky-400 animate-pulse' },
  idle:    { label: 'Idle',    color: 'text-white/50',   dot: 'bg-white/40' },
  offline: { label: 'Offline', color: 'text-white/30',   dot: 'bg-white/20' },
  error:   { label: 'Fout',    color: 'text-red-400',    dot: 'bg-red-400 animate-pulse' },
  paused:  { label: 'Gepauzeerd', color: 'text-amber-400', dot: 'bg-amber-400' },
}

const HOST_CFG: Record<string, string> = {
  'mac-mini-1': 'text-violet-400',
  'mac-mini-2': 'text-indigo-400',
  'render':     'text-sky-400',
}

function fmtUptime(s: number | null) {
  if (!s) return '—'
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return h > 0 ? `${h}u ${m}m` : `${m}m`
}

function fmtDuration(s: number | null) {
  if (!s) return '—'
  return s < 60 ? `${s}s` : `${Math.round(s / 60)}m`
}

export default function AgentControlPanel() {
  const [workers, setWorkers] = useState<Worker[]>([])
  const [expanded, setExpanded] = useState<string | null>(null)
  const [loading, setLoading] = useState<Record<string, boolean>>({})

  useEffect(() => {
    const supabase = createClient()

    const fetch = async () => {
      const { data } = await supabase.from('worker_registry').select('*').order('worker_type')
      if (data) setWorkers(data as Worker[])
    }

    fetch()

    const channel = supabase.channel('worker_registry_live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'worker_registry' }, fetch)
      .subscribe()

    const interval = setInterval(fetch, 10_000)
    return () => {
      supabase.removeChannel(channel)
      clearInterval(interval)
    }
  }, [])

  const control = useCallback(async (workerId: string, action: string) => {
    setLoading(prev => ({ ...prev, [`${workerId}_${action}`]: true }))
    try {
      await fetch('/api/youtube/workers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ worker_id: workerId, action }),
      })
    } finally {
      setLoading(prev => ({ ...prev, [`${workerId}_${action}`]: false }))
    }
  }, [])

  const isLoading = (id: string, action: string) => loading[`${id}_${action}`] === true

  return (
    <div className="space-y-2">
      {/* Summary bar */}
      <div className="flex items-center gap-4 text-[11px] text-white/50 px-1">
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
          {workers.filter(w => w.status === 'online' || w.status === 'busy').length} actief
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-white/20" />
          {workers.filter(w => w.status === 'offline').length} offline
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
          {workers.filter(w => w.status === 'error').length} fouten
        </span>
      </div>

      {/* Worker rows */}
      {workers.map(w => {
        const cfg = STATUS_CFG[w.status] ?? STATUS_CFG.offline
        const isExp = expanded === w.id

        return (
          <div key={w.id} className="border border-white/5 rounded-lg overflow-hidden">
            {/* Main row */}
            <div
              className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.02] cursor-pointer transition-colors"
              onClick={() => setExpanded(isExp ? null : w.id)}
            >
              {/* Expand icon */}
              {isExp
                ? <ChevronDown size={11} className="text-white/30 flex-shrink-0" />
                : <ChevronRight size={11} className="text-white/30 flex-shrink-0" />
              }

              {/* Status dot */}
              <span className={clsx('w-1.5 h-1.5 rounded-full flex-shrink-0', cfg.dot)} />

              {/* Name + host */}
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <span className="text-xs font-medium text-white/80 truncate">{w.display_name}</span>
                <span className={clsx('text-[10px] flex-shrink-0', HOST_CFG[w.host] ?? 'text-white/40')}>
                  {w.host}
                </span>
              </div>

              {/* Current task */}
              {w.current_task_description && (
                <span className="text-[10px] text-white/40 truncate hidden md:block max-w-[200px]">
                  {w.current_task_description}
                </span>
              )}

              {/* Stats pills */}
              <div className="flex items-center gap-2 flex-shrink-0">
                {w.cpu_percent !== null && (
                  <span className="flex items-center gap-1 text-[10px] text-white/45">
                    <Cpu size={9} />{w.cpu_percent}%
                  </span>
                )}
                {w.ram_mb !== null && (
                  <span className="flex items-center gap-1 text-[10px] text-white/45">
                    <MemoryStick size={9} />{w.ram_mb}MB
                  </span>
                )}
                <span className="text-[10px] text-white/40">{w.tasks_today} vandaag</span>
              </div>

              {/* Status badge */}
              <span className={clsx('text-[10px] font-medium flex-shrink-0', cfg.color)}>{cfg.label}</span>

              {/* Quick action buttons */}
              <div className="flex items-center gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
                <button
                  onClick={() => control(w.id, 'restart')}
                  disabled={isLoading(w.id, 'restart')}
                  title="Restart"
                  className="p-1 rounded hover:bg-white/10 text-white/40 hover:text-white/70 transition-colors disabled:opacity-40"
                >
                  <RefreshCw size={11} className={isLoading(w.id, 'restart') ? 'animate-spin' : ''} />
                </button>
                {w.status === 'offline'
                  ? (
                    <button
                      onClick={() => control(w.id, 'start')}
                      disabled={isLoading(w.id, 'start')}
                      title="Start"
                      className="p-1 rounded hover:bg-green-500/20 text-green-400/60 hover:text-green-400 transition-colors disabled:opacity-40"
                    >
                      <Play size={11} />
                    </button>
                  ) : (
                    <button
                      onClick={() => control(w.id, 'stop')}
                      disabled={isLoading(w.id, 'stop')}
                      title="Stop"
                      className="p-1 rounded hover:bg-red-500/20 text-red-400/60 hover:text-red-400 transition-colors disabled:opacity-40"
                    >
                      <Square size={11} />
                    </button>
                  )
                }
              </div>
            </div>

            {/* Expanded detail */}
            {isExp && (
              <div className="px-4 pb-3 pt-2 border-t border-white/5 bg-[#07070f] space-y-3">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[11px]">
                  <div>
                    <p className="text-white/40">Worker ID</p>
                    <p className="text-white/60 font-mono">{w.id}</p>
                  </div>
                  <div>
                    <p className="text-white/40">Type</p>
                    <p className="text-white/60">{w.worker_type}</p>
                  </div>
                  <div>
                    <p className="text-white/40">Uptime</p>
                    <p className="text-white/60 flex items-center gap-1"><Clock size={10} />{fmtUptime(w.uptime_seconds)}</p>
                  </div>
                  <div>
                    <p className="text-white/40">Gem. duur taak</p>
                    <p className="text-white/60">{fmtDuration(w.avg_task_duration_s)}</p>
                  </div>
                  <div>
                    <p className="text-white/40">Taken vandaag</p>
                    <p className="text-white/70 font-medium">{w.tasks_today}</p>
                  </div>
                  <div>
                    <p className="text-white/40">Totaal taken</p>
                    <p className="text-white/60">{w.tasks_total}</p>
                  </div>
                  {w.last_heartbeat && (
                    <div>
                      <p className="text-white/40">Laatste heartbeat</p>
                      <p className="text-white/50">{new Date(w.last_heartbeat).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</p>
                    </div>
                  )}
                  {w.queue_depth > 0 && (
                    <div>
                      <p className="text-white/40">Queue diepte</p>
                      <p className="text-amber-400">{w.queue_depth} wachtend</p>
                    </div>
                  )}
                </div>

                {w.last_error && (
                  <div className="bg-red-500/10 border border-red-500/20 rounded px-3 py-2">
                    <p className="text-red-400 text-[11px]">✗ {w.last_error}</p>
                  </div>
                )}

                {/* Full action buttons */}
                <div className="flex flex-wrap items-center gap-2">
                  {[
                    { action: 'start',       icon: Play,       label: 'Start',        cls: 'text-green-400 hover:bg-green-500/10' },
                    { action: 'stop',        icon: Square,     label: 'Stop',         cls: 'text-red-400 hover:bg-red-500/10' },
                    { action: 'restart',     icon: RefreshCw,  label: 'Restart',      cls: 'text-sky-400 hover:bg-sky-500/10' },
                    { action: 'pause',       icon: Pause,      label: 'Pause',        cls: 'text-amber-400 hover:bg-amber-500/10' },
                    { action: 'clear-queue', icon: Trash2,     label: 'Clear Queue',  cls: 'text-white/50 hover:bg-white/5' },
                    { action: 'debug',       icon: Bug,        label: 'Debug',        cls: 'text-violet-400 hover:bg-violet-500/10' },
                  ].map(({ action, icon: Icon, label, cls }) => (
                    <button
                      key={action}
                      onClick={() => control(w.id, action)}
                      disabled={isLoading(w.id, action)}
                      className={clsx(
                        'flex items-center gap-1 text-[10px] px-2 py-1 rounded border border-white/8 transition-colors disabled:opacity-40',
                        cls
                      )}
                    >
                      <Icon size={9} className={isLoading(w.id, action) ? 'animate-spin' : ''} />
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
