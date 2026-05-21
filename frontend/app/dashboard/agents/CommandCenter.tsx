'use client'

import { Users, CheckSquare, Activity, AlertCircle } from 'lucide-react'
import AgentRegistryRealtime from './AgentRegistryRealtime'
import TaskCommandCenterRealtime from './TaskCommandCenterRealtime'
import WorkerMonitorRealtime from './WorkerMonitorRealtime'
import TaskDependencyViewer from './TaskDependencyViewer'
import SystemHealthDashboard from './SystemHealthDashboard'

export default function CommandCenter() {
  return (
    <div className="space-y-6">
      {/* System Health */}
      <SystemHealthDashboard />

      {/* Overview Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Agents"
          value="—"
          icon={Users}
          color="text-cyan-400 bg-cyan-500/10 border-cyan-500/20"
        />
        <StatCard
          label="Workers"
          value="—"
          icon={Activity}
          color="text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
        />
        <StatCard
          label="Open Tasks"
          value="—"
          icon={CheckSquare}
          color="text-indigo-400 bg-indigo-500/10 border-indigo-500/20"
        />
        <StatCard
          label="ClickUp Imported"
          value="—"
          icon={AlertCircle}
          color="text-orange-400 bg-orange-500/10 border-orange-500/20"
        />
      </div>

      {/* Agent Registry Section */}
      <div className="bg-white/[0.06] border border-white/5 rounded-xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-white">Agent Registry</h2>
            <p className="text-xs text-white/50">All agents across systems with status and task counts</p>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            <span className="text-[11px] text-white/50">Live</span>
          </div>
        </div>
        <AgentRegistryRealtime />
      </div>

      {/* Task Command Center Section */}
      <div className="bg-white/[0.06] border border-white/5 rounded-xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-white">Task Command Center</h2>
            <p className="text-xs text-white/50">Unified view of all tasks from all sources</p>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            <span className="text-[11px] text-white/50">Live</span>
          </div>
        </div>
        <TaskCommandCenterRealtime />
      </div>

      {/* Worker Monitor Section */}
      <div className="bg-white/[0.06] border border-white/5 rounded-xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-white">Worker Monitor</h2>
            <p className="text-xs text-white/50">Health status of all workers and executors</p>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            <span className="text-[11px] text-white/50">Live</span>
          </div>
        </div>
        <WorkerMonitorRealtime />
      </div>

      {/* Task Dependency Viewer Section */}
      <TaskDependencyViewer />
    </div>
  )
}

interface StatCardProps {
  label: string
  value: string | number
  icon: React.ComponentType<{ size: number; className: string }>
  color: string
}

function StatCard({ label, value, icon: Icon, color }: StatCardProps) {
  const [textC, bgC, borderC] = color.split(' ')
  return (
    <div className={`bg-white/[0.06] border ${borderC} rounded-xl p-4`}>
      <div className={`w-7 h-7 rounded-lg border ${bgC} ${borderC} flex items-center justify-center mb-3`}>
        <Icon size={13} className={textC} />
      </div>
      <p className={`text-lg font-bold ${textC}`}>{value}</p>
      <p className="text-[11px] text-white/50 mt-0.5">{label}</p>
    </div>
  )
}
