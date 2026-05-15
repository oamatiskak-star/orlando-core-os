import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { Search, Home, TrendingUp, AlertCircle, MapPin, Euro } from 'lucide-react'

export const metadata: Metadata = { title: 'Vastgoed Scraper' }
export const dynamic = 'force-dynamic'
export const revalidate = 0

function timeAgo(iso: string | null): string {
  if (!iso) return '—'
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 1) return 'Nu'
  if (m < 60) return `${m}m geleden`
  if (m < 1440) return `${Math.floor(m / 60)}u geleden`
  return `${Math.floor(m / 1440)}d geleden`
}

function fmtEur(n: number | null): string {
  if (!n) return '—'
  if (n >= 1_000_000) return '€' + (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return '€' + Math.round(n / 1_000) + 'K'
  return '€' + n
}

const CLASS_COLOR: Record<string, string> = {
  A: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  B: 'text-amber-400   bg-amber-500/10   border-amber-500/20',
  C: 'text-white/50    bg-white/5        border-white/10',
}

export default async function MobileScrapersPage() {
  const supabase = await createClient()

  const [
    totalRes,
    classARes,
    classBRes,
    classCRes,
    pipelineRes,
    recentRes,
  ] = await Promise.allSettled([
    supabase.from('deals').select('id', { count: 'exact', head: true }),
    supabase.from('deals').select('id', { count: 'exact', head: true }).eq('class', 'A'),
    supabase.from('deals').select('id', { count: 'exact', head: true }).eq('class', 'B'),
    supabase.from('deals').select('id', { count: 'exact', head: true }).eq('class', 'C'),
    supabase.from('deals').select('id', { count: 'exact', head: true }).not('pipeline_fase', 'is', null).neq('pipeline_fase', 'verloren'),
    supabase.from('deals')
      .select('id,straat,stad,provincie,vraagprijs,class,pipeline_fase,created_at,roi_score')
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  const n = (r: PromiseSettledResult<{ count?: number | null }>) =>
    r.status === 'fulfilled' ? (r.value.count ?? 0) : 0

  const total    = n(totalRes    as any)
  const classA   = n(classARes   as any)
  const classB   = n(classBRes   as any)
  const classC   = n(classCRes   as any)
  const pipeline = n(pipelineRes as any)
  const recent   = recentRes.status === 'fulfilled' ? (recentRes.value.data ?? []) : []

  const inbox = recent.filter((d: any) => !d.pipeline_fase)
  const active = recent.filter((d: any) => d.pipeline_fase && d.pipeline_fase !== 'verloren')

  return (
    <div className="max-w-lg mx-auto px-4 py-5 space-y-6"
      style={{ paddingTop: 'calc(1.25rem + env(safe-area-inset-top))' }}>

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center flex-shrink-0">
          <Search size={16} className="text-sky-400" />
        </div>
        <div>
          <h1 className="text-base font-bold text-white">Vastgoed Scraper</h1>
          <p className="text-[11px] text-white/40">AI-gedreven dealflow</p>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: 'Totaal',    val: total,    color: 'text-white/65' },
          { label: 'A-deals',   val: classA,   color: 'text-emerald-400' },
          { label: 'B-deals',   val: classB,   color: 'text-amber-400' },
          { label: 'Pipeline',  val: pipeline, color: 'text-violet-400' },
        ].map(s => (
          <div key={s.label} className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-2.5 text-center">
            <p className={`text-base font-bold ${s.color}`}>{s.val}</p>
            <p className="text-[9px] text-white/38 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Inbox deals (no pipeline fase) */}
      {inbox.length > 0 && (
        <section>
          <h2 className="text-[11px] text-white/38 font-semibold uppercase tracking-wider mb-3">Inbox</h2>
          <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl divide-y divide-white/[0.04]">
            {inbox.slice(0, 10).map((deal: any) => {
              const cls = deal.class as string
              const clsStyle = CLASS_COLOR[cls] ?? CLASS_COLOR.C
              const [tc, bg, bc] = clsStyle.split(' ')
              return (
                <div key={deal.id} className="flex items-start gap-3 px-4 py-3">
                  <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/[0.06] flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Home size={13} className="text-white/40" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] text-white/75 font-medium truncate">
                      {deal.straat ?? deal.stad ?? 'Onbekend adres'}
                    </p>
                    <p className="text-[10px] text-white/35 flex items-center gap-1">
                      <MapPin size={9} />
                      {deal.stad ?? '—'}{deal.provincie ? `, ${deal.provincie}` : ''}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    {cls && (
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${tc} ${bg} ${bc}`}>
                        {cls}
                      </span>
                    )}
                    <span className="text-[10px] text-white/40">{fmtEur(deal.vraagprijs)}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Active pipeline deals */}
      {active.length > 0 && (
        <section>
          <h2 className="text-[11px] text-white/38 font-semibold uppercase tracking-wider mb-3">Pipeline</h2>
          <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl divide-y divide-white/[0.04]">
            {active.map((deal: any) => (
              <div key={deal.id} className="flex items-center gap-3 px-4 py-3">
                <TrendingUp size={14} className="text-violet-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] text-white/75 font-medium truncate">
                    {deal.straat ?? deal.stad ?? 'Onbekend'}
                  </p>
                  <p className="text-[10px] text-white/35 capitalize">{deal.pipeline_fase?.replace('_', ' ') ?? '—'}</p>
                </div>
                <span className="text-[10px] text-white/40">{fmtEur(deal.vraagprijs)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {total === 0 && (
        <div className="text-center py-12">
          <Search size={32} className="text-white/15 mx-auto mb-3" />
          <p className="text-sm text-white/30">Geen vastgoeddeals gevonden</p>
        </div>
      )}
    </div>
  )
}
