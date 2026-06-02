import { Terminal, Activity, Bot, Cpu } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import SessionsClient, { type SessionRow } from './SessionsClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const ACTIVE_MS = 120_000

type StateRow = {
  host: string | null
  session_id: string
  phase: string | null
  cwd: string | null
  project: string | null
  last_event: string | null
  last_prompt_text: string | null
  last_event_at: string | null
}

type ApRow = { scope: string; scope_id: string; live: boolean }

export default async function SessionsPage() {
  const supabase = await createClient()

  const [{ data: stateData }, { data: apData }, { data: cfg }] = await Promise.all([
    supabase.schema('hermes').from('claude_session_state')
      .select('host, session_id, phase, cwd, project, last_event, last_prompt_text, last_event_at')
      .order('last_event_at', { ascending: false, nullsFirst: false })
      .limit(100),
    supabase.schema('hermes').from('autopilot_state').select('scope, scope_id, live'),
    supabase.from('hermes_config').select('value').eq('key', 'autopilot_trusted_hosts').maybeSingle(),
  ])

  const states = (stateData ?? []) as StateRow[]
  const ap = (apData ?? []) as ApRow[]
  const trusted = String(cfg?.value ?? '').toLowerCase().split(',').map((s) => s.trim()).filter(Boolean)

  const sessionFlag = new Map(ap.filter((r) => r.scope === 'session').map((r) => [r.scope_id, r.live]))
  const hostFlag = new Map(ap.filter((r) => r.scope === 'host').map((r) => [r.scope_id, r.live]))
  const globalRow = ap.find((r) => r.scope === 'global')
  const globalLive = globalRow ? globalRow.live : null

  const effective = (host: string | null, session: string): { on: boolean; source: string } => {
    if (sessionFlag.has(session)) return { on: !!sessionFlag.get(session), source: 'tab' }
    if (host && hostFlag.has(host)) return { on: !!hostFlag.get(host), source: 'machine' }
    if (globalLive !== null) return { on: globalLive, source: 'globaal' }
    if (host && trusted.includes(host.toLowerCase())) return { on: true, source: 'default (vertrouwd)' }
    return { on: false, source: 'default' }
  }

  const now = Date.now()
  const rows: SessionRow[] = states.map((s) => {
    const ageMs = s.last_event_at ? now - new Date(s.last_event_at).getTime() : Infinity
    const eff = effective(s.host, s.session_id)
    const status =
      s.phase === 'waiting' || s.last_event === 'Notification' ? 'wacht op input'
        : ageMs < ACTIVE_MS ? 'actief'
          : 'idle'
    return {
      host: s.host ?? 'onbekend',
      session_id: s.session_id,
      project: s.project ?? (s.cwd ? s.cwd.split('/').pop() ?? '—' : '—'),
      cwd: s.cwd ?? '',
      status,
      last_event: s.last_event ?? '—',
      last_prompt: (s.last_prompt_text ?? '').slice(0, 80),
      last_event_at: s.last_event_at,
      autopilot_on: eff.on,
      autopilot_source: eff.source,
      session_override: sessionFlag.has(s.session_id) ? !!sessionFlag.get(s.session_id) : null,
    }
  })

  const hosts = Array.from(new Set(rows.map((r) => r.host).filter((h) => h !== 'onbekend')))
  const hostStates = hosts.map((h) => ({
    host: h,
    override: hostFlag.has(h) ? !!hostFlag.get(h) : null,
    trusted: trusted.includes(h.toLowerCase()),
  }))

  const kpis = [
    { label: 'Sessies', value: rows.length, icon: Terminal, color: 'text-sky-400' },
    { label: 'Actief', value: rows.filter((r) => r.status === 'actief').length, icon: Activity, color: 'text-emerald-400' },
    { label: 'Wacht op input', value: rows.filter((r) => r.status === 'wacht op input').length, icon: Cpu, color: 'text-amber-400' },
    { label: 'Autopilot aan', value: rows.filter((r) => r.autopilot_on).length, icon: Bot, color: 'text-violet-400' },
  ]

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center">
          <Terminal size={16} className="text-sky-400" />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-white">Sessies</h1>
          <p className="text-xs text-white/50">Alle Claude Code-sessies live — auto Hermes per tab/machine + ga verder.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
            <div className="flex items-center gap-2">
              <k.icon size={14} className={k.color} />
              <span className="text-xs text-white/50">{k.label}</span>
            </div>
            <div className="mt-1 text-2xl font-semibold text-white">{k.value}</div>
          </div>
        ))}
      </div>

      <SessionsClient
        rows={rows}
        hosts={hostStates}
        globalLive={globalLive}
      />
    </div>
  )
}
