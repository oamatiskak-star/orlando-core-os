'use client'

import { useEffect, useState } from 'react'
import { Loader, AlertCircle } from 'lucide-react'

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

export default function WorkerMonitor() {
  const [workers, setWorkers] = useState<Worker[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedWorker, setSelectedWorker] = useState<Worker | null>(null)

  useEffect(() => {
    const fetchWorkers = async () => {
      try {
        setLoading(true)
        const response = await fetch('/api/organization/workers?limit=50')
        if (!response.ok) throw new Error('Failed to fetch workers')
        const data = await response.json()
        setWorkers(data.workers || [])
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error loading workers')
      } finally {
        setLoading(false)
      }
    }

    fetchWorkers()

    // Refresh every 30 seconds
    const interval = setInterval(fetchWorkers, 30000)
    return () => clearInterval(interval)
  }, [])

  const getHealthStatus = (age: number | null): { color: string; label: string } => {
    if (!age) return { color: 'bg-white/10 text-white/70', label: 'Unknown' }
    if (age < 30) return { color: 'bg-emerald-500/20 text-emerald-400', label: 'Healthy' }
    if (age < 90) return { color: 'bg-orange-500/20 text-orange-400', label: 'Slow' }
    return { color: 'bg-red-500/20 text-red-400', label: 'Offline' }
  }

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

  if (workers.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-60">
        <p className="text-xs text-white/40">No workers registered</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {workers.map(worker => {
          const health = getHealthStatus(worker.heartbeat_age_seconds)
          return (
            <div
              key={worker.id}
              onClick={() => setSelectedWorker(worker)}
              className="bg-white/[0.06] border border-white/5 rounded-lg p-3 hover:bg-white/[0.08] hover:border-white/10 cursor-pointer transition"
            >
              <div className="flex items-start justify-between mb-2">
                <h4 className="text-sm font-medium text-white">{worker.worker_name}</h4>
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
                  <p className="text-white/50">Host</p>
                  <p className="text-white/70 font-mono text-[9px]">{worker.host}</p>
                </div>
                <div>
                  <p className="text-white/50">Queue</p>
                  <p className="text-white/70 font-medium">{worker.queue_length}</p>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {selectedWorker && (
        <div className="bg-white/[0.06] border border-white/5 rounded-xl p-4">
          <div className="flex items-start justify-between mb-3">
            <h3 className="text-sm font-semibold text-white">{selectedWorker.worker_name}</h3>
            <button
              onClick={() => setSelectedWorker(null)}
              className="text-white/50 hover:text-white/70"
            >
              ✕
            </button>
          </div>
          <div className="grid grid-cols-2 gap-4 text-xs">
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
              <p className="text-white font-medium">{selectedWorker.queue_length}</p>
            </div>
            <div>
              <p className="text-white/50">Last Heartbeat</p>
              <p className="text-white/70 font-mono text-[10px]">
                {selectedWorker.heartbeat_age_seconds !== null
                  ? `${selectedWorker.heartbeat_age_seconds}s ago`
                  : 'Never'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
