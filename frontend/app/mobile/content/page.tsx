import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { Zap, FileVideo, CheckCircle, AlertCircle, Clock, Loader2 } from 'lucide-react'

export const metadata: Metadata = { title: 'Content Productie' }
export const dynamic = 'force-dynamic'
export const revalidate = 0

function fmt(n: number): string {
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return String(n)
}

function timeAgo(iso: string | null): string {
  if (!iso) return '—'
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 1) return 'Nu'
  if (m < 60) return `${m}m geleden`
  if (m < 1440) return `${Math.floor(m / 60)}u geleden`
  return `${Math.floor(m / 1440)}d geleden`
}

const RENDER_STATUS: Record<string, { label: string; color: string }> = {
  pending:    { label: 'Wachtrij',   color: 'text-white/40' },
  rendering:  { label: 'Renderen',   color: 'text-indigo-400' },
  completed:  { label: 'Klaar',      color: 'text-emerald-400' },
  failed:     { label: 'Mislukt',    color: 'text-red-400' },
  uploading:  { label: 'Uploaden',   color: 'text-sky-400' },
  uploaded:   { label: 'Geüpload',   color: 'text-emerald-400' },
}

export default async function MobileContentPage() {
  const supabase = await createClient()

  const [
    totalRes,
    completedRes,
    renderingRes,
    failedRes,
    recentRes,
  ] = await Promise.allSettled([
    supabase.from('generated_media').select('id', { count: 'exact', head: true }),
    supabase.from('generated_media').select('id', { count: 'exact', head: true }).in('render_status', ['completed', 'uploaded']),
    supabase.from('generated_media').select('id', { count: 'exact', head: true }).in('render_status', ['rendering', 'uploading']),
    supabase.from('generated_media').select('id', { count: 'exact', head: true }).eq('render_status', 'failed'),
    supabase.from('generated_media')
      .select('id,title,channel_name,render_status,upload_status,created_at,duration_seconds')
      .order('created_at', { ascending: false })
      .limit(15),
  ])

  const total     = totalRes.status     === 'fulfilled' ? (totalRes.value.count      ?? 0) : 0
  const completed = completedRes.status === 'fulfilled' ? (completedRes.value.count  ?? 0) : 0
  const rendering = renderingRes.status === 'fulfilled' ? (renderingRes.value.count  ?? 0) : 0
  const failed    = failedRes.status    === 'fulfilled' ? (failedRes.value.count     ?? 0) : 0
  const recent    = recentRes.status    === 'fulfilled' ? (recentRes.value.data      ?? []) : []

  const pending = total - completed - rendering - failed

  return (
    <div className="max-w-lg mx-auto px-4 py-5 space-y-6"
      style={{ paddingTop: 'calc(1.25rem + env(safe-area-inset-top))' }}>

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center flex-shrink-0">
          <Zap size={16} className="text-violet-400" />
        </div>
        <div>
          <h1 className="text-base font-bold text-white">Content Productie</h1>
          <p className="text-[11px] text-white/40">AI-gegenereerde media assets</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2.5">
        {[
          { label: 'Totaal',     val: fmt(total),     icon: FileVideo,    color: 'text-white/65' },
          { label: 'Klaar',      val: fmt(completed), icon: CheckCircle,  color: 'text-emerald-400' },
          { label: 'Renderen',   val: fmt(rendering), icon: Loader2,      color: rendering > 0 ? 'text-indigo-400' : 'text-white/30' },
          { label: 'Mislukt',    val: fmt(failed),    icon: AlertCircle,  color: failed > 0    ? 'text-red-400'    : 'text-white/30' },
        ].map(s => {
          const Icon = s.icon
          return (
            <div key={s.label} className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-4">
              <Icon size={14} className={`${s.color} mb-2`} />
              <p className={`text-xl font-bold ${s.color}`}>{s.val}</p>
              <p className="text-[10px] text-white/40 mt-0.5">{s.label}</p>
            </div>
          )
        })}
      </div>

      {/* Progress bar */}
      {total > 0 && (
        <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] text-white/50">Voltooiingsgraad</span>
            <span className="text-[11px] text-white/70 font-medium">{Math.round((completed / total) * 100)}%</span>
          </div>
          <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all"
              style={{ width: `${Math.round((completed / total) * 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Recent media */}
      {recent.length > 0 ? (
        <section>
          <h2 className="text-[11px] text-white/38 font-semibold uppercase tracking-wider mb-3">Recente media</h2>
          <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl divide-y divide-white/[0.04]">
            {recent.map((item: any) => {
              const rs = RENDER_STATUS[item.render_status] ?? { label: item.render_status ?? '—', color: 'text-white/40' }
              const dur = item.duration_seconds ? `${Math.floor(item.duration_seconds / 60)}:${String(item.duration_seconds % 60).padStart(2, '0')}` : null
              return (
                <div key={item.id} className="flex items-start gap-3 px-4 py-3">
                  <div className="w-8 h-8 rounded-lg bg-violet-500/10 border border-violet-500/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <FileVideo size={13} className="text-violet-400/70" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] text-white/75 font-medium truncate">{item.title ?? 'Geen titel'}</p>
                    <p className="text-[10px] text-white/35 truncate">
                      {item.channel_name ?? '—'}
                      {dur ? ` · ${dur}` : ''}
                      {' · '}{timeAgo(item.created_at)}
                    </p>
                  </div>
                  <span className={`text-[10px] font-medium ${rs.color} shrink-0 mt-0.5`}>{rs.label}</span>
                </div>
              )
            })}
          </div>
        </section>
      ) : (
        <div className="text-center py-12">
          <Zap size={32} className="text-white/15 mx-auto mb-3" />
          <p className="text-sm text-white/30">Geen content gevonden</p>
        </div>
      )}
    </div>
  )
}
