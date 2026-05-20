'use client'

import { useEffect, useState, useCallback } from 'react'
import clsx from 'clsx'
import { AlertTriangle, AlertCircle, Info, Check, RefreshCw } from 'lucide-react'
import { EmptyState } from './EmptyState'

type Alert = {
  id: string
  alert_kind: string
  severity: 'info' | 'warn' | 'critical'
  target_kind: string
  target_id: string | null
  title: string
  message: string
  detected_at: string
  acknowledged_at: string | null
  payload: Record<string, unknown> | null
}

const ICONS = { critical: AlertTriangle, warn: AlertCircle, info: Info }
const STYLES = {
  critical: 'border-red-400/30 bg-red-500/[0.06]',
  warn:     'border-amber-400/30 bg-amber-500/[0.06]',
  info:     'border-white/10 bg-white/[0.03]',
}
const TEXT = { critical: 'text-red-300', warn: 'text-amber-300', info: 'text-white/60' }

export function AlertFeed({ limit = 10, onlyUnack = true }: { limit?: number; onlyUnack?: boolean }) {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchAlerts = useCallback(async () => {
    setRefreshing(true)
    const url = `/api/executive-layer/alerts?limit=${limit}${onlyUnack ? '&unacked=true' : ''}`
    const res = await fetch(url)
    if (res.ok) {
      const json = await res.json()
      setAlerts(json.alerts ?? [])
    }
    setLoading(false)
    setRefreshing(false)
  }, [limit, onlyUnack])

  useEffect(() => {
    fetchAlerts()
    const interval = setInterval(fetchAlerts, 60_000)
    return () => clearInterval(interval)
  }, [fetchAlerts])

  const acknowledge = async (id: string) => {
    const res = await fetch(`/api/executive-layer/alerts/${id}`, { method: 'PATCH' })
    if (res.ok) fetchAlerts()
  }

  if (loading) {
    return <div className="text-xs text-white/40">Alerts laden…</div>
  }

  if (alerts.length === 0) {
    return (
      <EmptyState
        icon={<Check size={18} className="text-emerald-400/60" />}
        title="Geen open alerts"
        hint="Het ecosysteem is rustig — Alert Engine draait elke 15 minuten."
      />
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-wide text-white/40">
          {alerts.length} open alert{alerts.length === 1 ? '' : 's'}
        </div>
        <button
          type="button"
          onClick={fetchAlerts}
          className="text-white/40 hover:text-white/60"
          disabled={refreshing}
          aria-label="Refresh alerts"
        >
          <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
        </button>
      </div>
      {alerts.map(a => {
        const Icon = ICONS[a.severity]
        return (
          <div key={a.id} className={clsx('border rounded-xl p-3 flex items-start gap-3', STYLES[a.severity])}>
            <div className={clsx('mt-0.5', TEXT[a.severity])}>
              <Icon size={14} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <div className={clsx('text-xs font-medium truncate', TEXT[a.severity])}>{a.title}</div>
                <div className="text-[10px] text-white/30 shrink-0">{new Date(a.detected_at).toLocaleString('nl-NL')}</div>
              </div>
              <div className="text-[11px] text-white/50 mt-0.5 line-clamp-2">{a.message}</div>
              <div className="flex items-center gap-3 mt-1.5">
                <span className="text-[10px] uppercase tracking-wide text-white/30">{a.alert_kind.replace(/_/g, ' ')}</span>
                {!a.acknowledged_at ? (
                  <button
                    type="button"
                    onClick={() => acknowledge(a.id)}
                    className="text-[10px] text-white/40 hover:text-white/60 underline underline-offset-2"
                  >
                    Acknowledge
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
