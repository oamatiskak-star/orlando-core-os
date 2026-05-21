'use client'

import { useState } from 'react'
import { Loader, AlertCircle, Activity } from 'lucide-react'
import { useRealtimeWorkers } from '@/lib/organization/realtime-hooks'

interface Worker {
  id: string
  worker_name: string
  worker_type: string
  host: string
  port: number | null
  status: string
  current_task_id: string | null
  queue_length: number
  last_heartbeat: string | null
  heartbeat_age_seconds: number | null
}

export default function WorkerMonitorRealtime() {
  const { workers, loading, error } = useRealtimeWorkers()
  const [selectedWorker, setSelectedWorker] = useState<Worker | null>(null)
  const [filterType, setFilterType] = useState<string>('')

  const getHealthStatus = (age: number | null): { color: string; label: string; dot: string } => {
    if (!age) return { color: 'bg-white/10 text-white/70', label: 'Unknown', dot: 'bg-white/50' }
    if (age < 30) return { color: 'bg-emerald-500/20 text-emerald-400', label: 'Healthy', dot: 'bg-emerald-400 animate-pulse' }
    if (age < 90) return { color: 'bg-orange-500/20 text-orange-400', label: 'Slow', dot: 'bg-orange-400 animate-pulse' }
    return { color: 'bg-red-500/20 text-red-400', label: 'Offline', dot: 'bg-red-400' }
  }

  const filteredWorkers = filterType
    ? workers.filter(w => w.worker_type === filterType)
    : workers

  const workerTypes = [...new Set(workers.map(w => w.worker_type))]
  const onlineCount = workers.filter(w => w.heartbeat_age_seconds === null || w.heartbeat_age_seconds < 90).length

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-60">
        <Loader size={20} className="text-white/50 animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex gap-3 items-start">
        <AlertCircle size={16} className="text-red-400 mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-xs font-medium text-red-400">Error loading workers</p>
          <p className="text-xs text-white/50 mt-1">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <div className="bg-white/[0.06] border border-white/5 rounded-lg p-2">
          <p className="text-xs text-white/50">Total</p>
          <p className="text-lg font-bold text-white">{workers.length}</p>
        </div>
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-2">
          <p className="text-xs text-emerald-400">Online</p>
          <p className="text-lg font-bold text-emerald-400">{onlineCount}</p>
        </div>
        <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-2">
          <p className="text-xs text-orange-400">Slow</p>
          <p className="text-lg font-bold text-orange-400">
            {workers.filter(w => w.heartbeat_age_seconds && w.heartbeat_age_seconds >= 30 && w.heartbeat_age_seconds < 90).length}
          </p>
        </div>
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-2">
          <p className="text-xs text-red-400">Offline</p>
          <p className="text-lg font-bold text-red-400">
            {workers.filter(w => w.heartbeat_age_seconds && w.heartbeat_age_seconds >= 90).length}
          </p>
        </div>
      </div>

      {/* Filter */}
      <select
        value={filterType}
        onChange={e => setFilterType(e.target.value)}
        className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-white"
      >
        <option value="">All Worker Types</option>
        {workerTypes.map(type => (
          <option key={type} value={type}>
            {type}
          </option>
        ))}
      </select>

      {/* Workers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {filteredWorkers.length === 0 ? (
          <div className="col-span-full flex items-center justify-center min-h-40">
            <p className="text-xs text-white/40">No workers found</p>
          </div>
        ) : (
          filteredWorkers.map(worker => {
            const health = getHealthStatus(worker.heartbeat_age_seconds)
            return (
              <div
                key={worker.id}
                onClick={() => setSelectedWorker(worker)}
                className={`border rounded-lg p-3 hover:border-white/20 cursor-pointer transition ${health.color.split(' ')[0].replace('bg-', 'border-')}/20`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${health.dot}`} />
                    <h4 className="text-sm font-medium text-white">{worker.worker_name}</h4>
                  </div>
                  <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium ${health.color}`}>
                    {health.label}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[10px]">
                  <div>
                    <p className="text-white/50">Type</p>
                    <p className="text-white/70 font-medium">{worker.worker_type}</p>
                  </div>
                  <div>
                    <p className="text-white/50">Status</p>
                    <p className="text-white/70 font-medium capitalize">{worker.status}</p>
                  </div>
                  <div>
                    <p className="text-white/50">Queue</p>
                    <p className="text-white/70 font-medium">{worker.queue_length}</p>
                  </div>
                  <div>
                    <p className="text-white/50">Tasks</p>
                    <p className="text-white/70 font-medium">{worker.current_task_id ? '1 active' : 'Idle'}</p>
                  </div>
                </div>
                <div className="mt-2 pt-2 border-t border-white/5">
                  <p className="text-[9px] text-white/40">
                    {worker.heartbeat_age_seconds !== null
                      ? `Heartbeat: ${worker.heartbeat_age_seconds}s ago`
                      : 'No heartbeat yet'}
                  </p>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Worker Detail */}
      {selectedWorker && (
        <div className="bg-white/[0.06] border border-white/5 rounded-xl p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <Activity size={16} className="text-cyan-400" />
              <h3 className="text-sm font-semibold text-white">{selectedWorker.worker_name}</h3>
            </div>
            <button
              onClick={() => setSelectedWorker(null)}
              className="text-white/50 hover:text-white/70"
            >
              ✕
            </button>
          </div>
          <div className="grid grid-cols-2 gap-4 text-xs mb-3">
            <div>
              <p className="text-white/50">Worker Type</p>
              <p className="text-white font-medium">{selectedWorker.worker_type}</p>
            </div>
            <div>
              <p className="text-white/50">Status</p>
              <p className="text-white font-medium capitalize">{selectedWorker.status}</p>
            </div>
            <div>
              <p className="text-white/50">Host</p>
              <p className="text-white font-mono text-[10px]">{selectedWorker.host}</p>
            </div>
            {selectedWorker.port && (
              <div>
                <p className="text-white/50">Port</p>
                <p className="text-white font-mono text-[10px]">{selectedWorker.port}</p>
              </div>
            )}
            <div>
              <p className="text-white/50">Queue Length</p>
              <p className="text-white font-medium text-indigo-400">{selectedWorker.queue_length}</p>
            </div>
            <div>
              <p className="text-white/50">Current Task</p>
              <p className="text-white font-mono text-[10px]">
                {selectedWorker.current_task_id ? selectedWorker.current_task_id.substring(0, 8) + '...' : 'None'}
              </p>
            </div>
            <div className="col-span-2">
              <p className="text-white/50">Heartbeat Age</p>
              <p className="text-white font-medium">
                {selectedWorker.heartbeat_age_seconds !== null
                  ? `${selectedWorker.heartbeat_age_seconds} seconds ago`
                  : 'Never'}
              </p>
            </div>
            {selectedWorker.last_heartbeat && (
              <div className="col-span-2">
                <p className="text-white/50">Last Heartbeat</p>
                <p className="text-white/70 font-mono text-[10px]">
                  {new Date(selectedWorker.last_heartbeat).toLocaleString()}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
