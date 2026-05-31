'use client'

import { AlertCircle, CheckCircle2, Clock, Shield, TrendingUp } from 'lucide-react'
import { useBuildAutonomy } from '@/hooks/useBuildAutonomy'

const AUTONOMY_COLORS = {
  full: { bg: 'bg-emerald-500/15', text: 'text-emerald-400', badge: 'bg-emerald-500/25' },
  partial: { bg: 'bg-amber-500/15', text: 'text-amber-400', badge: 'bg-amber-500/25' },
  manual: { bg: 'bg-red-500/15', text: 'text-red-400', badge: 'bg-red-500/25' },
}

const AUTONOMY_LABELS = {
  full: 'Volledig autonoom',
  partial: 'Gedeeltelijk autonoom',
  manual: 'Handmatig',
}

interface BuildDependencyCardProps {
  buildId: string
  name: string
  status: string
  priority: number
  progressPct: number
  dependsOnCount: number
  blockedByCount: number
  autonomyBoostApplied: number
}

export function BuildDependencyCard({
  buildId,
  name,
  status,
  priority,
  progressPct,
  dependsOnCount,
  blockedByCount,
  autonomyBoostApplied,
}: BuildDependencyCardProps) {
  const { autonomy, loading } = useBuildAutonomy(buildId)

  if (!autonomy && !loading) return null

  const level = autonomy?.autonomy_level || 'manual'
  const colors = AUTONOMY_COLORS[level as keyof typeof AUTONOMY_COLORS]
  const blockingFactors = autonomy?.blocking_factors as Record<string, unknown> | null

  return (
    <div className={`rounded-lg border border-white/[0.08] p-4 ${colors.bg}`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <p className="text-[13px] font-semibold text-white">{name}</p>
          <p className="text-[11px] text-white/50 mt-0.5">Priority {priority} • {progressPct}%</p>
        </div>
        <div className={`px-2 py-1 rounded text-[10px] font-semibold ${colors.badge} ${colors.text}`}>
          {AUTONOMY_LABELS[level as keyof typeof AUTONOMY_LABELS]}
        </div>
      </div>

      {autonomy && !loading && (
        <>
          <div className="flex-1 h-1 rounded-full bg-white/[0.06] overflow-hidden mb-3">
            <div
              className={`h-full transition-all ${colors.text}`}
              style={{
                width: `${autonomy.autonomy_pct}%`,
                background: `linear-gradient(90deg, currentColor, currentColor)`,
                opacity: 0.6,
              }}
            />
          </div>

          <div className="space-y-2 mb-3">
            {dependsOnCount > 0 && (
              <div className="flex items-center gap-2 text-[10px] text-white/60">
                <TrendingUp size={12} />
                Afhankelijk van {dependsOnCount} project{dependsOnCount !== 1 ? 's' : ''}
              </div>
            )}
            {blockedByCount > 0 && (
              <div className="flex items-center gap-2 text-[10px] text-white/60">
                <Shield size={12} />
                Blokkeert {blockedByCount} project{blockedByCount !== 1 ? 's' : ''}
              </div>
            )}
            {autonomyBoostApplied > 0 && (
              <div className="flex items-center gap-2 text-[10px] text-white/60">
                <CheckCircle2 size={12} />
                Autonomy boost +{autonomyBoostApplied}
              </div>
            )}
          </div>

          {autonomy.required_approvals && autonomy.required_approvals.length > 0 && (
            <div className="mb-3 bg-white/[0.02] rounded p-2">
              <p className="text-[10px] font-semibold text-white/70 mb-1">Vereiste goedkeuringen:</p>
              <div className="flex flex-wrap gap-1">
                {autonomy.required_approvals.map((approval) => (
                  <span key={approval} className="text-[9px] bg-white/[0.06] text-white/60 px-1.5 py-0.5 rounded">
                    {approval}
                  </span>
                ))}
              </div>
            </div>
          )}

          {autonomy.required_skills && autonomy.required_skills.length > 0 && (
            <div className="mb-3 bg-white/[0.02] rounded p-2">
              <p className="text-[10px] font-semibold text-white/70 mb-1">Vereiste vaardigheden:</p>
              <div className="flex flex-wrap gap-1">
                {autonomy.required_skills.map((skill) => (
                  <span key={skill} className="text-[9px] bg-white/[0.06] text-white/60 px-1.5 py-0.5 rounded">
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}

          {blockingFactors && Object.keys(blockingFactors).length > 0 && (
            <div className="mt-3 bg-white/[0.02] rounded p-2 border border-red-500/20">
              <div className="flex items-start gap-2">
                <AlertCircle size={12} className="text-red-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-[10px] font-semibold text-red-400 mb-1">Blokkerende factoren:</p>
                  <ul className="text-[9px] text-red-300/70 space-y-0.5">
                    {Object.entries(blockingFactors).map(([key, value]) => (
                      <li key={key}>
                        • {key.replace(/_/g, ' ')}: {String(value)}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {autonomy.estimated_completion_time_hours && (
            <div className="mt-3 flex items-center gap-2 text-[10px] text-white/60">
              <Clock size={12} />
              Geschat: {autonomy.estimated_completion_time_hours}u
            </div>
          )}
        </>
      )}
    </div>
  )
}
