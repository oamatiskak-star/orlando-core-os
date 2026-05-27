'use client'

import { useEffect, useState } from 'react'
import { CheckCircle, Circle, AlertCircle, ChevronDown, ChevronRight } from 'lucide-react'
import Link from 'next/link'

interface Component {
  id: string
  name: string
  description: string
  status: 'pending' | 'in-progress' | 'completed' | 'on-hold'
  progress_pct: number
  completed_at?: Date | string
  dependencies: string[]
}

interface Phase {
  id: string
  number: number
  title: string
  description: string
  status: 'planned' | 'in-progress' | 'completed' | 'blocked'
  progress_pct: number
  components: Component[]
  critical_path: boolean
  owner?: string
  completed_at?: Date | string
  target_completion?: Date | string
}

interface ProjectData {
  project: {
    name: string
    description: string
    status: string
    total_progress: number
    completed_phases: number
    active_phases: number
  }
  phases: Phase[]
  summary: {
    total_phases: number
    critical_path_phases: number
    estimated_total_effort_days: number
  }
}

const STATUS_COLORS: Record<string, { bg: string; text: string; badge: string }> = {
  completed: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', badge: 'bg-emerald-500/20 border-emerald-500/30' },
  'in-progress': { bg: 'bg-blue-500/10', text: 'text-blue-400', badge: 'bg-blue-500/20 border-blue-500/30' },
  planned: { bg: 'bg-slate-500/10', text: 'text-slate-400', badge: 'bg-slate-500/20 border-slate-500/30' },
  blocked: { bg: 'bg-red-500/10', text: 'text-red-400', badge: 'bg-red-500/20 border-red-500/30' },
  pending: { bg: 'bg-slate-500/10', text: 'text-slate-400', badge: 'bg-slate-500/20 border-slate-500/30' },
}

function formatDate(date?: Date | string): string {
  if (!date) return '—'
  const d = new Date(date)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'completed':
      return <CheckCircle size={16} className="text-emerald-400" />
    case 'in-progress':
      return <Circle size={16} className="text-blue-400 animate-pulse" />
    case 'blocked':
      return <AlertCircle size={16} className="text-red-400" />
    default:
      return <Circle size={16} className="text-slate-400" />
  }
}

function ProgressBar({ percent }: { percent: number }) {
  return (
    <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
      <div
        className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 transition-all"
        style={{ width: `${percent}%` }}
      />
    </div>
  )
}

export default function PhaseTrackerPage() {
  const [data, setData] = useState<ProjectData | null>(null)
  const [loading, setLoading] = useState(true)
  const [expandedPhases, setExpandedPhases] = useState<Set<string>>(new Set(['phase-1', 'phase-8', 'phase-9']))

  useEffect(() => {
    const fetchPhases = async () => {
      try {
        const response = await fetch('/api/affiliate-intelligence/phases')
        if (!response.ok) throw new Error('Failed to fetch phase data')
        const result = await response.json()
        setData(result)
      } catch (error) {
        console.error('Phase fetch error:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchPhases()
  }, [])

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-32 bg-white/5 rounded-xl animate-pulse" />
        <div className="h-40 bg-white/5 rounded-xl animate-pulse" />
      </div>
    )
  }

  if (!data) {
    return <div className="text-white/50">Failed to load phase tracker</div>
  }

  return (
    <div className="space-y-6">
      {/* Project Overview */}
      <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-semibold text-white">{data.project.name}</h1>
            <p className="text-xs text-white/50 mt-1">{data.project.description}</p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-white">{data.project.total_progress}%</div>
            <div className="text-xs text-white/50">Overall Progress</div>
          </div>
        </div>
        <ProgressBar percent={data.project.total_progress} />
        <div className="grid grid-cols-3 gap-3 mt-4">
          <div className="bg-emerald-500/10 rounded-lg p-2">
            <div className="text-sm font-semibold text-emerald-400">{data.project.completed_phases}</div>
            <div className="text-[11px] text-white/50">Completed</div>
          </div>
          <div className="bg-blue-500/10 rounded-lg p-2">
            <div className="text-sm font-semibold text-blue-400">{data.project.active_phases}</div>
            <div className="text-[11px] text-white/50">In Progress</div>
          </div>
          <div className="bg-white/5 rounded-lg p-2">
            <div className="text-sm font-semibold text-white/70">{data.summary.total_phases}</div>
            <div className="text-[11px] text-white/50">Total Phases</div>
          </div>
        </div>
      </div>

      {/* Phases Timeline */}
      <div className="space-y-2">
        {data.phases.map((phase) => {
          const isExpanded = expandedPhases.has(phase.id)
          const colors = STATUS_COLORS[phase.status] || STATUS_COLORS.planned

          return (
            <div key={phase.id} className={`border border-white/[0.06] rounded-lg overflow-hidden transition-colors ${colors.bg}`}>
              {/* Phase Header */}
              <button
                onClick={() => {
                  const newExpanded = new Set(expandedPhases)
                  if (newExpanded.has(phase.id)) {
                    newExpanded.delete(phase.id)
                  } else {
                    newExpanded.add(phase.id)
                  }
                  setExpandedPhases(newExpanded)
                }}
                className="w-full p-4 flex items-center gap-3 hover:bg-white/[0.02] transition-colors"
              >
                <div className="flex-shrink-0">
                  {isExpanded ? <ChevronDown size={16} className="text-white/50" /> : <ChevronRight size={16} className="text-white/50" />}
                </div>
                <StatusIcon status={phase.status} />
                <div className="flex-1 text-left">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-white">Phase {phase.number}: {phase.title}</span>
                    {phase.critical_path && <span className="text-[10px] px-1.5 py-0.5 bg-red-500/20 text-red-400 rounded">Critical Path</span>}
                  </div>
                  <p className="text-xs text-white/40 mt-0.5">{phase.description}</p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <div className="text-right">
                    <div className="text-sm font-semibold text-white">{phase.progress_pct}%</div>
                    <div className="text-[10px] text-white/50">{phase.status}</div>
                  </div>
                </div>
              </button>

              {/* Phase Details */}
              {isExpanded && (
                <div className="border-t border-white/[0.06] px-4 py-3 bg-white/[0.02] space-y-3">
                  {/* Phase Info */}
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    {phase.owner && (
                      <div>
                        <div className="text-white/50">Owner</div>
                        <div className="text-white/80">{phase.owner}</div>
                      </div>
                    )}
                    {phase.completed_at && (
                      <div>
                        <div className="text-white/50">Completed</div>
                        <div className="text-emerald-400">{formatDate(phase.completed_at)}</div>
                      </div>
                    )}
                    {phase.target_completion && !phase.completed_at && (
                      <div>
                        <div className="text-white/50">Target</div>
                        <div className="text-blue-400">{formatDate(phase.target_completion)}</div>
                      </div>
                    )}
                  </div>

                  {/* Components */}
                  {phase.components.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-[11px] font-semibold text-white/60 uppercase">Components</div>
                      <div className="space-y-1">
                        {phase.components.map((comp) => {
                          const compColors = STATUS_COLORS[comp.status] || STATUS_COLORS.pending
                          return (
                            <div key={comp.id} className={`p-2 rounded border ${compColors.badge} bg-white/[0.02]`}>
                              <div className="flex items-center gap-2">
                                <StatusIcon status={comp.status} />
                                <div className="flex-1 text-xs">
                                  <div className="text-white/80 font-medium">{comp.name}</div>
                                  <div className="text-white/50 text-[10px] mt-0.5">{comp.description}</div>
                                </div>
                                <div className="text-[10px] text-white/60 flex-shrink-0">{comp.progress_pct}%</div>
                              </div>
                              <div className="mt-1.5">
                                <ProgressBar percent={comp.progress_pct} />
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Summary Statistics */}
      <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-4">
        <div className="text-xs font-semibold text-white/60 uppercase mb-3">Project Summary</div>
        <div className="grid grid-cols-3 gap-3 text-xs">
          <div>
            <div className="text-white/80 font-medium">{data.summary.total_phases} Phases</div>
            <div className="text-white/50">Total scope</div>
          </div>
          <div>
            <div className="text-white/80 font-medium">{data.summary.critical_path_phases}</div>
            <div className="text-white/50">Critical path</div>
          </div>
          <div>
            <div className="text-white/80 font-medium">{data.summary.estimated_total_effort_days} Days</div>
            <div className="text-white/50">Estimated timeline</div>
          </div>
        </div>
      </div>

      {/* Links */}
      <div className="space-y-2">
        <Link
          href="/dashboard/revenue-intelligence"
          className="block text-xs text-blue-400 hover:text-blue-300 transition-colors"
        >
          → View Revenue Intelligence Dashboard (Phase 8)
        </Link>
        <a
          href="https://github.com/oamatiskak-star/orlando-core-os/blob/claude/stack-selection-question-qKSjm/CLAUDE.md"
          target="_blank"
          rel="noopener noreferrer"
          className="block text-xs text-blue-400 hover:text-blue-300 transition-colors"
        >
          → View Full Implementation Plan
        </a>
      </div>
    </div>
  )
}
