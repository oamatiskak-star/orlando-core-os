import { createClient } from '@/lib/supabase/server'
import { Activity, Globe, HeartPulse, Layers, Database, Clock } from 'lucide-react'

export type CheckStatus = {
  id: string
  slug: string
  display_name: string
  check_type: 'http_ping' | 'heartbeat' | 'queue_depth' | 'data_freshness' | 'cron_lateness'
  layer: string
  category: string | null
  severity: 'warning' | 'error' | 'critical'
  interval_seconds: number
  enabled: boolean
  notes: string | null
  last_ok: boolean | null
  last_latency_ms: number | null
  last_value: number | null
  last_message: string | null
  last_run_at: string | null
}

const TYPE_META: Record<
  CheckStatus['check_type'],
  { label: string; icon: typeof Activity; hint: string }
> = {
  http_ping: { label: 'Engine endpoints', icon: Globe, hint: 'HTTP /health pings' },
  heartbeat: { label: 'Worker heartbeats', icon: HeartPulse, hint: 'Background workers self-report liveness' },
  cron_lateness: { label: 'Vercel crons', icon: Clock, hint: 'Scheduled functions must fire on time' },
  queue_depth: { label: 'Work queues', icon: Layers, hint: 'Pending task backlog & age' },
  data_freshness: { label: 'Data freshness', icon: Database, hint: 'Tables must keep receiving rows' },
}

const ORDER: CheckStatus['check_type'][] = ['http_ping', 'heartbeat', 'cron_lateness', 'queue_depth', 'data_freshness']

function timeAgo(iso: string | null): string {
  if (!iso) return 'nooit'
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return `${s}s`
  if (s < 3600) return `${Math.floor(s / 60)}m`
  if (s < 86400) return `${Math.floor(s / 3600)}u`
  return `${Math.floor(s / 86400)}d`
}

function dotColor(c: CheckStatus): string {
  if (c.last_ok === null) return 'bg-white/25'
  if (c.last_ok) return 'bg-emerald-400'
  if (c.severity === 'critical') return 'bg-red-500'
  if (c.severity === 'error') return 'bg-red-400'
  return 'bg-amber-400'
}

export default async function OrganizationChecks() {
  const supabase = await createClient()

  const { data: checksData } = await supabase
    .from('infra_watchdog_check_status')
    .select('*')
    .eq('enabled', true)

  const checks = (checksData ?? []) as CheckStatus[]

  if (checks.length === 0) {
    return (
      <div className="bg-white/[0.04] border border-white/5 rounded-xl p-5 text-sm text-white/50">
        Nog geen organization-checks geregistreerd. Run migratie 092/093.
      </div>
    )
  }

  const total = checks.length
  const failing = checks.filter((c) => c.last_ok === false)
  const ok = checks.filter((c) => c.last_ok === true).length
  const pending = checks.filter((c) => c.last_ok === null).length

  const byType = new Map<CheckStatus['check_type'], CheckStatus[]>()
  for (const c of checks) {
    const arr = byType.get(c.check_type) ?? []
    arr.push(c)
    byType.set(c.check_type, arr)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center">
          <Activity size={15} className="text-sky-400" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-white">Organisatie-checks · applicatie & workflow laag</h2>
          <p className="text-[11px] text-white/45">
            {ok} groen · {failing.length} rood · {pending} wachtend — totaal {total} checks
          </p>
        </div>
      </div>

      {failing.length > 0 && (
        <div className="bg-red-500/[0.06] border border-red-500/20 rounded-xl p-4">
          <p className="text-[11px] uppercase tracking-wider text-red-300/70 mb-2">
            {failing.length} checks falen nu
          </p>
          <div className="space-y-1.5">
            {failing
              .sort((a, b) => {
                const w = { critical: 0, error: 1, warning: 2 } as const
                return w[a.severity] - w[b.severity]
              })
              .map((c) => (
                <div key={c.id} className="flex items-start gap-2 text-xs">
                  <span className={`mt-1 w-1.5 h-1.5 rounded-full shrink-0 ${dotColor(c)}`} />
                  <span className="text-white/80 font-medium shrink-0">{c.display_name}</span>
                  <span className="text-white/40 truncate">{c.last_message ?? ''}</span>
                </div>
              ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {ORDER.filter((t) => byType.has(t)).map((type) => {
          const meta = TYPE_META[type]
          const Icon = meta.icon
          const list = (byType.get(type) ?? []).sort((a, b) => a.slug.localeCompare(b.slug))
          const groupFail = list.filter((c) => c.last_ok === false).length
          return (
            <div key={type} className="bg-white/[0.04] border border-white/5 rounded-xl overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/5 bg-white/[0.02]">
                <Icon size={13} className="text-white/50" />
                <span className="text-xs font-medium text-white/80">{meta.label}</span>
                <span className="text-[10px] text-white/35">{meta.hint}</span>
                <span className="ml-auto text-[10px] text-white/40">
                  {groupFail > 0 ? <span className="text-red-400">{groupFail} rood</span> : <span className="text-emerald-400">alle ok</span>}
                </span>
              </div>
              <div className="divide-y divide-white/[0.04]">
                {list.map((c) => (
                  <div key={c.id} className="flex items-center gap-2.5 px-4 py-2" title={c.last_message ?? ''}>
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColor(c)}`} />
                    <span className="text-xs text-white/75 truncate">{c.display_name}</span>
                    <span className="ml-auto flex items-center gap-3 shrink-0 text-[10px] text-white/40">
                      {c.last_latency_ms != null && <span>{c.last_latency_ms}ms</span>}
                      {c.last_value != null && c.check_type !== 'cron_lateness' && <span>{c.last_value}</span>}
                      <span className="tabular-nums">{timeAgo(c.last_run_at)}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
