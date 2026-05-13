'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { cancelTask, retryTask } from './actions'
import clsx from 'clsx'

type Task = {
  id: string
  agent_id: string
  task_type: string
  status: string
  payload: Record<string, unknown> | null
  result: Record<string, unknown> | null
  error: string | null
  queued_at: string
  started_at: string | null
  finished_at: string | null
  duration_ms: number | null
  oc_agents: { naam: string; company: string } | null
}

const STATUS_COLORS: Record<string, string> = {
  queued: 'bg-white/5 text-white/65',
  running: 'bg-indigo-500/10 text-indigo-400',
  success: 'bg-green-500/10 text-green-400',
  failed: 'bg-red-500/10 text-red-400',
  cancelled: 'bg-white/5 text-white/38',
}

export default function AgentTaskFeed() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()

    async function fetchTasks() {
      const { data } = await supabase
        .from('oc_agent_tasks')
        .select('*, oc_agents(naam, company)')
        .order('queued_at', { ascending: false })
        .limit(30)
      setTasks((data as Task[]) ?? [])
    }

    fetchTasks()

    const channel = supabase
      .channel('oc_agent_tasks_live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'oc_agent_tasks' }, () => {
        fetchTasks()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 gap-2">
        <p className="text-xs text-white/45">Geen taken in de queue</p>
        <p className="text-[11px] text-white/50">Dispatch een taak via een agent om hier activiteit te zien</p>
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      {tasks.map(task => (
        <div key={task.id} className="border border-white/5 rounded-lg overflow-hidden">
          <div
            className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.02] cursor-pointer transition-colors"
            onClick={() => setExpanded(expanded === task.id ? null : task.id)}
          >
            <span className={clsx('px-2 py-0.5 rounded-full text-[10px] font-medium flex-shrink-0', STATUS_COLORS[task.status] ?? 'bg-white/5 text-white/50')}>
              {task.status}
            </span>
            <span className="text-xs text-white/70 flex-1 truncate">
              {task.oc_agents?.naam ?? 'Onbekend'} — {task.task_type}
            </span>
            <span className="text-[11px] text-white/45 flex-shrink-0">
              {new Date(task.queued_at).toLocaleString('nl-NL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
            </span>
            {task.duration_ms != null && (
              <span className="text-[11px] text-white/38 flex-shrink-0">{task.duration_ms}ms</span>
            )}
            {task.oc_agents?.company && (
              <span className="px-2 py-0.5 bg-white/5 rounded text-[10px] text-white/45 flex-shrink-0">{task.oc_agents.company}</span>
            )}
          </div>

          {expanded === task.id && (
            <div className="px-4 pb-3 border-t border-white/5 bg-[#07070f] space-y-3">
              <div className="pt-3 space-y-2">
                {task.payload && Object.keys(task.payload).length > 0 && (
                  <div>
                    <p className="text-[10px] text-white/45 mb-1 uppercase tracking-wider">Payload</p>
                    <pre className="text-[10px] text-white/65 font-mono bg-white/[0.02] border border-white/5 rounded px-3 py-2 overflow-x-auto">
                      {JSON.stringify(task.payload, null, 2)}
                    </pre>
                  </div>
                )}
                {task.result && (
                  <div>
                    <p className="text-[10px] text-white/45 mb-1 uppercase tracking-wider">Resultaat</p>
                    <pre className="text-[10px] text-green-400/60 font-mono bg-green-500/5 border border-green-500/10 rounded px-3 py-2 overflow-x-auto">
                      {JSON.stringify(task.result, null, 2)}
                    </pre>
                  </div>
                )}
                {task.error && (
                  <div className="bg-red-500/10 border border-red-500/20 rounded px-3 py-2 text-[11px] text-red-400">
                    ✗ {task.error}
                  </div>
                )}
                {task.started_at && (
                  <p className="text-[10px] text-white/38 font-mono">
                    Gestart: {new Date(task.started_at).toLocaleString('nl-NL')}
                    {task.finished_at && ` · Klaar: ${new Date(task.finished_at).toLocaleString('nl-NL')}`}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 pt-1">
                {(task.status === 'queued' || task.status === 'running') && (
                  <button
                    onClick={() => cancelTask(task.id)}
                    className="text-[11px] text-red-400/70 hover:text-red-400 transition-colors"
                  >
                    Annuleer
                  </button>
                )}
                {task.status === 'failed' && (
                  <button
                    onClick={() => retryTask(task.id)}
                    className="text-[11px] text-indigo-400/70 hover:text-indigo-400 transition-colors"
                  >
                    Opnieuw proberen
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
