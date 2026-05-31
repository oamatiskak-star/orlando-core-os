'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, Clock, X, ArrowRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import clsx from 'clsx'

type ProactiveAlert = {
  id: string
  alert_type: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  description: string
  affected_entity: string | null
  detected_at: string
  presented_to_orlando: string | null
  action_taken: string | null
  resolved_at: string | null
  metadata: Record<string, any>
}

export default function HermesProactiveAlerts({ companyId }: { companyId: string }) {
  const supabase = createClient()
  const [alerts, setAlerts] = useState<ProactiveAlert[]>([])
  const [loading, setLoading] = useState(true)
  const [actingOn, setActingOn] = useState<string | null>(null)

  useEffect(() => {
    const loadAlerts = async () => {
      try {
        const { data } = await supabase
          .from('hermes.proactive_alerts')
          .select('*')
          .eq('company_id', companyId)
          .is('resolved_at', null)
          .order('detected_at', { ascending: false })
          .limit(10)

        setAlerts(
          (data || []).map(a => ({
            id: a.id,
            alert_type: a.alert_type,
            severity: a.severity || 'medium',
            description: a.description,
            affected_entity: a.affected_entity,
            detected_at: a.detected_at,
            presented_to_orlando: a.presented_to_orlando,
            action_taken: a.action_taken,
            resolved_at: a.resolved_at,
            metadata: a.metadata || {},
          }))
        )
      } catch (error) {
        console.error('Error loading proactive alerts:', error)
      } finally {
        setLoading(false)
      }
    }

    loadAlerts()

    // Subscribe to new alerts
    const channel = supabase
      .channel(`hermes_alerts_${companyId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'hermes',
          table: 'proactive_alerts',
          filter: `company_id=eq.${companyId}`,
        },
        () => loadAlerts()
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'hermes',
          table: 'proactive_alerts',
          filter: `company_id=eq.${companyId}`,
        },
        () => loadAlerts()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [companyId, supabase])

  const handleMarkResolved = async (alertId: string) => {
    setActingOn(alertId)
    try {
      await supabase
        .from('hermes.proactive_alerts')
        .update({
          resolved_at: new Date().toISOString(),
          presented_to_orlando: new Date().toISOString(),
        })
        .eq('id', alertId)

      setAlerts(alerts.filter(a => a.id !== alertId))
    } catch (error) {
      console.error('Error resolving alert:', error)
    } finally {
      setActingOn(null)
    }
  }

  const handleMarkPresented = async (alertId: string) => {
    try {
      await supabase
        .from('hermes.proactive_alerts')
        .update({
          presented_to_orlando: new Date().toISOString(),
        })
        .eq('id', alertId)

      setAlerts(alerts.map(a =>
        a.id === alertId ? { ...a, presented_to_orlando: new Date().toISOString() } : a
      ))
    } catch (error) {
      console.error('Error updating alert:', error)
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-500/20 border-red-500/30 text-red-300'
      case 'high':
        return 'bg-orange-500/20 border-orange-500/30 text-orange-300'
      case 'medium':
        return 'bg-amber-500/20 border-amber-500/30 text-amber-300'
      default:
        return 'bg-blue-500/20 border-blue-500/30 text-blue-300'
    }
  }

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'payment_overdue':
        return '💳'
      case 'deadline_approaching':
        return '⏰'
      case 'unresolved_task':
        return '✓'
      default:
        return '⚠'
    }
  }

  const getAlertTitle = (type: string) => {
    switch (type) {
      case 'payment_overdue':
        return 'Payment Overdue'
      case 'deadline_approaching':
        return 'Deadline Approaching'
      case 'unresolved_task':
        return 'Unresolved Task'
      default:
        return type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
    }
  }

  if (loading) {
    return (
      <div className="bg-white/[0.06] border border-white/5 rounded-xl p-4 animate-pulse">
        <div className="h-20 bg-white/5 rounded" />
      </div>
    )
  }

  if (alerts.length === 0) {
    return (
      <div className="bg-white/[0.06] border border-white/5 rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <CheckCircle2 size={16} className="text-green-400" />
          <h2 className="text-sm font-semibold text-white">Proactive Intelligence</h2>
        </div>
        <p className="text-xs text-green-300/60">✓ All systems green. No critical alerts.</p>
      </div>
    )
  }

  return (
    <div className="bg-gradient-to-br from-white/[0.08] to-white/[0.04] border border-white/10 rounded-xl p-5 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <AlertTriangle size={16} className="text-orange-400" />
        <h2 className="text-sm font-semibold text-white">Proactive Intelligence</h2>
        <span className="text-[11px] text-orange-400/60 ml-auto">
          {alerts.length} active
        </span>
      </div>

      {/* Alerts List */}
      <div className="space-y-2 max-h-[400px] overflow-y-auto">
        {alerts.map((alert) => (
          <div
            key={alert.id}
            className={clsx(
              'border rounded-lg p-3 space-y-2 transition-all',
              getSeverityColor(alert.severity)
            )}
          >
            {/* Title and Type */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2 flex-1">
                <span className="text-lg mt-0.5">{getAlertIcon(alert.alert_type)}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold leading-tight">
                    {getAlertTitle(alert.alert_type)}
                  </p>
                  <p className="text-[10px] opacity-80 mt-0.5 leading-relaxed">
                    {alert.description}
                  </p>
                </div>
              </div>
              {alert.severity === 'critical' && (
                <span className="text-xs font-bold px-2 py-1 rounded bg-red-600/40">
                  CRITICAL
                </span>
              )}
            </div>

            {/* Entity and Timing */}
            {alert.affected_entity && (
              <p className="text-[10px] opacity-70">
                Entity: <span className="font-mono">{alert.affected_entity}</span>
              </p>
            )}

            <div className="flex items-center gap-1.5 text-[10px] opacity-70">
              <Clock size={12} />
              <span>
                {Math.round(
                  (Date.now() - new Date(alert.detected_at).getTime()) / 60000
                )}{' '}
                min ago
              </span>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-1.5">
              {!alert.presented_to_orlando ? (
                <button
                  onClick={() => handleMarkPresented(alert.id)}
                  className="text-[10px] px-2 py-1 rounded bg-white/10 hover:bg-white/20 transition-colors"
                >
                  Mark Seen
                </button>
              ) : null}
              <button
                onClick={() => handleMarkResolved(alert.id)}
                disabled={actingOn === alert.id}
                className="text-[10px] px-2 py-1 rounded bg-white/10 hover:bg-white/20 transition-colors disabled:opacity-50 flex items-center gap-1"
              >
                {actingOn === alert.id ? (
                  <>Resolving...</>
                ) : (
                  <>
                    Resolve <ArrowRight size={10} />
                  </>
                )}
              </button>
            </div>

            {/* Action Taken */}
            {alert.action_taken && (
              <p className="text-[9px] italic opacity-70 border-t border-current/20 pt-2">
                Action: {alert.action_taken}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Summary */}
      {alerts.length > 0 && (
        <div className="pt-2 border-t border-white/10 text-[11px] text-white/60">
          <p>
            {alerts.filter(a => a.severity === 'critical').length} critical •{' '}
            {alerts.filter(a => a.severity === 'high').length} high priority
          </p>
        </div>
      )}
    </div>
  )
}
