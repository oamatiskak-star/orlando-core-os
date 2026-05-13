'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { RefreshCw, Package, Clock, CheckCircle2, XCircle, AlertCircle } from 'lucide-react'

type QueueJob = {
  id: string
  queue_name: string
  company: string
  job_type: string
  payload: Record<string, unknown>
  status: string
  priority: number
  retry_count: number
  max_retries: number
  error_message: string | null
  worker_id: string | null
  scheduled_at: string | null
  started_at: string | null
  completed_at: string | null
  created_at: string
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'text-amber-400 bg-amber-500/10',
  running: 'text-indigo-400 bg-indigo-500/10',
  completed: 'text-green-400 bg-green-500/10',
  failed: 'text-red-400 bg-red-500/10',
  cancelled: 'text-white/38 bg-white/5',
}

const PRIORITY_LABELS: Record<number, string> = {
  1: 'critical',
  2: 'high',
  3: 'normal',
  4: 'low',
  5: 'background',
}

export default function QueueMonitor({ initialJobs }: { initialJobs: QueueJob[] }) {
  const [jobs, setJobs] = useState<QueueJob[]>(initialJobs)
  const [loading, setLoading] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [queueFilter, setQueueFilter] = useState<string>('all')
  const [autoRefresh, setAutoRefresh] = useState(true)

  const supabase = createClient()

  const queues = Array.from(new Set(jobs.map(j => j.queue_name))).sort()

  const filtered = jobs.filter(j => {
    if (statusFilter !== 'all' && j.status !== statusFilter) return false
    if (queueFilter !== 'all' && j.queue_name !== queueFilter) return false
    return true
  })

  const fetchJobs = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('oc_queue_jobs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100)
    if (data) setJobs(data)
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    if (!autoRefresh) return
    const interval = setInterval(fetchJobs, 5000)
    return () => clearInterval(interval)
  }, [autoRefresh, fetchJobs])

  useEffect(() => {
    const channel = supabase
      .channel('queue-jobs')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'oc_queue_jobs' }, () => {
        fetchJobs()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [supabase, fetchJobs])

  async function cancelJob(id: string) {
    await supabase.from('oc_queue_jobs').update({ status: 'cancelled' }).eq('id', id)
    setJobs(prev => prev.map(j => j.id === id ? { ...j, status: 'cancelled' } : j))
  }

  async function retryJob(id: string) {
    await supabase.from('oc_queue_jobs').update({ status: 'pending', retry_count: 0, error_message: null }).eq('id', id)
    setJobs(prev => prev.map(j => j.id === id ? { ...j, status: 'pending', retry_count: 0 } : j))
  }

  const stats = {
    pending: jobs.filter(j => j.status === 'pending').length,
    running: jobs.filter(j => j.status === 'running').length,
    completed: jobs.filter(j => j.status === 'completed').length,
    failed: jobs.filter(j => j.status === 'failed').length,
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Pending', value: stats.pending, color: 'text-amber-400', border: 'border-amber-500/20', icon: Clock },
          { label: 'Running', value: stats.running, color: 'text-indigo-400', border: 'border-indigo-500/20', icon: Package },
          { label: 'Completed', value: stats.completed, color: 'text-green-400', border: 'border-green-500/20', icon: CheckCircle2 },
          { label: 'Failed', value: stats.failed, color: stats.failed > 0 ? 'text-red-400' : 'text-white/38', border: stats.failed > 0 ? 'border-red-500/20' : 'border-white/5', icon: XCircle },
        ].map(s => {
          const Icon = s.icon
          return (
            <div key={s.label} className={`bg-white/[0.06] border ${s.border} rounded-xl p-3`}>
              <Icon size={12} className={`${s.color} mb-1.5`} />
              <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
              <p className="text-[10px] text-white/50">{s.label}</p>
            </div>
          )
        })}
      </div>

      <div className="flex items-center gap-3">
        <div className="flex gap-1">
          {['all', 'pending', 'running', 'completed', 'failed'].map(f => (
            <button key={f} onClick={() => setStatusFilter(f)}
              className={`px-2.5 py-1 rounded-md text-[11px] transition-colors ${statusFilter === f ? 'bg-indigo-500/20 text-indigo-400' : 'text-white/45 hover:text-white/70'}`}>
              {f === 'all' ? 'Alle' : f}
            </button>
          ))}
        </div>

        {queues.length > 0 && (
          <select value={queueFilter} onChange={e => setQueueFilter(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-white outline-none focus:border-indigo-500/60 transition-colors">
            <option value="all">Alle queues</option>
            {queues.map(q => <option key={q} value={q}>{q}</option>)}
          </select>
        )}

        <div className="ml-auto flex items-center gap-2">
          <label className="flex items-center gap-2 text-xs text-white/50 cursor-pointer">
            <input type="checkbox" checked={autoRefresh} onChange={e => setAutoRefresh(e.target.checked)}
              className="accent-indigo-500" />
            Auto-refresh (5s)
          </label>
          <button onClick={fetchJobs} disabled={loading}
            className="w-7 h-7 rounded-lg border border-white/10 flex items-center justify-center text-white/65 hover:text-indigo-400 transition-colors disabled:opacity-50">
            <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      <div className="space-y-1.5">
        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-3 bg-white/[0.02] border border-white/5 rounded-xl">
            <Package size={24} className="text-white/20" />
            <p className="text-sm text-white/50">Geen jobs gevonden</p>
          </div>
        )}
        {filtered.map(job => (
          <div key={job.id} className="flex items-center gap-3 px-4 py-3 bg-white/[0.06] border border-white/5 rounded-xl">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-white font-mono truncate">{job.job_type}</span>
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${STATUS_COLORS[job.status] ?? 'text-white/50 bg-white/5'}`}>
                  {job.status}
                </span>
                <span className="px-1.5 py-0.5 rounded bg-white/5 text-[10px] text-white/38">{job.queue_name}</span>
                {job.priority <= 2 && (
                  <span className="px-1.5 py-0.5 rounded bg-red-500/10 text-[10px] text-red-400">{PRIORITY_LABELS[job.priority] ?? `p${job.priority}`}</span>
                )}
              </div>
              {job.error_message && (
                <p className="text-[10px] text-red-400 mt-0.5 truncate flex items-center gap-1">
                  <AlertCircle size={9} /> {job.error_message}
                </p>
              )}
              <div className="flex items-center gap-3 mt-0.5 text-[10px] text-white/30">
                <span className="font-mono">{job.id.slice(0, 8)}</span>
                <span>{job.company}</span>
                {job.retry_count > 0 && <span className="text-amber-400">retry {job.retry_count}/{job.max_retries}</span>}
                <span>{new Date(job.created_at).toLocaleString('nl-NL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 flex-shrink-0">
              {job.status === 'failed' && (
                <button onClick={() => retryJob(job.id)}
                  className="px-2.5 py-1 rounded-lg border border-white/10 text-[11px] text-white/65 hover:text-indigo-400 hover:border-indigo-500/30 transition-colors">
                  Retry
                </button>
              )}
              {(job.status === 'pending' || job.status === 'running') && (
                <button onClick={() => cancelJob(job.id)}
                  className="px-2.5 py-1 rounded-lg border border-white/10 text-[11px] text-white/65 hover:text-red-400 hover:border-red-500/30 transition-colors">
                  Cancel
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
