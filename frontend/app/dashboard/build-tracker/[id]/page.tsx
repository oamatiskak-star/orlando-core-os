import { ChevronLeft, Hammer, Calendar, User, Flag, Clock } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getActiveCompany } from '@/lib/active-company-server'
import BuildEditPanel from './BuildEditPanel'

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

function fmtDateTime(s: string | null) {
  if (!s) return '—'
  return new Date(s).toLocaleString('nl-NL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export default async function BuildDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const company = await getActiveCompany()
  const supabase = await createClient()

  const { data } = await supabase
    .from('build_tracker')
    .select('id, name, description, status, progress_pct, owner, current_milestone, started_at, target_at, last_update_at')
    .eq('id', id)
    .maybeSingle()

  if (!data) notFound()
  const b = data as Build
  const badge = STATUS_BADGE[b.status] ?? STATUS_BADGE.planned

  return (
    <div className="space-y-5 max-w-3xl">
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
          <h1 className="text-base font-semibold text-white truncate">{b.name}</h1>
          <p className="text-xs text-white/50">{company.name}</p>
        </div>
        <span className={`text-[10px] font-semibold px-2 py-1 rounded ${badge.color}`}>{badge.label}</span>
      </div>

      {/* Progress + milestone */}
      <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex-1 h-2 rounded-full bg-white/[0.06] overflow-hidden">
            <div
              className="h-full"
              style={{ width: `${b.progress_pct}%`, background: `linear-gradient(90deg, ${company.color}, ${company.color}cc)` }}
            />
          </div>
          <span className="text-xs text-white/70 w-10 text-right font-semibold">{b.progress_pct}%</span>
        </div>

        {b.current_milestone && (
          <div className="flex items-center gap-2 text-[12px]" style={{ color: company.color }}>
            <Flag size={13} />
            <span className="font-medium">{b.current_milestone}</span>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1 text-[11px]">
          <div>
            <p className="text-white/35 flex items-center gap-1 mb-0.5"><User size={10} /> Eigenaar</p>
            <p className="text-white/75">{b.owner || '—'}</p>
          </div>
          <div>
            <p className="text-white/35 flex items-center gap-1 mb-0.5"><Calendar size={10} /> Gestart</p>
            <p className="text-white/75">{fmtDate(b.started_at)}</p>
          </div>
          <div>
            <p className="text-white/35 flex items-center gap-1 mb-0.5"><Calendar size={10} /> Deadline</p>
            <p className="text-white/75">{fmtDate(b.target_at)}</p>
          </div>
          <div>
            <p className="text-white/35 flex items-center gap-1 mb-0.5"><Clock size={10} /> Laatste update</p>
            <p className="text-white/75">{fmtDateTime(b.last_update_at)}</p>
          </div>
        </div>
      </div>

      {/* Full task description */}
      <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-5">
        <p className="text-[10px] text-white/35 uppercase tracking-wide mb-2">Taak­omschrijving</p>
        <p className="text-[13px] text-white/80 leading-relaxed whitespace-pre-wrap">
          {b.description?.trim() || 'Geen omschrijving vastgelegd voor deze build.'}
        </p>
      </div>

      {/* Edit / Ga verder controls */}
      <BuildEditPanel
        id={b.id}
        status={b.status}
        progress={b.progress_pct}
        currentMilestone={b.current_milestone}
        description={b.description}
        companyColor={company.color}
      />
    </div>
  )
}
