import { createClient } from '@/lib/supabase/server'
import { Shield, AlertTriangle, CheckCircle, Activity, RefreshCw, Hammer, Siren } from 'lucide-react'
import WatchdogClient from './WatchdogClient'
import OrganizationChecks from './OrganizationChecks'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export type WatchdogIncident = {
  host_id: string
  deploy_id: string
  service_id: string
  service_name: string
  service_type: string
  failure_kind: string
  failure_summary: string | null
  logs_tail: string | null
  commit_sha: string | null
  commit_message: string | null
  attempts_made: number
  proposed_actions: string[] | null
  status: 'open' | 'acknowledged' | 'resolved'
  opened_at: string
  resolved_at: string | null
}

export type WatchdogEvent = {
  id: string
  host_id: string
  service_id: string
  service_name: string
  service_type: string
  kind: 'fail_detected' | 'restart_triggered' | 'redeploy_triggered' | 'rebuild_triggered' | 'recovered' | 'escalated' | 'check_error'
  deploy_id: string | null
  deploy_status: string | null
  attempt: number | null
  message: string | null
  logs_tail: string | null
  metadata: Record<string, unknown> | null
  created_at: string
}

const HOST_LABELS: Record<string, { label: string; color: string }> = {
  render: { label: 'Render Cloud', color: 'text-violet-400 bg-violet-500/10 border-violet-500/20' },
  'cli-r': { label: 'CLI-R (Mac Mini)', color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20' },
  'cli-l': { label: 'CLI-L (Mac Mini)', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
}

export default async function WatchdogPage() {
  const supabase = await createClient()

  const [{ data: incidentsData }, { data: eventsData }] = await Promise.all([
    supabase
      .from('infra_watchdog_incidents')
      .select('*')
      .order('opened_at', { ascending: false })
      .limit(100),
    supabase
      .from('infra_watchdog_events')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200),
  ])

  const incidents = (incidentsData ?? []) as WatchdogIncident[]
  const events = (eventsData ?? []) as WatchdogEvent[]

  const openIncidents = incidents.filter((i) => i.status === 'open')
  const last24h = Date.now() - 24 * 60 * 60 * 1000
  const events24h = events.filter((e) => new Date(e.created_at).getTime() > last24h)
  const recoveries24h = events24h.filter((e) => e.kind === 'recovered').length
  const failures24h = events24h.filter((e) => e.kind === 'fail_detected').length
  const escalations24h = events24h.filter((e) => e.kind === 'escalated').length

  const hostsSet = new Set<string>()
  for (const e of events) hostsSet.add(e.host_id)
  for (const i of incidents) hostsSet.add(i.host_id)
  const hosts = Array.from(hostsSet).sort()

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
          <Shield size={16} className="text-rose-400" />
        </div>
        <div>
          <h1 className="text-base font-semibold text-white">Watchdog · Self-healing fleet</h1>
          <p className="text-xs text-white/50">
            Auto-recovery monitor voor Render services en lokale PM2 workers (CLI-R + CLI-L)
          </p>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
          <span className="text-[11px] text-white/45">Realtime</span>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Open incidents', value: openIncidents.length, color: openIncidents.length > 0 ? 'text-red-400' : 'text-white/40', icon: Siren },
          { label: 'Failures 24u', value: failures24h, color: failures24h > 0 ? 'text-amber-400' : 'text-white/40', icon: AlertTriangle },
          { label: 'Recoveries 24u', value: recoveries24h, color: 'text-green-400', icon: CheckCircle },
          { label: 'Escalaties 24u', value: escalations24h, color: escalations24h > 0 ? 'text-red-400' : 'text-white/40', icon: Hammer },
          { label: 'Hosts', value: hosts.length, color: 'text-violet-400', icon: Activity },
        ].map((s) => {
          const Icon = s.icon
          return (
            <div key={s.label} className="bg-white/[0.06] border border-white/5 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <Icon size={12} className={s.color} />
                <p className="text-[10px] text-white/50">{s.label}</p>
              </div>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            </div>
          )
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] uppercase tracking-wider text-white/40">Actieve hosts:</span>
        {hosts.length === 0 ? (
          <span className="text-xs text-white/40">geen activiteit gezien</span>
        ) : (
          hosts.map((h) => {
            const cfg = HOST_LABELS[h] ?? { label: h, color: 'text-white/60 bg-white/5 border-white/10' }
            return (
              <span key={h} className={`px-2 py-1 rounded-md text-[11px] font-medium border ${cfg.color}`}>
                {cfg.label}
              </span>
            )
          })
        )}
      </div>

      <OrganizationChecks />

      <WatchdogClient initialIncidents={incidents} initialEvents={events} hostLabels={HOST_LABELS} />
    </div>
  )
}
