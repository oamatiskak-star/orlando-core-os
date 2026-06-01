'use client'

import { useState, useMemo } from 'react'
import { ChevronLeft, Filter, TrendingUp } from 'lucide-react'
import Link from 'next/link'
import { useBuildPriorities } from '@/hooks/useBuildPriorities'
import { BuildDependencyCard } from '@/components/dashboard/build-tracker/BuildDependencyCard'
import { getActiveCompany } from '@/lib/active-company-client'

export default function PrioritiesPage() {
  const [activeCompanyId, setActiveCompanyId] = useState<string | null>(null)
  const [autonomyFilter, setAutonomyFilter] = useState<'all' | 'full' | 'partial' | 'manual'>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'queued' | 'in_progress' | 'completed' | 'blocked'>('all')

  const company = getActiveCompany()

  const { priorities, loading } = useBuildPriorities(company?.id || '')

  const filtered = useMemo(() => {
    return priorities
      .filter((p) => {
        if (autonomyFilter !== 'all' && p.autonomy_level !== autonomyFilter) return false
        if (statusFilter === 'queued' && !['planned', 'paused'].includes(p.status)) return false
        if (statusFilter === 'in_progress' && !['building', 'testing', 'deploying'].includes(p.status)) return false
        if (statusFilter === 'completed' && p.status !== 'live') return false
        if (statusFilter === 'blocked' && p.status !== 'failed') return false
        return true
      })
      .sort((a, b) => a.current_priority - b.current_priority)
  }, [priorities, autonomyFilter, statusFilter])

  if (!company) {
    return (
      <div className="py-16 text-center">
        <p className="text-white/40">Company not found</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 mb-5">
        <Link href="/dashboard/build-tracker" className="text-white/40 hover:text-white/70">
          <ChevronLeft size={16} />
        </Link>
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: `${company.color}1a`, border: `1px solid ${company.color}33`, color: company.color }}
        >
          <TrendingUp size={16} />
        </div>
        <div className="flex-1">
          <h1 className="text-base font-semibold text-white">Build Prioriteiten</h1>
          <p className="text-xs text-white/50">{filtered.length} projecten</p>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setAutonomyFilter('all')}
          className={`text-[11px] px-3 py-1.5 rounded transition-all flex items-center gap-1 ${
            autonomyFilter === 'all'
              ? 'bg-white/[0.12] text-white'
              : 'bg-white/[0.04] text-white/60 hover:bg-white/[0.06]'
          }`}
        >
          <Filter size={12} />
          Alle
        </button>
        <button
          onClick={() => setAutonomyFilter('full')}
          className={`text-[11px] px-3 py-1.5 rounded transition-all ${
            autonomyFilter === 'full' ? 'bg-emerald-500/25 text-emerald-400' : 'bg-white/[0.04] text-white/60 hover:bg-white/[0.06]'
          }`}
        >
          Volledig autonoom
        </button>
        <button
          onClick={() => setAutonomyFilter('partial')}
          className={`text-[11px] px-3 py-1.5 rounded transition-all ${
            autonomyFilter === 'partial' ? 'bg-amber-500/25 text-amber-400' : 'bg-white/[0.04] text-white/60 hover:bg-white/[0.06]'
          }`}
        >
          Gedeeltelijk autonoom
        </button>
        <button
          onClick={() => setAutonomyFilter('manual')}
          className={`text-[11px] px-3 py-1.5 rounded transition-all ${
            autonomyFilter === 'manual' ? 'bg-red-500/25 text-red-400' : 'bg-white/[0.04] text-white/60 hover:bg-white/[0.06]'
          }`}
        >
          Handmatig
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array(6)
            .fill(0)
            .map((_, i) => (
              <div key={i} className="h-64 bg-white/[0.04] border border-white/[0.06] rounded-lg animate-pulse"></div>
            ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center bg-white/[0.02] border border-dashed border-white/[0.06] rounded-xl">
          <TrendingUp size={28} className="text-white/15 mx-auto mb-3" />
          <p className="text-[12px] text-white/40">Geen projecten beschikbaar</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((p) => (
            <Link key={p.build_id} href={`/dashboard/build-tracker/${p.build_id}`} className="block hover:opacity-80 transition-opacity">
              <BuildDependencyCard
                buildId={p.build_id}
                name={p.name}
                status={p.status}
                priority={p.current_priority}
                progressPct={p.progress_pct}
                dependsOnCount={p.depends_on_count}
                blockedByCount={p.blocked_by_count}
                autonomyBoostApplied={p.autonomy_boost_applied}
              />
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
