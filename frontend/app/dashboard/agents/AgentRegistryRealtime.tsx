'use client'

import { useState } from 'react'
import { Loader, AlertCircle, RefreshCw } from 'lucide-react'
import { useRealtimeAgents } from '@/lib/organization/realtime-hooks'

interface Agent {
  id: string
  name: string
  agent_type: string
  role: string
  system: string
  status: string
  active_tasks_count: number
  completed_tasks_count: number
  failed_tasks_count: number
  last_activity_at: string
  capabilities: string[]
}

export default function AgentRegistryRealtime() {
  const { agents, loading, error } = useRealtimeAgents()
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('')
  const [filterSystem, setFilterSystem] = useState<string>('')

  const filteredAgents = agents.filter(agent => {
    const matchesSearch =
      agent.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      agent.role.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = !filterStatus || agent.status === filterStatus
    const matchesSystem = !filterSystem || agent.system === filterSystem

    return matchesSearch && matchesStatus && matchesSystem
  })

  // Get unique systems for filter
  const systems = [...new Set(agents.map(a => a.system))]
  const statuses = [...new Set(agents.map(a => a.status))]

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
            <p className="text-xs font-medium text-red-400">Error loading agents</p>
            <p className="text-xs text-white/50 mt-1">{error}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Search and Filters */}
      <div className="space-y-2">
        <input
          type="text"
          placeholder="Search agents..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder:text-white/30"
        />
        <div className="flex gap-2 flex-wrap">
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-white"
          >
            <option value="">All Statuses</option>
            {statuses.map(status => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>

          <select
            value={filterSystem}
            onChange={e => setFilterSystem(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-white"
          >
            <option value="">All Systems</option>
            {systems.map(system => (
              <option key={system} value={system}>
                {system}
              </option>
            ))}
          </select>

          <span className="text-xs text-white/50 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            {filteredAgents.length} agents
          </span>
        </div>
      </div>

      {/* Agents Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-white/10">
              <th className="text-left py-2 px-3 font-medium text-white/70">Name</th>
              <th className="text-left py-2 px-3 font-medium text-white/70">Type</th>
              <th className="text-left py-2 px-3 font-medium text-white/70">Role</th>
              <th className="text-left py-2 px-3 font-medium text-white/70">System</th>
              <th className="text-left py-2 px-3 font-medium text-white/70">Status</th>
              <th className="text-center py-2 px-3 font-medium text-white/70">Active</th>
              <th className="text-center py-2 px-3 font-medium text-white/70">Done</th>
              <th className="text-center py-2 px-3 font-medium text-white/70">Failed</th>
            </tr>
          </thead>
          <tbody>
            {filteredAgents.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-4 px-3 text-center text-white/40">
                  No agents found
                </td>
              </tr>
            ) : (
              filteredAgents.map(agent => (
                <tr
                  key={agent.id}
                  onClick={() => setSelectedAgent(agent)}
                  className="border-b border-white/5 hover:bg-white/[0.03] cursor-pointer transition"
                >
                  <td className="py-3 px-3 text-white font-medium">{agent.name}</td>
                  <td className="py-3 px-3 text-white/70 capitalize">{agent.agent_type}</td>
                  <td className="py-3 px-3 text-white/70 text-[10px]">{agent.role}</td>
                  <td className="py-3 px-3 text-white/70 text-[10px]">{agent.system}</td>
                  <td className="py-3 px-3">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium ${
                        agent.status === 'active'
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : agent.status === 'paused'
                            ? 'bg-orange-500/20 text-orange-400'
                            : agent.status === 'failed'
                              ? 'bg-red-500/20 text-red-400'
                              : 'bg-white/10 text-white/70'
                      }`}
                    >
                      {agent.status}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-center text-white/70">{agent.active_tasks_count}</td>
                  <td className="py-3 px-3 text-center text-emerald-400">{agent.completed_tasks_count}</td>
                  <td className="py-3 px-3 text-center text-red-400">{agent.failed_tasks_count}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Agent Detail Panel */}
      {selectedAgent && (
        <div className="bg-white/[0.06] border border-white/5 rounded-xl p-4">
          <div className="flex items-start justify-between mb-3">
            <h3 className="text-sm font-semibold text-white">{selectedAgent.name}</h3>
            <button
              onClick={() => setSelectedAgent(null)}
              className="text-white/50 hover:text-white/70"
            >
              ✕
            </button>
          </div>
          <div className="grid grid-cols-2 gap-4 text-xs mb-3">
            <div>
              <p className="text-white/50">Role</p>
              <p className="text-white font-medium">{selectedAgent.role}</p>
            </div>
            <div>
              <p className="text-white/50">System</p>
              <p className="text-white font-medium">{selectedAgent.system}</p>
            </div>
            <div>
              <p className="text-white/50">Status</p>
              <p className="text-white font-medium capitalize">{selectedAgent.status}</p>
            </div>
            <div>
              <p className="text-white/50">Type</p>
              <p className="text-white font-medium capitalize">{selectedAgent.agent_type}</p>
            </div>
            <div>
              <p className="text-white/50">Active Tasks</p>
              <p className="text-white font-medium">{selectedAgent.active_tasks_count}</p>
            </div>
            <div>
              <p className="text-white/50">Completed</p>
              <p className="text-emerald-400 font-medium">{selectedAgent.completed_tasks_count}</p>
            </div>
            <div>
              <p className="text-white/50">Failed</p>
              <p className="text-red-400 font-medium">{selectedAgent.failed_tasks_count}</p>
            </div>
            <div>
              <p className="text-white/50">Last Activity</p>
              <p className="text-white/70 font-mono text-[10px]">
                {selectedAgent.last_activity_at
                  ? new Date(selectedAgent.last_activity_at).toLocaleString()
                  : 'Never'}
              </p>
            </div>
          </div>
          {selectedAgent.capabilities.length > 0 && (
            <div>
              <p className="text-white/50 text-xs mb-2">Capabilities</p>
              <div className="flex flex-wrap gap-1">
                {selectedAgent.capabilities.map(cap => (
                  <span key={cap} className="bg-indigo-500/20 text-indigo-400 px-2 py-1 rounded text-[10px]">
                    {cap}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
