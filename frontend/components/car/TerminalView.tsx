'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

type Worker = {
  id: string
  display_name: string | null
  worker_type: string | null
  host: string | null
  status: string | null
  cpu_percent: number | null
  ram_mb: number | null
  uptime_seconds: number | null
  current_task_description: string | null
  last_heartbeat: string | null
  updated_at: string | null
}

function statusColor(status: string | null): string {
  switch (status) {
    case 'online':  return '#00ff41'
    case 'error':   return '#ff3f3f'
    case 'offline': return '#ff6600'
    default:        return '#555555'
  }
}

function statusLabel(status: string | null): string {
  switch (status) {
    case 'online':  return 'ON '
    case 'error':   return 'ERR'
    case 'offline': return 'OFF'
    default:        return '---'
  }
}

function fmtUptime(seconds: number | null): string {
  if (!seconds) return '--'
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
  return `${Math.floor(seconds / 3600)}h${Math.floor((seconds % 3600) / 60)}m`
}

function fmtAge(iso: string | null): string {
  if (!iso) return 'nooit'
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 5) return 'nu'
  if (s < 60) return `${s}s`
  if (s < 3600) return `${Math.floor(s / 60)}m`
  return `${Math.floor(s / 3600)}h`
}

function WorkerRow({ w }: { w: Worker }) {
  const col = statusColor(w.status)
  const label = w.display_name ?? w.id

  return (
    <div className="flex items-start gap-2 py-[3px] border-b border-white/5">
      {/* status dot + label */}
      <span className="shrink-0 text-xs tabular-nums" style={{ color: col, width: 28 }}>
        {statusLabel(w.status)}
      </span>

      {/* worker name */}
      <span className="flex-1 truncate text-xs" style={{ color: w.status === 'online' ? '#c8ffc8' : '#666' }}>
        {label}
      </span>

      {/* metrics */}
      <span className="shrink-0 text-[10px] tabular-nums text-white/35 text-right" style={{ width: 80 }}>
        {w.cpu_percent != null ? `${w.cpu_percent}%cpu` : ''}
        {w.ram_mb != null ? ` ${w.ram_mb}MB` : ''}
      </span>

      <span className="shrink-0 text-[10px] tabular-nums text-white/30" style={{ width: 36 }}>
        {fmtUptime(w.uptime_seconds)}
      </span>
    </div>
  )
}

function Panel({
  label,
  nodeId,
  workers,
}: {
  label: string
  nodeId: string
  workers: Worker[]
}) {
  const online  = workers.filter(w => w.status === 'online').length
  const total   = workers.length
  const allGood = online === total && total > 0
  const lastBeat = workers.reduce((latest, w) => {
    if (!w.last_heartbeat) return latest
    return !latest || w.last_heartbeat > latest ? w.last_heartbeat : latest
  }, null as string | null)

  return (
    <div
      className="flex flex-col h-full border-r border-white/10"
      style={{ minWidth: 0 }}
    >
      {/* Panel header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/15 bg-white/[0.03]">
        <span
          className="text-[9px] font-bold tracking-widest uppercase"
          style={{ color: allGood ? '#00ff41' : total === 0 ? '#555' : '#ff6600' }}
        >
          {label}
        </span>
        <span className="text-[9px] text-white/30 ml-auto">{nodeId}</span>
        <span
          className="text-[9px] tabular-nums"
          style={{ color: allGood ? '#00ff41' : '#ff6600' }}
        >
          {online}/{total}
        </span>
        <span className="text-[9px] text-white/25">
          {fmtAge(lastBeat)}
        </span>
      </div>

      {/* Worker rows */}
      <div className="flex-1 overflow-y-auto px-3 py-1">
        {workers.length === 0 ? (
          <div className="text-[10px] text-white/20 pt-3">geen data</div>
        ) : (
          workers.map(w => <WorkerRow key={w.id} w={w} />)
        )}
      </div>
    </div>
  )
}

export default function TerminalView({ initialWorkers }: { initialWorkers: Worker[] }) {
  const [workers, setWorkers] = useState<Worker[]>(initialWorkers)
  const [tick, setTick]       = useState(0)

  const merge = useCallback((updated: Worker) => {
    setWorkers(prev => {
      const idx = prev.findIndex(w => w.id === updated.id)
      if (idx === -1) return [...prev, updated]
      const next = [...prev]
      next[idx] = updated
      return next
    })
  }, [])

  // Supabase Realtime subscription
  useEffect(() => {
    const db = createClient()
    const channel = db
      .channel('car-worker-registry')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'worker_registry' },
        payload => { if (payload.new) merge(payload.new as Worker) }
      )
      .subscribe()
    return () => { db.removeChannel(channel) }
  }, [merge])

  // Clock tick for relative time labels
  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 10_000)
    return () => clearInterval(t)
  }, [])

  // Group by host — mac-mini-1 = CLI-L, everything else = CLI-R
  const cliL = workers.filter(w => w.host === 'mac-mini-1')
  const cliR = workers.filter(w => w.host !== 'mac-mini-1')

  const now = new Date().toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="flex items-center px-3 py-[5px] bg-[#0a0a0a] border-b border-white/10">
        <span className="text-[9px] tracking-[0.3em] uppercase text-white/40">OC OS // TERMINAL</span>
        <span className="ml-auto text-[9px] tabular-nums text-white/25">{now}</span>
      </div>

      {/* Two panels */}
      <div className="flex flex-1 overflow-hidden" style={{ minHeight: 0 }}>
        <div className="flex-1 overflow-hidden">
          <Panel label="CLI-L" nodeId="mac-mini-1" workers={cliL} />
        </div>
        <div className="flex-1 overflow-hidden">
          <Panel label="CLI-R" nodeId="render" workers={cliR} />
        </div>
      </div>

      {/* Footer */}
      <div className="px-3 py-[4px] bg-[#0a0a0a] border-t border-white/10 flex items-center gap-3">
        <span className="text-[8px] text-white/20">REALTIME ●</span>
        <span className="text-[8px] text-white/20">
          {workers.filter(w => w.status === 'online').length}/{workers.length} workers online
        </span>
        <span className="ml-auto text-[8px] text-white/15">
          /car — CarPlay view
        </span>
      </div>
    </div>
  )
}
