'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import clsx from 'clsx'

type Run = {
  id: string
  workflow_id: string
  status: string
  triggered_by: string
  started_at: string
  finished_at: string | null
  duration_ms: number | null
  error: string | null
  logs: Array<{ ts: string; level: string; msg: string }>
  oc_workflows: { naam: string } | null
}

const STATUS_COLORS: Record<string, string> = {
  success: 'bg-green-500/10 text-green-400',
  failed: 'bg-red-500/10 text-red-400',
  running: 'bg-indigo-500/10 text-indigo-400',
  pending: 'bg-white/5 text-white/50',
}

export default function RunHistory() {
  const [runs, setRuns] = useState<Run[]>([])
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()

    async function fetchRuns() {
      const { data } = await supabase
        .from('oc_workflow_runs')
        .select('*, oc_workflows(naam)')
        .order('started_at', { ascending: false })
        .limit(20)
      setRuns((data as Run[]) ?? [])
    }

    fetchRuns()

    // Realtime updates
    const channel = supabase
      .channel('workflow_runs')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'oc_workflow_runs' }, () => {
        fetchRuns()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  if (runs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 gap-2">
        <p className="text-xs text-white/45">Nog geen runs uitgevoerd</p>
        <p className="text-[11px] text-white/50">Trigger een workflow om de run history te zien</p>
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      {runs.map(run => (
        <div key={run.id} className="border border-white/5 rounded-lg overflow-hidden">
          <div
            className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.02] cursor-pointer transition-colors"
            onClick={() => setExpanded(expanded === run.id ? null : run.id)}
          >
            <span className={clsx('px-2 py-0.5 rounded-full text-[10px] font-medium flex-shrink-0', STATUS_COLORS[run.status] ?? 'bg-white/5 text-white/50')}>
              {run.status}
            </span>
            <span className="text-xs text-white/70 flex-1 truncate">
              {run.oc_workflows?.naam ?? 'Onbekend'}
            </span>
            <span className="text-[11px] text-white/45 flex-shrink-0">
              {new Date(run.started_at).toLocaleString('nl-NL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
            </span>
            {run.duration_ms && (
              <span className="text-[11px] text-white/38 flex-shrink-0">{run.duration_ms}ms</span>
            )}
            <span className="px-2 py-0.5 bg-white/5 rounded text-[10px] text-white/45 flex-shrink-0">{run.triggered_by}</span>
          </div>
          {expanded === run.id && (
            <div className="px-4 pb-3 border-t border-white/5 bg-[#07070f]">
              <div className="pt-3 space-y-1 font-mono">
                {run.logs?.map((log, i) => (
                  <div key={i} className="flex items-start gap-3 text-[11px]">
                    <span className="text-white/38 flex-shrink-0">
                      {new Date(log.ts).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                    <span className={clsx('flex-shrink-0',
                      log.level === 'success' ? 'text-green-400' :
                      log.level === 'error' ? 'text-red-400' : 'text-white/65'
                    )}>
                      [{log.level}]
                    </span>
                    <span className="text-white/60">{log.msg}</span>
                  </div>
                )) ?? <span className="text-white/38">Geen logs</span>}
                {run.error && (
                  <div className="mt-2 bg-red-500/10 border border-red-500/20 rounded px-3 py-2 text-[11px] text-red-400">
                    ✗ {run.error}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
