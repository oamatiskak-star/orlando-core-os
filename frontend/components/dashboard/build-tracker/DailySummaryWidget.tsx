'use client'

import { useDailySummary } from '@/hooks/useDailySummary'
import { CheckCircle2, Clock, AlertCircle, Zap } from 'lucide-react'

interface DailySummaryWidgetProps {
  companyId: string
  companyColor: string
}

export function DailySummaryWidget({ companyId, companyColor }: DailySummaryWidgetProps) {
  const { summary, loading } = useDailySummary(companyId)

  if (loading) {
    return (
      <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-4 animate-pulse">
        <div className="h-4 bg-white/[0.06] rounded w-32 mb-4"></div>
        <div className="grid grid-cols-4 gap-3">
          {Array(4)
            .fill(0)
            .map((_, i) => (
              <div key={i} className="bg-white/[0.06] rounded h-12"></div>
            ))}
        </div>
      </div>
    )
  }

  if (!summary) {
    return (
      <div className="bg-white/[0.04] border border-dashed border-white/[0.06] rounded-xl p-4 text-center">
        <p className="text-[11px] text-white/40">Geen samenvatting beschikbaar</p>
      </div>
    )
  }

  const totalCount = summary.queued_count + summary.in_progress_count + summary.completed_count + summary.blocked_count
  const autonomyCount = summary.fully_autonomous_count + summary.partially_autonomous_count

  return (
    <div className="space-y-3">
      <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-4">
        <p className="text-[12px] font-semibold text-white mb-3">Dagelijks Overzicht</p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <div className="bg-white/[0.02] rounded-lg p-3">
            <p className="text-[10px] text-white/50 mb-1">In wachtrij</p>
            <p className="text-lg font-bold text-white">{summary.queued_count}</p>
          </div>
          <div className="bg-white/[0.02] rounded-lg p-3">
            <p className="text-[10px] text-white/50 mb-1">In uitvoering</p>
            <p className="text-lg font-bold text-blue-400">{summary.in_progress_count}</p>
          </div>
          <div className="bg-white/[0.02] rounded-lg p-3">
            <p className="text-[10px] text-white/50 mb-1">Voltooid</p>
            <p className="text-lg font-bold text-emerald-400">{summary.completed_count}</p>
          </div>
          <div className="bg-white/[0.02] rounded-lg p-3">
            <p className="text-[10px] text-white/50 mb-1">Geblokkeerd</p>
            <p className="text-lg font-bold text-red-400">{summary.blocked_count}</p>
          </div>
        </div>

        <div className="mb-4 pt-3 border-t border-white/[0.06]">
          <p className="text-[10px] font-semibold text-white/60 mb-2">Autonomie Niveau</p>
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-emerald-500/15 rounded-lg p-2">
              <p className="text-[10px] text-emerald-400 font-semibold">{summary.fully_autonomous_count}</p>
              <p className="text-[9px] text-emerald-300/60">Volledig</p>
            </div>
            <div className="bg-amber-500/15 rounded-lg p-2">
              <p className="text-[10px] text-amber-400 font-semibold">{summary.partially_autonomous_count}</p>
              <p className="text-[9px] text-amber-300/60">Gedeeltelijk</p>
            </div>
            <div className="bg-red-500/15 rounded-lg p-2">
              <p className="text-[10px] text-red-400 font-semibold">{summary.manual_count}</p>
              <p className="text-[9px] text-red-300/60">Handmatig</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 text-[10px] text-white/50">
          <Clock size={12} />
          {summary.agent_deliveries_count} agent{summary.agent_deliveries_count !== 1 ? 's' : ''} actief vandaag
        </div>
      </div>

      {summary.snapshot_data?.queued && summary.snapshot_data.queued.length > 0 && (
        <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-4">
          <p className="text-[12px] font-semibold text-white mb-2 flex items-center gap-2">
            <Clock size={14} />
            Top Wachtrij (prioriteit 1-5)
          </p>
          <div className="space-y-2">
            {summary.snapshot_data.queued.slice(0, 5).map((build) => (
              <div key={build.id} className="flex items-center justify-between text-[11px] bg-white/[0.02] rounded-lg p-2">
                <div className="flex-1">
                  <p className="text-white/90 font-medium">{build.name}</p>
                  <p className="text-white/50">Priority {build.priority} • {build.progress}%</p>
                </div>
                <div
                  className="text-[10px] font-semibold px-2 py-1 rounded"
                  style={{
                    backgroundColor:
                      build.autonomy === 'full'
                        ? 'rgb(16 185 129 / 0.15)'
                        : build.autonomy === 'partial'
                          ? 'rgb(217 119 6 / 0.15)'
                          : 'rgb(239 68 68 / 0.15)',
                    color:
                      build.autonomy === 'full'
                        ? 'rgb(52 211 153)'
                        : build.autonomy === 'partial'
                          ? 'rgb(251 146 60)'
                          : 'rgb(248 113 113)',
                  }}
                >
                  {build.autonomy}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {summary.snapshot_data?.agent_deliveries && summary.snapshot_data.agent_deliveries.length > 0 && (
        <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-4">
          <p className="text-[12px] font-semibold text-white mb-2 flex items-center gap-2">
            <Zap size={14} />
            Recente Agent Activiteiten
          </p>
          <div className="space-y-2">
            {summary.snapshot_data.agent_deliveries.slice(0, 5).map((delivery, i) => (
              <div key={i} className="flex items-start gap-2 text-[10px] bg-white/[0.02] rounded-lg p-2">
                <div
                  className={`mt-0.5 flex-shrink-0 ${
                    delivery.status === 'success'
                      ? 'text-emerald-400'
                      : delivery.status === 'failed'
                        ? 'text-red-400'
                        : 'text-amber-400'
                  }`}
                >
                  {delivery.status === 'success' ? (
                    <CheckCircle2 size={12} />
                  ) : delivery.status === 'failed' ? (
                    <AlertCircle size={12} />
                  ) : (
                    <Clock size={12} />
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-white/90">
                    <span className="font-semibold">{delivery.agent}</span> • {delivery.action}
                  </p>
                  <p className="text-white/50">{delivery.build}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
