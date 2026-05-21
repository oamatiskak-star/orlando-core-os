'use client'

import { useEffect, useState } from 'react'
import { Loader, AlertCircle, ExternalLink } from 'lucide-react'

interface Task {
  id: string
  title: string
  description: string | null
  priority: string
  system: string
  assigned_agent_id: string | null
  assigned_worker_id: string | null
  status: string
  source: string
  source_task_id: string | null
  created_at: string
  started_at: string | null
  finished_at: string | null
  error: string | null
  output_url: string | null
}

export default function TaskCommandCenter() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [sourceFilter, setSourceFilter] = useState<string>('')
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)

  useEffect(() => {
    const fetchTasks = async () => {
      try {
        setLoading(true)
        const params = new URLSearchParams()
        if (statusFilter) params.append('status', statusFilter)
        if (sourceFilter) params.append('source', sourceFilter)
        params.append('limit', '50')

        const response = await fetch(`/api/organization/tasks?${params}`)
        if (!response.ok) throw new Error('Failed to fetch tasks')
        const data = await response.json()
        setTasks(data.tasks || [])
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error loading tasks')
      } finally {
        setLoading(false)
      }
    }

    fetchTasks()
  }, [statusFilter, sourceFilter])

  const statusColors: Record<string, string> = {
    new: 'bg-slate-500/20 text-slate-400',
    queued: 'bg-blue-500/20 text-blue-400',
    assigned: 'bg-cyan-500/20 text-cyan-400',
    running: 'bg-indigo-500/20 text-indigo-400',
    waiting_for_input: 'bg-orange-500/20 text-orange-400',
    blocked: 'bg-yellow-500/20 text-yellow-400',
    completed: 'bg-emerald-500/20 text-emerald-400',
    failed: 'bg-red-500/20 text-red-400',
    cancelled: 'bg-white/10 text-white/70',
  }

  const priorityColors: Record<string, string> = {
    critical: 'bg-red-500/20 text-red-400',
    high: 'bg-orange-500/20 text-orange-400',
    normal: 'bg-slate-500/20 text-slate-400',
    low: 'bg-blue-500/20 text-blue-400',
    backlog: 'bg-white/10 text-white/70',
  }

  if (loading) {
    return (
      <div className="bg-white/[0.06] border border-white/5 rounded-xl p-5 flex items-center justify-center min-h-60">
        <Loader size={20} className="text-white/50 animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white/[0.06] border border-white/5 rounded-xl p-5">
        <div className="flex gap-3 items-start">
          <AlertCircle size={16} className="text-red-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-xs font-medium text-red-400">Error loading tasks</p>
            <p className="text-xs text-white/50 mt-1">{error}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-white"
        >
          <option value="">All Statuses</option>
          <option value="new">New</option>
          <option value="queued">Queued</option>
          <option value="running">Running</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
        </select>

        <select
          value={sourceFilter}
          onChange={e => setSourceFilter(e.target.value)}
          className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-white"
        >
          <option value="">All Sources</option>
          <option value="clickup">ClickUp</option>
          <option value="supabase">Supabase</option>
          <option value="manual">Manual</option>
          <option value="llama_cpp">llama.cpp</option>
        </select>
      </div>

      {/* Tasks List */}
      <div className="space-y-2">
        {tasks.length === 0 ? (
          <div className="bg-white/[0.06] border border-white/5 rounded-xl p-5 flex items-center justify-center min-h-40">
            <p className="text-xs text-white/40">No tasks found</p>
          </div>
        ) : (
          tasks.map(task => (
            <div
              key={task.id}
              onClick={() => setSelectedTask(task)}
              className="bg-white/[0.06] border border-white/5 rounded-lg p-3 hover:bg-white/[0.08] hover:border-white/10 cursor-pointer transition"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{task.title || 'Untitled'}</p>
                  <div className="flex gap-1 mt-2 flex-wrap">
                    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium ${statusColors[task.status] || statusColors.new}`}>
                      {task.status}
                    </span>
                    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium ${priorityColors[task.priority] || priorityColors.normal}`}>
                      {task.priority}
                    </span>
                    <span className="inline-block px-2 py-0.5 rounded text-[10px] font-medium bg-white/10 text-white/70">
                      {task.source}
                    </span>
                  </div>
                </div>
                {task.output_url && (
                  <a
                    href={task.output_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-400 hover:text-indigo-300 p-1"
                    onClick={e => e.stopPropagation()}
                  >
                    <ExternalLink size={14} />
                  </a>
                )}
              </div>
              {task.error && <p className="text-[10px] text-red-400 mt-2">Error: {task.error}</p>}
            </div>
          ))
        )}
      </div>

      {/* Task Detail */}
      {selectedTask && (
        <div className="bg-white/[0.06] border border-white/5 rounded-xl p-4">
          <div className="flex items-start justify-between mb-3">
            <h3 className="text-sm font-semibold text-white">{selectedTask.title}</h3>
            <button
              onClick={() => setSelectedTask(null)}
              className="text-white/50 hover:text-white/70"
            >
              ✕
            </button>
          </div>
          {selectedTask.description && (
            <p className="text-xs text-white/70 mb-3">{selectedTask.description}</p>
          )}
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <p className="text-white/50">System</p>
              <p className="text-white font-medium">{selectedTask.system}</p>
            </div>
            <div>
              <p className="text-white/50">Source</p>
              <p className="text-white font-medium">{selectedTask.source}</p>
            </div>
            <div>
              <p className="text-white/50">Created</p>
              <p className="text-white/70 font-mono text-[10px]">
                {new Date(selectedTask.created_at).toLocaleString()}
              </p>
            </div>
            {selectedTask.started_at && (
              <div>
                <p className="text-white/50">Started</p>
                <p className="text-white/70 font-mono text-[10px]">
                  {new Date(selectedTask.started_at).toLocaleString()}
                </p>
              </div>
            )}
          </div>
          {selectedTask.error && (
            <div className="mt-3 p-2 bg-red-500/10 border border-red-500/20 rounded">
              <p className="text-[10px] text-red-400 break-words">{selectedTask.error}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
