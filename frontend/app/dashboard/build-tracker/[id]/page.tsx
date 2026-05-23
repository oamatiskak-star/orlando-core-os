import { ChevronLeft, Hammer, Calendar, User } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getActiveCompany } from '@/lib/active-company-server'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type Build = {
  id: string
  name: string
  description: string | null
  status: string
  progress_pct: number
  owner: string | null
  current_milestone: string | null
  started_at: string | null
  target_at: string | null
  last_update_at: string | null
}

const STATUS_BADGE: Record<string, { label: string; color: string }> = {
  planned:   { label: 'Gepland',    color: 'bg-white/10 text-white/60' },
  building:  { label: 'In bouw',    color: 'bg-blue-500/15 text-blue-400' },
  testing:   { label: 'Test',       color: 'bg-violet-500/15 text-violet-400' },
  deploying: { label: 'Deployment', color: 'bg-cyan-500/15 text-cyan-400' },
  live:      { label: 'Live',       color: 'bg-emerald-500/15 text-emerald-400' },
  paused:    { label: 'Gepauzeerd', color: 'bg-amber-500/15 text-amber-400' },
  failed:    { label: 'Mislukt',    color: 'bg-red-500/15 text-red-400' },
}

function fmtDate(s: string | null) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default async function BuildDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const company = await getActiveCompany()
  const supabase = await createClient()

  const { data } = await supabase
    .from('build_tracker')
    .select('*')
    .eq('id', id)
    .eq('companies!inner(slug)', company.id)
    .single()

  if (!data) notFound()

  const build = data as Build
  const badge = STATUS_BADGE[build.status] ?? STATUS_BADGE.planned

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/build-tracker" className="text-white/40 hover:text-white/70">
          <ChevronLeft size={16} />
        </Link>
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: `${company.color}1a`, border: `1px solid ${company.color}33`, color: company.color }}
        >
          <Hammer size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-semibold text-white truncate">{build.name}</h1>
          <p className="text-xs text-white/50">Build Tracker</p>
        </div>
      </div>

      <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <span className={`text-[11px] font-semibold px-2 py-1 rounded whitespace-nowrap ${badge.color}`}>{badge.label}</span>
          {build.current_milestone && (
            <span className="text-[11px] text-white/50 flex-1 text-right truncate">{build.current_milestone}</span>
          )}
        </div>

        {build.description && (
          <div>
            <p className="text-[12px] text-white/40 mb-1">Beschrijving</p>
            <p className="text-[13px] text-white/80 leading-relaxed">{build.description}</p>
          </div>
        )}

        <div>
          <p className="text-[12px] text-white/40 mb-2">Voortgang</p>
          <div className="flex items-center gap-3">
            <div className="flex-1 h-2 rounded-full bg-white/[0.06] overflow-hidden">
              <div
                className="h-full transition-all"
                style={{
                  width: `${build.progress_pct}%`,
                  background: `linear-gradient(90deg, ${company.color}, ${company.color}cc)`,
                }}
              />
            </div>
            <span className="text-[12px] font-medium text-white/70 w-12 text-right">{build.progress_pct}%</span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 pt-2 border-t border-white/[0.06]">
          {build.owner && (
            <div className="flex items-center gap-2">
              <User size={14} className="text-white/40 flex-shrink-0" />
              <div>
                <p className="text-[11px] text-white/50">Eigenaar</p>
                <p className="text-[12px] text-white/80">{build.owner}</p>
              </div>
            </div>
          )}

          {build.started_at && (
            <div className="flex items-center gap-2">
              <Calendar size={14} className="text-white/40 flex-shrink-0" />
              <div>
                <p className="text-[11px] text-white/50">Gestart</p>
                <p className="text-[12px] text-white/80">{fmtDate(build.started_at)}</p>
              </div>
            </div>
          )}

          {build.target_at && (
            <div className="flex items-center gap-2">
              <Calendar size={14} className="text-white/40 flex-shrink-0" />
              <div>
                <p className="text-[11px] text-white/50">Deadline</p>
                <p className="text-[12px] text-white/80">{fmtDate(build.target_at)}</p>
              </div>
            </div>
          )}

          {build.last_update_at && (
            <div className="flex items-center gap-2">
              <Calendar size={14} className="text-white/40 flex-shrink-0" />
              <div>
                <p className="text-[11px] text-white/50">Laatste update</p>
                <p className="text-[12px] text-white/80">{fmtDate(build.last_update_at)}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
