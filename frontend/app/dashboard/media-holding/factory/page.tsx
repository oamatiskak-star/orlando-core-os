import { createClient } from '@/lib/supabase/server'
import { Clapperboard, Upload, AlertTriangle, CheckCircle2, Clock } from 'lucide-react'
import JobRetryButton from './JobRetryButton'

const STATUS_STYLE: Record<string, string> = {
  queued:      'bg-sky-500/10 border-sky-500/20 text-sky-400',
  uploading:   'bg-violet-500/10 border-violet-500/20 text-violet-400',
  uploaded_pending_processing: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
  processing:  'bg-amber-500/10 border-amber-500/20 text-amber-400',
  verified_live: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
  failed:      'bg-red-500/10 border-red-500/20 text-red-400',
  retrying:    'bg-orange-500/10 border-orange-500/20 text-orange-400',
}

function num(n: number) {
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return String(n)
}

export default async function FactoryPage() {
  const supabase = await createClient()

  const [{ data: queue }, { data: failures }] = await Promise.all([
    supabase.from('youtube_upload_queue').select('id,channel_id,title,status,retry_count,viral_score,scheduled_publish_at,created_at').order('created_at', { ascending: false }).limit(50),
    supabase.from('youtube_upload_failures').select('id,channel_id,failure_type,details,created_at').order('created_at', { ascending: false }).limit(10),
  ])

  const qList = queue ?? []
  const fList = failures ?? []

  const grouped = qList.reduce<Record<string, number>>((acc, j) => {
    acc[j.status] = (acc[j.status] ?? 0) + 1
    return acc
  }, {})

  return (
    <div className="space-y-6">

      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
          <Clapperboard size={16} className="text-amber-400" />
        </div>
        <div>
          <h1 className="text-base font-semibold text-white">Content Factory</h1>
          <p className="text-xs text-white/45">Upload queue · render status · failures</p>
        </div>
      </div>

      {/* Status overview */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(grouped).map(([status, count]) => (
          <div key={status} className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium ${STATUS_STYLE[status] ?? 'bg-white/5 border-white/10 text-white/40'}`}>
            {count}× {status.replace(/_/g, ' ')}
          </div>
        ))}
        {qList.length === 0 && (
          <p className="text-sm text-white/35">Queue is leeg</p>
        )}
      </div>

      {/* Queue table */}
      {qList.length > 0 && (
        <div className="bg-white/[0.04] border border-white/8 rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <Upload size={13} className="text-white/50" /> Upload Queue
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-white/35 border-b border-white/5">
                  <th className="text-left py-2 pr-3 font-medium">Titel</th>
                  <th className="text-left py-2 pr-3 font-medium">Status</th>
                  <th className="text-right py-2 pr-3 font-medium">Viral score</th>
                  <th className="text-right py-2 pr-3 font-medium">Retries</th>
                  <th className="text-right py-2 pr-3 font-medium">Gepland</th>
                  <th className="text-right py-2 font-medium">Actie</th>
                </tr>
              </thead>
              <tbody>
                {qList.map(j => (
                  <tr key={j.id} className="border-b border-white/[0.04]">
                    <td className="py-2 pr-3 text-white/70 max-w-[200px] truncate">{j.title ?? '—'}</td>
                    <td className="py-2 pr-3">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${STATUS_STYLE[j.status] ?? 'bg-white/5 border-white/10 text-white/35'}`}>
                        {j.status}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-right text-white/50">{j.viral_score ?? '—'}</td>
                    <td className="py-2 pr-3 text-right text-white/40">{j.retry_count ?? 0}</td>
                    <td className="py-2 pr-3 text-right text-white/35">
                      {j.scheduled_publish_at
                        ? new Date(j.scheduled_publish_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
                        : '—'}
                    </td>
                    <td className="py-2 text-right"><JobRetryButton id={j.id} status={j.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Failures */}
      {fList.length > 0 && (
        <div className="bg-white/[0.04] border border-white/8 rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <AlertTriangle size={13} className="text-red-400" /> Recente failures
          </h2>
          <div className="space-y-2">
            {fList.map(f => (
              <div key={f.id} className="flex items-start gap-3 py-2 border-b border-white/[0.04] last:border-0">
                <AlertTriangle size={12} className="text-red-400 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-white/70 font-medium">{f.failure_type}</p>
                  {f.details && <p className="text-[11px] text-white/35 line-clamp-1">{typeof f.details === 'string' ? f.details : JSON.stringify(f.details)}</p>}
                </div>
                <span className="text-[11px] text-white/30 shrink-0">
                  {new Date(f.created_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {qList.length === 0 && fList.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center bg-white/[0.04] border border-white/8 rounded-2xl">
          <Clapperboard size={32} className="text-white/15 mb-3" />
          <p className="text-sm text-white/40">Geen actieve jobs in de factory</p>
          <p className="text-xs text-white/25 mt-1">Upload queue is leeg</p>
        </div>
      )}
    </div>
  )
}
