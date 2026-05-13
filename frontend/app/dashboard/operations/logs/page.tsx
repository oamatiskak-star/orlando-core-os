'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Terminal, RefreshCw, Search } from 'lucide-react'

type LogEntry = {
  id: string
  run_id: string
  workflow_id: string | null
  step_index: number | null
  step_type: string | null
  step_label: string | null
  level: string
  message: string
  data: Record<string, unknown> | null
  duration_ms: number | null
  created_at: string
}

const LEVEL_COLORS: Record<string, string> = {
  info: 'text-sky-400 bg-sky-500/10',
  success: 'text-green-400 bg-green-500/10',
  warning: 'text-amber-400 bg-amber-500/10',
  error: 'text-red-400 bg-red-500/10',
  debug: 'text-white/38 bg-white/5',
}

export default function LogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [levelFilter, setLevelFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [autoRefresh, setAutoRefresh] = useState(false)

  const supabase = createClient()

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    let query = supabase
      .from('oc_workflow_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200)

    if (levelFilter !== 'all') query = query.eq('level', levelFilter)
    if (search) query = query.ilike('message', `%${search}%`)

    const { data } = await query
    if (data) setLogs(data)
    setLoading(false)
  }, [supabase, levelFilter, search])

  useEffect(() => { fetchLogs() }, [fetchLogs])

  useEffect(() => {
    if (!autoRefresh) return
    const interval = setInterval(fetchLogs, 3000)
    return () => clearInterval(interval)
  }, [autoRefresh, fetchLogs])

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-slate-500/10 border border-slate-500/20 flex items-center justify-center">
          <Terminal size={16} className="text-slate-400" />
        </div>
        <div>
          <h1 className="text-base font-semibold text-white">Logs</h1>
          <p className="text-xs text-white/50">Workflow run logs — debug, info, warning, error per stap</p>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1">
          {['all', 'info', 'success', 'warning', 'error', 'debug'].map(l => (
            <button key={l} onClick={() => setLevelFilter(l)}
              className={`px-2.5 py-1 rounded-md text-[11px] transition-colors ${levelFilter === l ? 'bg-indigo-500/20 text-indigo-400' : 'text-white/45 hover:text-white/70'}`}>
              {l === 'all' ? 'Alle' : l}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 flex-1 max-w-xs">
          <Search size={12} className="text-white/38 flex-shrink-0" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Zoek in logs..."
            className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-white placeholder-white/20 outline-none focus:border-indigo-500/60 transition-colors" />
        </div>

        <div className="ml-auto flex items-center gap-2">
          <label className="flex items-center gap-2 text-xs text-white/50 cursor-pointer">
            <input type="checkbox" checked={autoRefresh} onChange={e => setAutoRefresh(e.target.checked)} className="accent-indigo-500" />
            Live
          </label>
          <button onClick={fetchLogs} disabled={loading}
            className="w-7 h-7 rounded-lg border border-white/10 flex items-center justify-center text-white/65 hover:text-indigo-400 transition-colors disabled:opacity-50">
            <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      <div className="bg-[#0e0e1a] border border-white/5 rounded-xl overflow-hidden font-mono text-xs">
        <div className="flex items-center justify-between px-4 py-2 border-b border-white/5">
          <span className="text-[10px] text-white/30">{logs.length} log entries</span>
          {autoRefresh && <span className="flex items-center gap-1 text-[10px] text-indigo-400"><span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />Live</span>}
        </div>
        <div className="max-h-[60vh] overflow-y-auto">
          {loading && logs.length === 0 && (
            <div className="flex items-center justify-center py-16 text-white/30 text-xs">Laden...</div>
          )}
          {!loading && logs.length === 0 && (
            <div className="flex items-center justify-center py-16 text-white/30 text-xs">Geen logs gevonden</div>
          )}
          {logs.map(log => (
            <div key={log.id} className="flex items-start gap-3 px-4 py-2 border-b border-white/[0.02] hover:bg-white/[0.02] transition-colors">
              <span className="text-white/25 text-[10px] w-28 flex-shrink-0 mt-0.5">
                {new Date(log.created_at).toLocaleString('nl-NL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
              <span className={`px-1.5 py-0.5 rounded text-[10px] flex-shrink-0 ${LEVEL_COLORS[log.level] ?? 'text-white/50 bg-white/5'}`}>
                {log.level.toUpperCase()}
              </span>
              {log.step_label && (
                <span className="text-white/30 text-[10px] flex-shrink-0">[{log.step_label}]</span>
              )}
              <span className="text-white/70 flex-1 min-w-0 break-words">{log.message}</span>
              {log.duration_ms != null && (
                <span className="text-white/25 text-[10px] flex-shrink-0">{log.duration_ms}ms</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
