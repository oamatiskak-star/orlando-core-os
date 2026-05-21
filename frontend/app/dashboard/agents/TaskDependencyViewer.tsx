'use client'

import { useEffect, useState } from 'react'
import { Loader, AlertCircle, Network } from 'lucide-react'

interface Dependency {
  parent_id: string
  parent_title: string
  child_id: string
  child_title: string
  dependency_type: string
}

interface TaskDependencyGraph {
  task_id: string
  title: string
  status: string
  dependencies: Dependency[]
}

export default function TaskDependencyViewer() {
  const [taskId, setTaskId] = useState<string>('')
  const [graph, setGraph] = useState<TaskDependencyGraph | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSearch = async (id: string) => {
    if (!id) return

    try {
      setLoading(true)
      setError(null)

      // Get task details
      const response = await fetch(`/api/organization/tasks/${id}`)
      if (!response.ok) throw new Error('Task not found')

      const data = await response.json()
      const task = data.task?.task

      if (!task) throw new Error('Invalid task data')

      // For now, create a simple view
      // In future, would fetch actual dependency data from organization_task_dependencies
      setGraph({
        task_id: id,
        title: task.title,
        status: task.status,
        dependencies: [],
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading task')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white/[0.06] border border-white/5 rounded-xl p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Network size={16} className="text-cyan-400" />
        <h2 className="text-sm font-semibold text-white">Task Dependency Graph</h2>
      </div>

      {/* Search */}
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Enter task ID to view dependencies..."
          value={taskId}
          onChange={e => setTaskId(e.target.value)}
          onKeyPress={e => e.key === 'Enter' && handleSearch(taskId)}
          className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder:text-white/30"
        />
        <button
          onClick={() => handleSearch(taskId)}
          disabled={!taskId || loading}
          className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-medium px-4 py-2 rounded-lg transition"
        >
          {loading ? <Loader size={14} className="animate-spin" /> : 'Search'}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="flex gap-3 items-start bg-red-500/10 border border-red-500/20 rounded-lg p-3">
          <AlertCircle size={14} className="text-red-400 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}

      {/* Task Graph */}
      {graph && (
        <div className="space-y-3">
          {/* Task Node */}
          <div className="bg-indigo-500/20 border border-indigo-500/50 rounded-lg p-3">
            <p className="text-xs font-medium text-indigo-400">Root Task</p>
            <p className="text-sm font-semibold text-white mt-1">{graph.title}</p>
            <div className="flex gap-2 mt-2">
              <span className="inline-block px-2 py-0.5 rounded text-[10px] font-medium bg-indigo-600/30 text-indigo-300">
                {graph.status}
              </span>
              <span className="inline-block px-2 py-0.5 rounded text-[10px] font-medium bg-white/10 text-white/70">
                {graph.task_id}
              </span>
            </div>
          </div>

          {/* Dependencies */}
          {graph.dependencies.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-center">
              <div>
                <p className="text-sm text-white/50 mb-1">No dependencies</p>
                <p className="text-xs text-white/30">This task has no linked tasks</p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {graph.dependencies.map((dep, idx) => (
                <div
                  key={idx}
                  className="relative pl-6 py-2 border-l-2 border-white/10 hover:border-white/20 transition"
                >
                  <div className="absolute left-[-5px] top-4 w-2 h-2 bg-white/30 rounded-full" />

                  <p className="text-[10px] text-white/50 mb-1">
                    {dep.dependency_type === 'blocks'
                      ? 'Blocks'
                      : dep.dependency_type === 'depends_on'
                        ? 'Depends on'
                        : 'Related to'}
                  </p>
                  <p className="text-sm font-medium text-white">{dep.child_title}</p>
                  <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-medium bg-white/10 text-white/70">
                    {dep.child_id}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Info */}
          <p className="text-[10px] text-white/40 mt-3">
            Dependency visualization. In production, this would show a full task graph with multiple levels.
          </p>
        </div>
      )}

      {/* Empty State */}
      {!graph && !error && (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Network size={24} className="text-white/20 mb-2" />
          <p className="text-sm text-white/50">Enter a task ID to visualize its dependencies</p>
        </div>
      )}
    </div>
  )
}
