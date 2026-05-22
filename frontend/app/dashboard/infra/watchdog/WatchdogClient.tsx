'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Clock,
  ExternalLink,
  Hammer,
  RefreshCw,
  Siren,
  XCircle,
} from 'lucide-react'
import clsx from 'clsx'
import type { WatchdogEvent, WatchdogIncident } from './page'

const EVENT_KIND_CFG: Record<
  WatchdogEvent['kind'],
  { color: string; label: string; icon: typeof CheckCircle }
> = {
  fail_detected: { color: 'text-amber-400 bg-amber-500/10', label: 'Fail', icon: AlertTriangle },
  restart_triggered: { color: 'text-blue-400 bg-blue-500/10', label: 'Restart', icon: RefreshCw },
  redeploy_triggered: { color: 'text-blue-400 bg-blue-500/10', label: 'Redeploy', icon: RefreshCw },
  rebuild_triggered: { color: 'text-cyan-400 bg-cyan-500/10', label: 'Rebuild', icon: Hammer },
  recovered: { color: 'text-green-400 bg-green-500/10', label: 'Recovered', icon: CheckCircle },
  escalated: { color: 'text-red-400 bg-red-500/10', label: 'Escalated', icon: Siren },
  check_error: { color: 'text-white/60 bg-white/5', label: 'Check error', icon: XCircle },
}

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return `${s}s`
  if (s < 3600) return `${Math.floor(s / 60)}m`
  if (s < 86400) return `${Math.floor(s / 3600)}u`
  return `${Math.floor(s / 86400)}d`
}

export default function WatchdogClient({
  initialIncidents,
  initialEvents,
  hostLabels,
}: {
  initialIncidents: WatchdogIncident[]
  initialEvents: WatchdogEvent[]
  hostLabels: Record<string, { label: string; color: string }>
}) {
  const [incidents, setIncidents] = useState<WatchdogIncident[]>(initialIncidents)
  const [events, setEvents] = useState<WatchdogEvent[]>(initialEvents)
  const [hostFilter, setHostFilter] = useState<string>('all')
  const [expandedIncident, setExpandedIncident] = useState<string | null>(null)
  const [resolvingKey, setResolvingKey] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('watchdog-live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'infra_watchdog_incidents' },
        (payload) => {
          startTransition(() => {
            setIncidents((prev) => {
              const next = [...prev]
              if (payload.eventType === 'DELETE') {
                const oldRow = payload.old as Partial<WatchdogIncident>
                return next.filter(
                  (i) => !(i.host_id === oldRow.host_id && i.deploy_id === oldRow.deploy_id)
                )
              }
              const row = payload.new as WatchdogIncident
              const idx = next.findIndex(
                (i) => i.host_id === row.host_id && i.deploy_id === row.deploy_id
              )
              if (idx >= 0) next[idx] = row
              else next.unshift(row)
              return next
            })
          })
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'infra_watchdog_events' },
        (payload) => {
          startTransition(() => {
            setEvents((prev) => [payload.new as WatchdogEvent, ...prev].slice(0, 200))
          })
        }
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [])

  const hosts = useMemo(() => {
    const set = new Set<string>(['all'])
    for (const e of events) set.add(e.host_id)
    for (const i of incidents) set.add(i.host_id)
    return Array.from(set)
  }, [events, incidents])

  const filteredIncidents = incidents.filter((i) => hostFilter === 'all' || i.host_id === hostFilter)
  const filteredEvents = events.filter((e) => hostFilter === 'all' || e.host_id === hostFilter)

  const openIncidents = filteredIncidents.filter((i) => i.status === 'open')
  const recentResolved = filteredIncidents
    .filter((i) => i.status === 'resolved')
    .slice(0, 10)

  async function resolveIncident(host_id: string, deploy_id: string): Promise<void> {
    const key = `${host_id}:${deploy_id}`
    setResolvingKey(key)
    try {
      const res = await fetch(`/api/infra/watchdog/incidents/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ host_id, deploy_id }),
      })
      if (!res.ok) throw new Error(`Resolve failed: ${res.status}`)
      // Optimistic update — realtime will also pick this up
      setIncidents((prev) =>
        prev.map((i) =>
          i.host_id === host_id && i.deploy_id === deploy_id
            ? { ...i, status: 'resolved' as const, resolved_at: new Date().toISOString() }
            : i
        )
      )
    } catch (err) {
      console.error(err)
      alert(err instanceof Error ? err.message : 'Resolve failed')
    } finally {
      setResolvingKey(null)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] uppercase tracking-wider text-white/40">Filter host:</span>
        {hosts.map((h) => {
          const cfg = h === 'all' ? null : hostLabels[h]
          const label = h === 'all' ? 'Alle' : cfg?.label ?? h
          const active = hostFilter === h
          return (
            <button
              key={h}
              type="button"
              onClick={() => setHostFilter(h)}
              className={clsx(
                'px-2.5 py-1 rounded-md text-[11px] font-medium border transition',
                active
                  ? 'bg-white/15 border-white/30 text-white'
                  : 'bg-white/[0.04] border-white/10 text-white/60 hover:bg-white/[0.08]'
              )}
            >
              {label}
            </button>
          )
        })}
      </div>

      <section>
        <h2 className="text-xs uppercase tracking-wider text-white/40 mb-2 flex items-center gap-2">
          <Siren size={11} className="text-red-400" />
          Open incidents ({openIncidents.length})
        </h2>
        {openIncidents.length === 0 ? (
          <div className="bg-green-500/[0.04] border border-green-500/15 rounded-xl p-4 flex items-center gap-3">
            <CheckCircle size={14} className="text-green-400" />
            <p className="text-xs text-green-300/80">Geen open incidents. Fleet is gezond.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {openIncidents.map((i) => {
              const key = `${i.host_id}:${i.deploy_id}`
              const expanded = expandedIncident === key
              const hostCfg = hostLabels[i.host_id] ?? { label: i.host_id, color: 'text-white/60 bg-white/5' }
              return (
                <div key={key} className="bg-red-500/[0.04] border border-red-500/20 rounded-xl overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setExpandedIncident(expanded ? null : key)}
                    className="w-full p-3 flex items-start gap-3 text-left hover:bg-red-500/[0.06]"
                  >
                    {expanded ? (
                      <ChevronDown size={14} className="text-white/40 mt-0.5" />
                    ) : (
                      <ChevronRight size={14} className="text-white/40 mt-0.5" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${hostCfg.color}`}>
                          {hostCfg.label}
                        </span>
                        <span className="font-mono text-sm text-white">{i.service_name}</span>
                        <span className="text-[10px] text-white/40 uppercase tracking-wider">{i.service_type}</span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-red-500/15 text-red-300 font-medium">
                          {i.failure_kind}
                        </span>
                      </div>
                      <p className="text-xs text-white/70 mt-1 truncate">
                        {i.failure_summary ?? '(no summary)'}
                      </p>
                      <p className="text-[10px] text-white/40 mt-1 flex items-center gap-2">
                        <Clock size={9} />
                        {timeAgo(i.opened_at)} geleden · {i.attempts_made} recovery-pogingen
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={resolvingKey === key}
                      onClick={(e) => {
                        e.stopPropagation()
                        void resolveIncident(i.host_id, i.deploy_id)
                      }}
                      className="px-2.5 py-1 rounded-md bg-white/10 hover:bg-white/15 text-[11px] text-white/80 disabled:opacity-50"
                    >
                      {resolvingKey === key ? 'Resolving…' : 'Resolve'}
                    </button>
                  </button>
                  {expanded && (
                    <div className="border-t border-red-500/15 p-3 space-y-3 bg-black/20">
                      {i.commit_message && (
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-white/40 mb-1">Commit</p>
                          <p className="text-xs text-white/80 font-mono">
                            {i.commit_sha?.slice(0, 7)} {i.commit_message}
                          </p>
                        </div>
                      )}
                      {i.proposed_actions && i.proposed_actions.length > 0 && (
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-white/40 mb-1">Voorgestelde acties</p>
                          <ul className="space-y-1">
                            {i.proposed_actions.map((a, idx) => (
                              <li key={idx} className="text-xs text-white/70 flex items-start gap-2">
                                <span className="text-white/30 mt-0.5">→</span>
                                <span className="font-mono break-all">{a}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {i.logs_tail && (
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-white/40 mb-1">Log tail</p>
                          <pre className="text-[10px] text-white/60 bg-black/40 rounded p-2 overflow-x-auto max-h-64 font-mono">
                            {i.logs_tail}
                          </pre>
                        </div>
                      )}
                      <div className="flex gap-2 text-[11px]">
                        {i.host_id === 'render' && (
                          <a
                            href={`https://dashboard.render.com/web/${i.service_id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-white/70 flex items-center gap-1"
                          >
                            Render dashboard <ExternalLink size={10} />
                          </a>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-xs uppercase tracking-wider text-white/40 mb-2 flex items-center gap-2">
          <Clock size={11} className="text-white/40" />
          Recente events ({filteredEvents.length})
        </h2>
        <div className="bg-white/[0.04] border border-white/10 rounded-xl overflow-hidden">
          <div className="max-h-[480px] overflow-y-auto divide-y divide-white/5">
            {filteredEvents.slice(0, 80).map((e) => {
              const cfg = EVENT_KIND_CFG[e.kind] ?? EVENT_KIND_CFG.check_error
              const Icon = cfg.icon
              const hostCfg = hostLabels[e.host_id] ?? { label: e.host_id, color: 'text-white/60 bg-white/5' }
              return (
                <div key={e.id} className="px-3 py-2 flex items-start gap-3 hover:bg-white/[0.02]">
                  <span className={clsx('flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium w-[88px] justify-center', cfg.color)}>
                    <Icon size={9} />
                    {cfg.label}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className={`px-1 py-0 rounded text-[9px] ${hostCfg.color}`}>{hostCfg.label}</span>
                      <span className="font-mono text-xs text-white">{e.service_name}</span>
                      {e.attempt !== null && (
                        <span className="text-[10px] text-white/40">attempt {e.attempt}</span>
                      )}
                      {e.deploy_status && (
                        <span className="text-[10px] text-white/40">{e.deploy_status}</span>
                      )}
                    </div>
                    {e.message && <p className="text-[11px] text-white/60 truncate mt-0.5">{e.message}</p>}
                  </div>
                  <span className="text-[10px] text-white/40 whitespace-nowrap">{timeAgo(e.created_at)}</span>
                </div>
              )
            })}
            {filteredEvents.length === 0 && (
              <div className="p-6 text-center text-xs text-white/40">Geen events</div>
            )}
          </div>
        </div>
      </section>

      {recentResolved.length > 0 && (
        <section>
          <h2 className="text-xs uppercase tracking-wider text-white/40 mb-2 flex items-center gap-2">
            <CheckCircle size={11} className="text-green-400" />
            Recent gesloten ({recentResolved.length})
          </h2>
          <div className="bg-white/[0.04] border border-white/10 rounded-xl divide-y divide-white/5">
            {recentResolved.map((i) => {
              const hostCfg = hostLabels[i.host_id] ?? { label: i.host_id, color: 'text-white/60 bg-white/5' }
              return (
                <div key={`${i.host_id}:${i.deploy_id}`} className="px-3 py-2 flex items-center gap-3">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] ${hostCfg.color}`}>{hostCfg.label}</span>
                  <span className="font-mono text-xs text-white/80">{i.service_name}</span>
                  <span className="text-[10px] text-white/40">{i.failure_kind}</span>
                  <span className="text-[10px] text-white/40 ml-auto">
                    {i.resolved_at ? `${timeAgo(i.resolved_at)} ago` : ''}
                  </span>
                </div>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}
