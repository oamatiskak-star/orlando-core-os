import { Activity, CheckCircle, XCircle, AlertTriangle, Clock } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import clsx from 'clsx'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function isOnline(lastHeartbeat: string | null, thresholdSec = 300) {
  if (!lastHeartbeat) return false
  return (Date.now() - new Date(lastHeartbeat).getTime()) < thresholdSec * 1000
}

function fmtTime(ts: string | null) {
  if (!ts) return '—'
  const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 1000)
  if (diff < 60) return `${diff}s geleden`
  if (diff < 3600) return `${Math.floor(diff / 60)}m geleden`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h geleden`
  return new Date(ts).toLocaleDateString('nl-NL', { day: '2-digit', month: 'short' })
}

function uptime(seconds: number | null) {
  if (!seconds) return '—'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return `${h}h ${m}m`
}

const LEVEL_BADGE: Record<string, string> = {
  info:    'bg-sky-500/10 text-sky-400',
  warning: 'bg-amber-500/10 text-amber-400',
  error:   'bg-red-500/10 text-red-400',
  success: 'bg-green-500/10 text-green-400',
}

const LEVEL_LABELS: Record<string, string> = {
  info: 'INFO', warning: 'WARN', error: 'ERR', success: 'OK',
}

export default async function HealthPage() {
  const supabase = await createClient()

  const [
    { data: workers },
    { data: aiEngines },
    { data: logs },
  ] = await Promise.all([
    supabase.from('worker_registry')
      .select('id, display_name, status, last_heartbeat, uptime_seconds, tasks_today, cpu_percent, ram_mb, last_error')
      .order('display_name', { ascending: true }),
    supabase.from('ai_worker_status')
      .select('id, engine, online, loaded_model, response_ms, requests_today, last_error, updated_at')
      .order('engine', { ascending: true }),
    supabase.from('agent_logs')
      .select('id, level, message, created_at')
      .order('created_at', { ascending: false })
      .limit(12),
  ])

  const workerRows  = workers  ?? []
  const engineRows  = aiEngines ?? []
  const logRows     = logs     ?? []

  const workersOnline = workerRows.filter(w => isOnline(w.last_heartbeat)).length
  const enginesOnline = engineRows.filter(e => e.online).length
  const tasksToday    = workerRows.reduce((s, w) => s + (w.tasks_today ?? 0), 0)

  const hasWarning = workerRows.some(w => !isOnline(w.last_heartbeat)) || engineRows.some(e => !e.online)
  const allOffline = workerRows.length > 0 && workersOnline === 0

  const overallLabel = allOffline ? 'Kritiek' : hasWarning ? 'Waarschuwingen' : 'Alles operationeel'
  const overallClass = allOffline ? 'bg-red-500/10 text-red-400' : hasWarning ? 'bg-amber-500/10 text-amber-400' : 'bg-green-500/10 text-green-400'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-lime-500/10 border border-lime-500/20 flex items-center justify-center">
            <Activity size={16} className="text-lime-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-semibold text-white">System Health</h1>
              <span className={clsx('px-2 py-0.5 rounded-full text-[10px] font-semibold', overallClass)}>
                {overallLabel}
              </span>
            </div>
            <p className="text-xs text-white/50">Status van workers, AI-engines en recente agent-events.</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Workers online',   value: `${workersOnline}/${workerRows.length}`,  color: workersOnline > 0 ? 'text-green-400' : 'text-red-400' },
          { label: 'AI Engines online', value: `${enginesOnline}/${engineRows.length}`, color: enginesOnline > 0 ? 'text-green-400' : 'text-red-400' },
          { label: 'Taken vandaag',    value: String(tasksToday),                        color: 'text-indigo-400' },
          { label: 'Log events',       value: String(logRows.length),                    color: 'text-white/70' },
        ].map((s) => (
          <div key={s.label} className="bg-white/[0.06] border border-white/5 rounded-xl p-4">
            <p className="text-[11px] text-white/50 mb-1">{s.label}</p>
            <p className={clsx('text-xl font-semibold', s.color)}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Workers */}
      {workerRows.length > 0 && (
        <div className="bg-white/[0.06] border border-white/5 rounded-xl">
          <div className="px-5 py-4 border-b border-white/5">
            <h2 className="text-sm font-semibold text-white">Workers</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-4">
            {workerRows.map((w) => {
              const online = isOnline(w.last_heartbeat)
              return (
                <div key={w.id} className={clsx(
                  'bg-white/[0.04] border rounded-xl p-4',
                  online ? 'border-white/5' : 'border-red-500/20'
                )}>
                  <div className="flex items-center gap-2 mb-3">
                    {online
                      ? <CheckCircle size={13} className="text-green-400 flex-shrink-0" />
                      : <XCircle size={13} className="text-red-400 flex-shrink-0" />
                    }
                    <p className="text-xs font-semibold text-white truncate">{w.display_name}</p>
                    <span className={clsx('ml-auto px-2 py-0.5 rounded-full text-[10px] font-medium flex-shrink-0',
                      online ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                    )}>
                      {online ? 'Online' : 'Offline'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <p className="text-white/40">CPU</p>
                      <p className="text-white/70">{w.cpu_percent != null ? `${w.cpu_percent}%` : '—'}</p>
                    </div>
                    <div>
                      <p className="text-white/40">RAM</p>
                      <p className="text-white/70">{w.ram_mb != null ? `${w.ram_mb} MB` : '—'}</p>
                    </div>
                    <div>
                      <p className="text-white/40">Uptime</p>
                      <p className="text-white/70">{uptime(w.uptime_seconds)}</p>
                    </div>
                    <div>
                      <p className="text-white/40">Taken</p>
                      <p className="text-white/70">{w.tasks_today ?? 0}</p>
                    </div>
                  </div>
                  {w.last_error && (
                    <p className="mt-2 text-[10px] text-red-400 truncate">{w.last_error}</p>
                  )}
                  <p className="mt-2 text-[10px] text-white/30 flex items-center gap-1">
                    <Clock size={9} /> {fmtTime(w.last_heartbeat)}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* AI Engines */}
      {engineRows.length > 0 && (
        <div className="bg-white/[0.06] border border-white/5 rounded-xl">
          <div className="px-5 py-4 border-b border-white/5">
            <h2 className="text-sm font-semibold text-white">AI Engines</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-4">
            {engineRows.map((e) => (
              <div key={e.id} className={clsx(
                'bg-white/[0.04] border rounded-xl p-4',
                e.online ? 'border-white/5' : 'border-amber-500/20'
              )}>
                <div className="flex items-center gap-2 mb-3">
                  {e.online
                    ? <CheckCircle size={13} className="text-green-400 flex-shrink-0" />
                    : <AlertTriangle size={13} className="text-amber-400 flex-shrink-0" />
                  }
                  <p className="text-xs font-semibold text-white truncate">{e.engine}</p>
                  <span className={clsx('ml-auto px-2 py-0.5 rounded-full text-[10px] font-medium flex-shrink-0',
                    e.online ? 'bg-green-500/10 text-green-400' : 'bg-amber-500/10 text-amber-400'
                  )}>
                    {e.online ? 'Online' : 'Standby'}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <p className="text-white/40">Response</p>
                    <p className="text-white/70">{e.response_ms != null ? `${e.response_ms}ms` : '—'}</p>
                  </div>
                  <div>
                    <p className="text-white/40">Requests</p>
                    <p className="text-white/70">{e.requests_today ?? 0}</p>
                  </div>
                </div>
                {e.loaded_model && (
                  <p className="mt-2 text-[10px] text-white/40 truncate">{e.loaded_model}</p>
                )}
                {e.last_error && (
                  <p className="mt-1 text-[10px] text-red-400 truncate">{e.last_error}</p>
                )}
                <p className="mt-2 text-[10px] text-white/30 flex items-center gap-1">
                  <Clock size={9} /> {fmtTime(e.updated_at)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {workerRows.length === 0 && engineRows.length === 0 && (
        <div className="bg-white/[0.06] border border-white/5 rounded-xl p-10 flex flex-col items-center gap-3">
          <Activity size={28} className="text-white/20" />
          <p className="text-xs text-white/40">Geen workers of engines geregistreerd</p>
          <p className="text-[11px] text-white/30">Zodra workers verbinden met Supabase verschijnen ze hier.</p>
        </div>
      )}

      {/* Recent Events */}
      <div className="bg-white/[0.06] border border-white/5 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-white">Recente Events</h2>
          <span className="text-[11px] text-white/40">{logRows.length} entries</span>
        </div>
        {logRows.length === 0 ? (
          <p className="text-xs text-white/40 py-4">Geen log entries gevonden.</p>
        ) : (
          <div className="space-y-1">
            {logRows.map((log) => (
              <div key={log.id} className="flex items-start gap-3 py-2 border-b border-white/5 last:border-0">
                <span className="text-[10px] text-white/35 font-mono w-28 flex-shrink-0 pt-0.5">
                  {log.created_at
                    ? new Date(log.created_at).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                    : '—'}
                </span>
                <span className={clsx(
                  'px-2 py-0.5 rounded text-[10px] font-semibold flex-shrink-0',
                  LEVEL_BADGE[log.level ?? 'info'] ?? 'bg-white/5 text-white/50'
                )}>
                  {LEVEL_LABELS[log.level ?? 'info'] ?? log.level}
                </span>
                <p className="text-xs text-white/60">{log.message}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
