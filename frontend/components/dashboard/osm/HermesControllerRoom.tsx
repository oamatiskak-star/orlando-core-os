import { Shield, Activity, AlertTriangle, Zap, Clock, Bot, ArrowUpRight, Terminal, ScrollText } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

type HermesStats = {
  logs_24h: number
  errors_24h: number
  warns_24h: number
  last_log_at: string | null
  active_sessions: number
  total_sessions: number
  waiting_sessions: number
  autopilot_on: number
}

async function getHermesStats(): Promise<HermesStats> {
  try {
    const supabase = await createClient()
    const since = new Date(Date.now() - 86_400_000).toISOString()
    const h = () => supabase.schema('hermes')

    const [
      { count: logs24 },
      { count: errors24 },
      { count: warns24 },
      { data: lastLog },
      { data: sessions },
      { data: autopilot },
    ] = await Promise.all([
      h().from('logs').select('*', { count: 'exact', head: true }).gte('created_at', since),
      h().from('logs').select('*', { count: 'exact', head: true }).eq('level', 'error').gte('created_at', since),
      h().from('logs').select('*', { count: 'exact', head: true }).eq('level', 'warn').gte('created_at', since),
      h().from('logs').select('created_at').order('created_at', { ascending: false }).limit(1),
      h().from('claude_session_state').select('phase, last_event_at, last_event'),
      h().from('autopilot_state').select('live'),
    ])

    const now = Date.now()
    const sess = (sessions ?? []) as { phase: string | null; last_event_at: string | null; last_event: string | null }[]
    const active = sess.filter((s) => s.last_event_at && now - new Date(s.last_event_at).getTime() < 120_000 && s.phase === 'working').length
    const waiting = sess.filter((s) => s.phase === 'waiting_input' || s.last_event === 'Notification').length
    const apOn = ((autopilot ?? []) as { live: boolean }[]).filter((a) => a.live).length

    return {
      logs_24h: logs24 ?? 0,
      errors_24h: errors24 ?? 0,
      warns_24h: warns24 ?? 0,
      last_log_at: (lastLog?.[0] as { created_at?: string } | undefined)?.created_at ?? null,
      active_sessions: active,
      total_sessions: sess.length,
      waiting_sessions: waiting,
      autopilot_on: apOn,
    }
  } catch (error) {
    console.error('Error fetching Hermes stats:', error)
    return { logs_24h: 0, errors_24h: 0, warns_24h: 0, last_log_at: null, active_sessions: 0, total_sessions: 0, waiting_sessions: 0, autopilot_on: 0 }
  }
}

function ageSeconds(iso: string | null): number {
  if (!iso) return Infinity
  return Math.round((Date.now() - new Date(iso).getTime()) / 1000)
}

function ago(iso: string | null): string {
  const s = ageSeconds(iso)
  if (!isFinite(s)) return '—'
  if (s < 60) return `${s}s`
  if (s < 3600) return `${Math.round(s / 60)}m`
  return `${Math.round(s / 3600)}u`
}

export default async function HermesControllerRoom() {
  const stats = await getHermesStats()

  // Health = leeft Hermes? (verse log) — niet de hoeveelheid errors, want Hermes logt
  // juist de errors die het opvangt. Vers < 5min = gezond, < 15min = monitoring, anders alert.
  const freshness = ageSeconds(stats.last_log_at)
  const health = freshness < 300
    ? { score: 100, bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20', label: '🟢 Live', status: 'Online' }
    : freshness < 900
      ? { score: 70, bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20', label: '🟡 Monitoring', status: 'Vertraagd' }
      : { score: 25, bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/20', label: '🔴 Stil', status: 'Geen signaal' }

  return (
    <div className="bg-gradient-to-br from-white/[0.08] to-white/[0.04] border border-white/10 rounded-xl p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg border border-cyan-500/30 bg-cyan-500/10 flex items-center justify-center">
            <Shield size={20} className="text-cyan-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">🤖 Hermes Controller Room</h2>
            <p className="text-xs text-white/50 mt-0.5">Live bewaking · logs, sessies & autopilot</p>
          </div>
        </div>
        <Link
          href="/dashboard/operations/hermes"
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 hover:bg-cyan-500/20 transition-colors text-xs font-medium"
        >
          <Zap size={12} />
          Command Center
        </Link>
      </div>

      {/* Health / liveness */}
      <div className={`rounded-lg border ${health.bg} ${health.border} p-4`}>
        <div className="flex items-center justify-between">
          <div>
            <span className={`text-sm font-semibold ${health.text}`}>{health.label}</span>
            <p className="text-[11px] text-white/45 mt-0.5">laatste log {ago(stats.last_log_at)} geleden</p>
          </div>
          <span className={`text-2xl font-bold ${health.text}`}>{health.status}</span>
        </div>
      </div>

      {/* Stats Grid — echte data */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white/[0.03] border border-white/5 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <ScrollText size={14} className="text-cyan-400" />
            <span className="text-xs font-mono text-white/50">24U</span>
          </div>
          <p className="text-2xl font-bold text-white">{stats.logs_24h.toLocaleString('nl-NL')}</p>
          <p className="text-xs text-white/50 mt-1">Logs (24u)</p>
        </div>

        <div className="bg-white/[0.03] border border-white/5 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <AlertTriangle size={14} className={stats.errors_24h > 0 ? 'text-red-400' : 'text-white/30'} />
            <span className="text-xs font-mono text-white/50">24U</span>
          </div>
          <p className="text-2xl font-bold text-white">{stats.errors_24h.toLocaleString('nl-NL')}</p>
          <p className="text-xs text-white/50 mt-1">Errors · {stats.warns_24h.toLocaleString('nl-NL')} warns</p>
        </div>

        <div className="bg-white/[0.03] border border-white/5 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <Terminal size={14} className={stats.active_sessions > 0 ? 'text-emerald-400' : 'text-white/30'} />
            <span className="text-xs font-mono text-white/50">NU</span>
          </div>
          <p className="text-2xl font-bold text-white">{stats.active_sessions}<span className="text-sm text-white/40">/{stats.total_sessions}</span></p>
          <p className="text-xs text-white/50 mt-1">Actieve sessies</p>
        </div>

        <div className="bg-white/[0.03] border border-white/5 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <Bot size={14} className={stats.autopilot_on > 0 ? 'text-violet-400' : 'text-white/30'} />
            <span className="text-xs font-mono text-white/50">AUTO</span>
          </div>
          <p className="text-2xl font-bold text-white">{stats.autopilot_on}</p>
          <p className="text-xs text-white/50 mt-1">Autopilot aan</p>
        </div>
      </div>

      {/* Indicatoren */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-white/[0.02] border border-white/5 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <Activity size={12} className="text-cyan-400" />
            <span className="text-xs font-semibold text-white">Hermes hartslag</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className={`text-xl font-bold ${health.text}`}>{ago(stats.last_log_at)}</span>
            <span className="text-[10px] text-white/40">sinds laatste log</span>
          </div>
        </div>

        <div className="bg-white/[0.02] border border-white/5 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <Clock size={12} className="text-amber-400" />
            <span className="text-xs font-semibold text-white">Wacht op input</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className={`text-xl font-bold ${stats.waiting_sessions > 0 ? 'text-amber-400' : 'text-white/50'}`}>{stats.waiting_sessions}</span>
            <span className="text-[10px] text-white/40">sessie(s)</span>
          </div>
        </div>

        <div className="bg-white/[0.02] border border-white/5 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <Zap size={12} className="text-emerald-400" />
            <span className="text-xs font-semibold text-white">Systeemstatus</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className={`text-xl font-bold ${health.text}`}>{health.status}</span>
          </div>
        </div>
      </div>

      {/* Quick Commands */}
      <div className="space-y-2 pt-2 border-t border-white/5">
        <p className="text-xs font-semibold text-white/70 uppercase tracking-wider">Snelle acties</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          <Link href="/dashboard/operations/hermes" className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-xs text-white/70 hover:text-white/90 group">
            <Shield size={11} className="text-cyan-400 group-hover:text-cyan-300" />
            Hermes monitoren
            <ArrowUpRight size={9} className="ml-auto text-white/30 group-hover:text-white/50" />
          </Link>
          <Link href="/dashboard/sessions" className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-xs text-white/70 hover:text-white/90 group">
            <Terminal size={11} className="text-emerald-400 group-hover:text-emerald-300" />
            Sessies
            <ArrowUpRight size={9} className="ml-auto text-white/30 group-hover:text-white/50" />
          </Link>
          <Link href="/dashboard/operations/errors" className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-xs text-white/70 hover:text-white/90 group">
            <AlertTriangle size={11} className="text-red-400 group-hover:text-red-300" />
            Fouten bekijken
            <ArrowUpRight size={9} className="ml-auto text-white/30 group-hover:text-white/50" />
          </Link>
        </div>
      </div>

      {/* Note */}
      <div className="bg-white/[0.02] border border-cyan-500/20 rounded-lg p-3 text-[11px] text-white/60 space-y-1">
        <p className="font-semibold text-cyan-400">🔬 Hermes Intelligence</p>
        <p>• Centrale logbewaking over alle entiteiten (hermes.logs)</p>
        <p>• Live Claude Code-sessies + autopilot-status</p>
        <p>• Alleen kritiek escaleert naar Telegram — rest stil in de logs</p>
      </div>
    </div>
  )
}
