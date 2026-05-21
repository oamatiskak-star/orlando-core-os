'use client'

import { useState } from 'react'
import { Upload } from 'lucide-react'
import AgentGrid from './AgentGrid'
import AgentTaskFeed from './AgentTaskFeed'
import CommandCenter from './CommandCenter'
import ClickUpImportPanel from './ClickUpImportPanel'

interface TabContainerProps {
  initialAgents: any[]
}

export default function TabContainer({ initialAgents }: TabContainerProps) {
  const [activeTab, setActiveTab] = useState<'agent-os' | 'identity' | 'command-center' | 'clickup'>('agent-os')

  const tabs = [
    { id: 'agent-os', label: 'Agent OS', description: 'Beheer en monitor agents' },
    { id: 'identity', label: 'Identity', description: 'Persona identity layer' },
    { id: 'command-center', label: 'Command Center', description: 'Organization overview' },
    { id: 'clickup', label: 'ClickUp Import', description: 'Task synchronization', icon: Upload },
  ] as const

  return (
    <div className="space-y-5">
      {/* Tab Navigation */}
      <div className="bg-white/[0.06] border border-white/5 rounded-xl p-1 flex gap-1">
        {tabs.map(tab => {
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition ${
                isActive
                  ? 'bg-white/10 border border-white/20 text-white'
                  : 'text-white/50 hover:text-white/70'
              }`}
            >
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'agent-os' && (
          <div className="space-y-5">
            {/* Agent Grid */}
            <div className="bg-white/[0.06] border border-white/5 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-white">Agent Cluster</h2>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                  <span className="text-[11px] text-white/50">Realtime</span>
                </div>
              </div>
              <AgentGrid initialAgents={initialAgents} />
            </div>

            {/* Task Feed */}
            <div className="bg-white/[0.06] border border-white/5 rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-white">Task Queue</h2>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                  <span className="text-[11px] text-white/50">Realtime</span>
                </div>
              </div>
              <AgentTaskFeed />
            </div>
          </div>
        )}

        {activeTab === 'identity' && (
          <div className="bg-white/[0.06] border border-white/5 rounded-xl p-5 min-h-60 flex items-center justify-center">
            <p className="text-xs text-white/40">Identity layer — existing implementation</p>
          </div>
        )}

        {activeTab === 'command-center' && <CommandCenter />}

        {activeTab === 'clickup' && (
          <div className="space-y-5">
            <ClickUpImportPanel />
          </div>
        )}
      </div>
    </div>
  )
}
