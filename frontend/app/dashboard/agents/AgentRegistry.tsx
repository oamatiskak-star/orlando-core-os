'use client'

import { useEffect, useState } from 'react'
import { Loader, AlertCircle } from 'lucide-react'

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

export default function AgentRegistry() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null)

  useEffect(() => {
    const fetchAgents = async () => {
      try {
        setLoading(true)
        const response = await fetch('/api/organization/agents?limit=50')
        if (!response.ok) throw new Error('Failed to fetch agents')
        const data = await response.json()
        setAgents(data.agents || [])
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error loading agents')
      } finally {
        setLoading(false)
      }
    }

    fetchAgents()
  }, [])

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

  if (agents.length === 0) {
    return (
      <div className="bg-white/[0.06] border border-white/5 rounded-xl p-5 flex items-center justify-center min-h-60">
        <p className="text-xs text-white/40">No agents found</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-white/10">
              <th className="text-left py-2 px-3 font-medium text-white/70">Name</th>
              <th className="text-left py-2 px-3 font-medium text-white/70">Type</th>
              <th className="text-left py-2 px-3 font-medium text-white/70">Role</th>
              <th className="text-left py-2 px-3 font-medium text-white/70">System</th>
              <th className="text-left py-2 px-3 font-medium text-white/70">Status</th>
              <th className="text-center py-2 px-3 font-medium text-white/70">Tasks</th>
            </tr>
          </thead>
          <tbody>
            {agents.map(agent => (
              <tr
                key={agent.id}
                onClick={() => setSelectedAgent(agent)}
                className="border-b border-white/5 hover:bg-white/[0.03] cursor-pointer transition"
              >
                <td className="py-3 px-3 text-white font-medium">{agent.name}</td>
                <td className="py-3 px-3 text-white/70 capitalize">{agent.agent_type}</td>
                <td className="py-3 px-3 text-white/70">{agent.role}</td>
                <td className="py-3 px-3 text-white/70">{agent.system}</td>
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
                <td className="py-3 px-3 text-center">
                  <span className="text-white/70">{agent.active_tasks_count + agent.completed_tasks_count}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedAgent && (
        <div className="bg-white/[0.06] border border-white/5 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-white mb-3">{selectedAgent.name}</h3>
          <div className="grid grid-cols-2 gap-4 text-xs">
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
              <p className="text-white/50">Active Tasks</p>
              <p className="text-white font-medium">{selectedAgent.active_tasks_count}</p>
            </div>
            <div>
              <p className="text-white/50">Completed</p>
              <p className="text-white font-medium text-emerald-400">{selectedAgent.completed_tasks_count}</p>
            </div>
            <div>
              <p className="text-white/50">Failed</p>
              <p className="text-white font-medium text-red-400">{selectedAgent.failed_tasks_count}</p>
            </div>
          </div>
          {selectedAgent.capabilities.length > 0 && (
            <div className="mt-3">
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
