'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type {
  OrchestratorEvent,
  OrchestratorTask,
  SystemStateRow,
  TaskError,
  TaskPriorityBand,
  Worker,
} from '@/lib/orchestrator/types'
import PriorityLanes from './PriorityLanes'
import StatusStrip from './StatusStrip'
import WorkersPanel from './WorkersPanel'
import WaitingHumanInput from './WaitingHumanInput'
import RecentFailures from './RecentFailures'
import SystemEvents from './SystemEvents'

interface Props {
  initialCounters: SystemStateRow[]
  initialWorkers:  Worker[]
  initialErrors:   TaskError[]
  initialEvents:   OrchestratorEvent[]
  initialLanes:    Record<TaskPriorityBand, OrchestratorTask[]>
  initialWaiting:  OrchestratorTask[]
}

export default function OrchestratorClient({
  initialCounters,
  initialWorkers,
  initialErrors,
  initialEvents,
  initialLanes,
  initialWaiting,
}: Props) {
  const [counters, setCounters] = useState(initialCounters)
  const [workers,  setWorkers]  = useState(initialWorkers)
  const [errors,   setErrors]   = useState(initialErrors)
  const [events,   setEvents]   = useState(initialEvents)
  const [lanes,    setLanes]    = useState(initialLanes)
  const [waiting,  setWaiting]  = useState(initialWaiting)

  const refresh = useCallback(async () => {
    const [stateRes, workersRes, tasksRes] = await Promise.all([
      fetch('/api/orchestrator/system/state', { cache: 'no-store' }),
      fetch('/api/orchestrator/workers',      { cache: 'no-store' }),
      fetch('/api/orchestrator/tasks?limit=50&status=open&status=retry&status=running&status=paused&status=waiting', { cache: 'no-store' }),
    ])

    if (stateRes.ok) {
      const j = await stateRes.json()
      setCounters(j.counters ?? [])
      setErrors(j.failures ?? [])
      setEvents(j.events ?? [])
    }
    if (workersRes.ok) {
      const j = await workersRes.json()
      setWorkers(j.workers ?? [])
    }
    if (tasksRes.ok) {
      const j = await tasksRes.json()
      const all = (j.tasks ?? []) as OrchestratorTask[]
      setLanes({
        hoog:    all.filter((t) => t.priority_band === 'hoog'    && t.status !== 'waiting').slice(0, 5),
        normaal: all.filter((t) => t.priority_band === 'normaal' && t.status !== 'waiting').slice(0, 5),
        laag:    all.filter((t) => t.priority_band === 'laag'    && t.status !== 'waiting').slice(0, 5),
      })
      setWaiting(all.filter((t) => t.status === 'waiting'))
    }
  }, [])

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('orchestrator')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orchestrator_tasks'   }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orchestrator_workers' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orchestrator_events'  }, refresh)
      .subscribe()

    const interval = setInterval(refresh, 30_000)

    return () => {
      clearInterval(interval)
      supabase.removeChannel(channel)
    }
  }, [refresh])

  const totals = useMemo(() => {
    const out = {
      hoog: 0, normaal: 0, laag: 0,
      running: 0, waiting: 0,
      completed_24h: 0, failed_24h: 0,
    }
    for (const c of counters) {
      if (c.band === 'hoog')    out.hoog    += c.count
      if (c.band === 'normaal') out.normaal += c.count
      if (c.band === 'laag')    out.laag    += c.count
      if (c.status === 'running') out.running += c.count
      if (c.status === 'waiting') out.waiting += c.count
    }
    return out
  }, [counters])

  return (
    <div className="px-4 md:px-6 py-4 space-y-4">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Orchestrator</h1>
          <p className="text-xs text-white/40 mt-0.5">
            Priority task engine · live state via Supabase realtime
          </p>
        </div>
        <button
          onClick={refresh}
          className="text-xs px-2 py-1 rounded-md bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] text-white/60"
        >
          Refresh
        </button>
      </header>

      <StatusStrip totals={totals} counters={counters} />

      <PriorityLanes lanes={lanes} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <WaitingHumanInput tasks={waiting} onResolved={refresh} />
        <WorkersPanel workers={workers} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <RecentFailures errors={errors} onRetried={refresh} />
        <SystemEvents events={events} />
      </div>
    </div>
  )
}
