'use client'

import { useEffect, useState } from 'react'
import { TrendingUp, CheckCircle2, AlertTriangle, Clock } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import clsx from 'clsx'

type ExecutiveReport = {
  id: string
  report_time: string
  total_notified: number
  total_resolved: number
  awaiting_manual_action: number
  critical_count: number
  summary: string
  resolved_items: string[]
  pending_items: string[]
  action_required_items: string[]
}

export default function HermesExecutiveReport({ companyId }: { companyId: string }) {
  const supabase = createClient()
  const [reports, setReports] = useState<ExecutiveReport[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedReport, setExpandedReport] = useState<string | null>(null)

  useEffect(() => {
    const loadReports = async () => {
      try {
        const { data } = await supabase
          .from('hermes.executive_reports')
          .select('id, report_time, total_notified, total_resolved, awaiting_manual_action, critical_count, summary, resolved_items, pending_items, action_required_items')
          .eq('company_id', companyId)
          .eq('is_daily_briefing', true)
          .order('report_time', { ascending: false })
          .limit(6)

        setReports(
          (data || []).map(r => ({
            id: r.id,
            report_time: r.report_time,
            total_notified: r.total_notified || 0,
            total_resolved: r.total_resolved || 0,
            awaiting_manual_action: r.awaiting_manual_action || 0,
            critical_count: r.critical_count || 0,
            summary: r.summary || '',
            resolved_items: r.resolved_items || [],
            pending_items: r.pending_items || [],
            action_required_items: r.action_required_items || [],
          }))
        )
      } catch (error) {
        console.error('Error loading executive reports:', error)
      } finally {
        setLoading(false)
      }
    }

    loadReports()

    // Subscribe to new reports
    const channel = supabase
      .channel(`hermes_reports_${companyId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'hermes',
          table: 'executive_reports',
          filter: `company_id=eq.${companyId}`,
        },
        (payload) => {
          loadReports()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [companyId, supabase])

  if (loading) {
    return (
      <div className="bg-white/[0.06] border border-white/5 rounded-xl p-4 animate-pulse">
        <div className="h-24 bg-white/5 rounded" />
      </div>
    )
  }

  if (reports.length === 0) {
    return (
      <div className="bg-white/[0.06] border border-white/5 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <Clock size={16} className="text-amber-400" />
          <h2 className="text-sm font-semibold text-white">Executive Briefings</h2>
        </div>
        <p className="text-xs text-white/40">Waiting for first briefing cycle...</p>
      </div>
    )
  }

  const schedule = ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00']
  const reportsByTime: Record<string, ExecutiveReport> = {}
  reports.forEach(r => {
    reportsByTime[r.report_time] = r
  })

  return (
    <div className="bg-gradient-to-br from-white/[0.08] to-white/[0.04] border border-white/10 rounded-xl p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <TrendingUp size={16} className="text-amber-400" />
        <h2 className="text-sm font-semibold text-white">Executive Briefings</h2>
        <span className="text-[11px] text-white/40 ml-auto">6x Daily</span>
      </div>

      {/* Daily Schedule */}
      <div className="grid grid-cols-6 gap-2">
        {schedule.map((time) => {
          const report = reportsByTime[time]
          const isExpanded = expandedReport === time
          const hasAlerts = report && report.critical_count > 0
          const hasActions = report && report.awaiting_manual_action > 0

          return (
            <button
              key={time}
              onClick={() => setExpandedReport(isExpanded ? null : time)}
              className={clsx(
                'rounded-lg p-2 text-center transition-all text-xs font-medium',
                report
                  ? hasAlerts
                    ? 'bg-red-500/20 border border-red-500/30 text-red-300 hover:bg-red-500/30'
                    : hasActions
                    ? 'bg-amber-500/20 border border-amber-500/30 text-amber-300 hover:bg-amber-500/30'
                    : 'bg-green-500/20 border border-green-500/30 text-green-300 hover:bg-green-500/30'
                  : 'bg-white/5 border border-white/10 text-white/40'
              )}
            >
              <div className="font-mono text-[11px]">{time}</div>
              {report && (
                <div className="text-[9px] text-white/60 mt-0.5">
                  {report.total_resolved}/{report.total_notified}
                </div>
              )}
            </button>
          )
        })}
      </div>

      {/* Expanded Report */}
      {expandedReport && reportsByTime[expandedReport] && (
        <div className="bg-white/5 border border-white/10 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-white">
              Briefing {expandedReport}
            </p>
            <p className="text-[10px] text-white/40">
              {reportsByTime[expandedReport].total_notified} reported
            </p>
          </div>

          {/* Resolved Items */}
          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <CheckCircle2 size={14} className="text-green-400" />
              <p className="text-xs font-semibold text-green-300">
                Resolved ({reportsByTime[expandedReport].total_resolved})
              </p>
            </div>
            <div className="space-y-1 pl-5">
              {reportsByTime[expandedReport].resolved_items.length > 0 ? (
                reportsByTime[expandedReport].resolved_items.slice(0, 3).map((item, i) => (
                  <p key={i} className="text-[10px] text-green-200/70 leading-tight">
                    ✓ {item}
                  </p>
                ))
              ) : (
                <p className="text-[10px] text-white/30">None</p>
              )}
            </div>
          </div>

          {/* Pending Items */}
          {reportsByTime[expandedReport].pending_items.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-white/70 mb-1.5">
                Still Pending ({reportsByTime[expandedReport].pending_items.length})
              </p>
              <div className="space-y-1 pl-3">
                {reportsByTime[expandedReport].pending_items.slice(0, 3).map((item, i) => (
                  <p key={i} className="text-[10px] text-white/50 leading-tight">
                    ⏳ {item}
                  </p>
                ))}
              </div>
            </div>
          )}

          {/* Action Required */}
          {reportsByTime[expandedReport].critical_count > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <AlertTriangle size={14} className="text-red-400" />
                <p className="text-xs font-semibold text-red-300">
                  Action Required ({reportsByTime[expandedReport].critical_count})
                </p>
              </div>
              <div className="space-y-1 pl-5">
                {reportsByTime[expandedReport].action_required_items.slice(0, 3).map((item, i) => (
                  <p key={i} className="text-[10px] text-red-200/70 leading-tight">
                    ⚠ {item}
                  </p>
                ))}
              </div>
            </div>
          )}

          {/* Summary */}
          {reportsByTime[expandedReport].summary && (
            <p className="text-[10px] text-white/60 italic border-t border-white/5 pt-2">
              "{reportsByTime[expandedReport].summary}"
            </p>
          )}
        </div>
      )}

      {/* Summary Stats */}
      {reports.length > 0 && (
        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/5">
          <div className="bg-white/5 rounded-lg p-2 text-center">
            <p className="text-[10px] text-white/60">Total Notified</p>
            <p className="text-xs font-bold text-white mt-0.5">
              {reports.reduce((sum, r) => sum + r.total_notified, 0)}
            </p>
          </div>
          <div className="bg-green-500/10 rounded-lg p-2 text-center">
            <p className="text-[10px] text-green-400/60">Resolved</p>
            <p className="text-xs font-bold text-green-300 mt-0.5">
              {reports.reduce((sum, r) => sum + r.total_resolved, 0)}
            </p>
          </div>
          <div className="bg-red-500/10 rounded-lg p-2 text-center">
            <p className="text-[10px] text-red-400/60">Action Needed</p>
            <p className="text-xs font-bold text-red-300 mt-0.5">
              {reports.reduce((sum, r) => sum + r.critical_count, 0)}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
