'use client'

import { useEffect, useState } from 'react'
import { Calendar, AlertCircle, CheckCircle, Clock } from 'lucide-react'

interface Phase {
  id: string
  number: number
  title: string
  status: 'planned' | 'in-progress' | 'completed' | 'blocked'
  progress_pct: number
  started_at?: string
  completed_at?: string
  target_completion?: string
  critical_path: boolean
}

interface ProjectData {
  phases: Phase[]
  summary: {
    total_phases: number
    critical_path_phases: number
    estimated_total_effort_days: number
  }
}

const STATUS_COLORS = {
  completed: 'bg-emerald-500',
  'in-progress': 'bg-blue-500',
  planned: 'bg-slate-400',
  blocked: 'bg-red-500',
}

const STATUS_TEXT = {
  completed: 'text-emerald-400',
  'in-progress': 'text-blue-400',
  planned: 'text-slate-300',
  blocked: 'text-red-400',
}

function formatDate(date?: string): string {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function calculateDayOffset(startDate: Date): number {
  const projectStart = new Date('2025-01-01')
  return Math.floor((startDate.getTime() - projectStart.getTime()) / (24 * 60 * 60 * 1000))
}

function calculateDuration(startDate?: string, endDate?: string): number {
  if (!startDate || !endDate) return 0
  const start = new Date(startDate)
  const end = new Date(endDate)
  return Math.ceil((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000))
}

export default function MilestonesPage() {
  const [data, setData] = useState<ProjectData | null>(null)
  const [loading, setLoading] = useState(true)

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
    return <div className="h-96 bg-white/5 rounded-xl animate-pulse" />
  }

  if (!data) {
    return <div className="text-white/50">Failed to load milestones</div>
  }

  const totalDays = data.summary.estimated_total_effort_days
  const pixelsPerDay = 1200 / totalDays

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-5">
        <div className="flex items-center gap-3 mb-2">
          <Calendar className="text-blue-400" size={20} />
          <h1 className="text-xl font-semibold text-white">Project Timeline & Milestones</h1>
        </div>
        <p className="text-xs text-white/50">Affiliate Intelligence Engine - 9 Phase Implementation</p>
        <div className="mt-3 grid grid-cols-3 gap-3 text-xs">
          <div>
            <div className="text-white/80 font-medium">Jan 1 - May 28, 2025</div>
            <div className="text-white/50">Duration: {data.summary.estimated_total_effort_days} days</div>
          </div>
          <div>
            <div className="text-white/80 font-medium">{data.summary.total_phases} Phases</div>
            <div className="text-white/50">Comprehensive roadmap</div>
          </div>
          <div>
            <div className="text-white/80 font-medium">{data.summary.critical_path_phases} Critical</div>
            <div className="text-white/50">Path phases</div>
          </div>
        </div>
      </div>

      {/* Gantt Chart */}
      <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-5 overflow-x-auto">
        <div className="min-w-max">
          {/* Timeline Header */}
          <div className="mb-4">
            <div className="flex gap-1 text-[10px] text-white/40 mb-2">
              <div className="w-40 flex-shrink-0">Phase</div>
              <div className="flex" style={{ width: `${1200}px` }}>
                <div className="flex-1 flex gap-1">
                  {Array.from({ length: 6 }).map((_, i) => {
                    const date = new Date('2025-01-01')
                    date.setMonth(date.getMonth() + i)
                    return (
                      <div key={i} className="text-center" style={{ width: '200px' }}>
                        {date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
            <div className="flex gap-1">
              <div className="w-40 flex-shrink-0" />
              <div className="flex border-t border-white/10" style={{ width: `${1200}px` }}>
                {Array.from({ length: 24 }).map((_, i) => (
                  <div key={i} className="flex-1 border-r border-white/5 h-1" />
                ))}
              </div>
            </div>
          </div>

          {/* Gantt Bars */}
          <div className="space-y-3">
            {data.phases.map((phase) => {
              const startDate = phase.started_at ? new Date(phase.started_at) : new Date('2025-01-01')
              const endDate = phase.completed_at || phase.target_completion || new Date('2025-05-28')
              const endDateObj = new Date(endDate)

              const dayOffset = calculateDayOffset(startDate)
              const duration = calculateDuration(phase.started_at, phase.completed_at || phase.target_completion)
              const barWidth = Math.max(20, duration * pixelsPerDay)
              const leftOffset = dayOffset * pixelsPerDay

              return (
                <div key={phase.id} className="flex gap-1 items-center">
                  <div className="w-40 flex-shrink-0">
                    <div className="flex items-center gap-2">
                      {phase.critical_path && <AlertCircle size={12} className="text-red-400" />}
                      <span className="text-xs font-medium text-white truncate">Phase {phase.number}</span>
                    </div>
                    <div className="text-[10px] text-white/40 truncate">{phase.title}</div>
                  </div>

                  <div className="relative" style={{ width: `${1200}px`, height: '40px' }}>
                    {/* Background track */}
                    <div className="absolute inset-0 bg-white/5 rounded" />

                    {/* Gantt bar */}
                    <div
                      className={`absolute top-1 h-8 rounded border border-white/20 transition-all ${STATUS_COLORS[phase.status]} flex items-center px-2`}
                      style={{
                        left: `${leftOffset}px`,
                        width: `${barWidth}px`,
                        opacity: phase.status === 'completed' ? 0.8 : phase.status === 'in-progress' ? 0.7 : 0.5,
                      }}
                    >
                      {/* Progress indicator inside bar */}
                      {phase.status !== 'planned' && (
                        <div
                          className="absolute top-1 left-0 h-8 rounded bg-white/20"
                          style={{ width: `${(phase.progress_pct / 100) * barWidth}px` }}
                        />
                      )}

                      {/* Status icon and percentage */}
                      <div className="relative z-10 flex items-center gap-1 text-white text-[10px] font-semibold">
                        {phase.status === 'completed' && <CheckCircle size={12} />}
                        {phase.status === 'in-progress' && <Clock size={12} className="animate-spin" />}
                        <span>{phase.progress_pct}%</span>
                      </div>
                    </div>

                    {/* Tooltip on hover */}
                    <div className="absolute -bottom-12 left-0 opacity-0 hover:opacity-100 transition-opacity pointer-events-none z-50">
                      <div className="bg-slate-900 border border-white/20 rounded px-2 py-1 text-[10px] text-white whitespace-nowrap">
                        {formatDate(phase.started_at)} → {formatDate(phase.completed_at || phase.target_completion)}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-4">
        <div className="text-xs font-semibold text-white/60 uppercase mb-3">Legend</div>
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-emerald-500 opacity-80" />
            <span className="text-white/70">Completed phases</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-blue-500 opacity-70" />
            <span className="text-white/70">In progress phases</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-slate-400 opacity-50" />
            <span className="text-white/70">Planned phases</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-red-500 opacity-50" />
            <span className="text-white/70">Blocked phases</span>
          </div>
          <div className="flex items-center gap-2">
            <AlertCircle size={14} className="text-red-400" />
            <span className="text-white/70">Critical path phase</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock size={14} className="animate-spin text-blue-400" />
            <span className="text-white/70">Currently active</span>
          </div>
        </div>
      </div>

      {/* Critical Path Phases */}
      <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-4">
        <div className="text-xs font-semibold text-white/60 uppercase mb-3 flex items-center gap-2">
          <AlertCircle size={14} />
          Critical Path Analysis
        </div>
        <div className="space-y-2 text-xs">
          {data.phases.filter(p => p.critical_path).map(phase => (
            <div key={phase.id} className="flex items-center justify-between p-2 bg-white/5 rounded border border-red-500/20">
              <div>
                <div className="text-white/80 font-medium">Phase {phase.number}: {phase.title}</div>
                <div className="text-white/50">{formatDate(phase.started_at)} → {formatDate(phase.completed_at || phase.target_completion)}</div>
              </div>
              <div className={`px-2 py-1 rounded text-white font-semibold ${STATUS_TEXT[phase.status]}`}>
                {phase.status}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
