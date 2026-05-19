import { createClient } from '@/lib/supabase/server'
import { Server, CheckCircle2, AlertTriangle } from 'lucide-react'

export default async function WorkersPage() {
  const supabase = await createClient()

  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
  const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString()

  const { data: workers } = await supabase
    .from('infra_workers')
    .select('*')
    .order('worker_name')

  const wList = workers ?? []
  const now = new Date()

  function workerHealth(w: { last_heartbeat: string | null }) {
    if (!w.last_heartbeat) return 'offline'
    const diff = now.getTime() - new Date(w.last_heartbeat).getTime()
    if (diff < 5 * 60 * 1000)  return 'online'
    if (diff < 15 * 60 * 1000) return 'idle'
    return 'offline'
  }

  const online  = wList.filter(w => workerHealth(w) === 'online').length
  const idle    = wList.filter(w => workerHealth(w) === 'idle').length
  const offline = wList.filter(w => workerHealth(w) === 'offline').length

  return (
    <div className="space-y-6">

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
            <Server size={16} className="text-emerald-400" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-white">Workers</h1>
            <p className="text-xs text-white/45">Infrastructure worker heartbeats</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg">
            <CheckCircle2 size={11} /> {online} online
          </span>
          {idle > 0 && (
            <span className="flex items-center gap-1.5 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-lg">
              {idle} idle
            </span>
          )}
          {offline > 0 && (
            <span className="flex items-center gap-1.5 text-xs text-red-400 bg-red-500/10 border border-red-500/20 px-2.5 py-1 rounded-lg">
              <AlertTriangle size={11} /> {offline} offline
            </span>
          )}
        </div>
      </div>

      <div className="bg-white/[0.04] border border-white/8 rounded-2xl overflow-hidden">
        {wList.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Server size={32} className="text-white/15 mb-3" />
            <p className="text-sm text-white/40">Geen workers gevonden</p>
            <p className="text-xs text-white/25 mt-1">Workers sturen heartbeats via Docker stack</p>
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="text-white/35 border-b border-white/5">
                <th className="text-left py-3 px-5 font-medium">Worker</th>
                <th className="text-left py-3 pr-5 font-medium">Status</th>
                <th className="text-left py-3 pr-5 font-medium">Taak</th>
                <th className="text-right py-3 pr-5 font-medium">Laatste heartbeat</th>
                <th className="text-right py-3 pr-5 font-medium">Iteraties</th>
              </tr>
            </thead>
            <tbody>
              {wList.map(w => {
                const health = workerHealth(w)
                const healthStyle =
                  health === 'online'  ? 'text-emerald-400' :
                  health === 'idle'    ? 'text-amber-400'   :
                                        'text-red-400'
                const dot =
                  health === 'online'  ? 'bg-emerald-400 animate-pulse' :
                  health === 'idle'    ? 'bg-amber-400'   :
                                        'bg-red-400'

                return (
                  <tr key={w.id ?? w.worker_name} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                    <td className="py-3 px-5 font-medium text-white/80">{w.worker_name}</td>
                    <td className="py-3 pr-5">
                      <span className={`flex items-center gap-1.5 ${healthStyle}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
                        {health}
                      </span>
                    </td>
                    <td className="py-3 pr-5 text-white/40 max-w-[200px] truncate">{w.current_task ?? '—'}</td>
                    <td className="py-3 pr-5 text-right text-white/35">
                      {w.last_heartbeat
                        ? new Date(w.last_heartbeat).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                        : '—'}
                    </td>
                    <td className="py-3 pr-5 text-right text-white/35">{w.iterations ?? '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
