import { Hammer, Calendar, User, ChevronLeft, CheckCircle2, TrendingUp, AlertTriangle, ListChecks } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getActiveCompany } from '@/lib/active-company-server'
import NewBuildButton from './NewBuildButton'
import BuildCardActions from './BuildCardActions'
import ResumeSessionCard from './ResumeSessionCard'
import CanonicalTrackerMeta from '@/components/build/CanonicalTrackerMeta'
import DagPrioriteitSection from '@/components/build/DagPrioriteitSection'
import { getCanonicalSnapshot, COMPANY_SCOPE_KEYS } from '@/lib/canonical-tracker'

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
  requires_account_setup: boolean
  account_status: string
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

export default async function BuildTrackerPage() {
  const company = await getActiveCompany()

  // Directe slug-filter via inner join — geen JS-mapping nodig
  const supabase = await createClient()
  const { data } = await supabase
    .from('build_tracker')
    .select('id, name, description, status, progress_pct, owner, current_milestone, started_at, target_at, last_update_at, requires_account_setup, account_status, companies!inner(slug)')
    .eq('companies.slug', company.id)
    .order('status', { ascending: false })
    .order('progress_pct', { ascending: false })

  const builds: Build[] = (data ?? []) as unknown as Build[]
  const lopend   = builds.filter((b) => b.status !== 'live')
  const voltooid = builds.filter((b) => b.status === 'live')

  // Canonieke tracker — gefilterde weergave op de canonieke items voor dit bedrijf.
  const scopeKeys = COMPANY_SCOPE_KEYS[company.id] ?? []
  const snap = await getCanonicalSnapshot(supabase, scopeKeys)
  const canonicalBlockers = snap.items.filter((i) => i.section === 'C').slice(0, 6)
  const canonicalActions  = snap.items.filter((i) => i.section === 'E').slice(0, 6)
  const hasCanonical = snap.document && (canonicalBlockers.length > 0 || canonicalActions.length > 0)

  const renderBuild = (b: Build) => {
    const badge = STATUS_BADGE[b.status] ?? STATUS_BADGE.planned
    return (
      <div key={b.id} className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${badge.color}`}>{badge.label}</span>
          {b.current_milestone && (
            <span className="text-[10px] text-white/40 truncate">{b.current_milestone}</span>
          )}
        </div>
        <Link href={`/dashboard/build-tracker/${b.id}`} className="block group">
          <p className="text-[13px] text-white/90 font-medium leading-tight group-hover:text-white transition-colors">{b.name}</p>
        </Link>
        {b.description && (
          <p className="text-[10.5px] text-white/50 mt-1 leading-snug line-clamp-2">{b.description}</p>
        )}

        <div className="mt-3 space-y-2">
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
              <div
                className="h-full"
                style={{
                  width: `${b.progress_pct}%`,
                  background: `linear-gradient(90deg, ${company.color}, ${company.color}cc)`,
                }}
              />
            </div>
            <span className="text-[10px] text-white/55 w-9 text-right font-medium">{b.progress_pct}%</span>
          </div>
          <div className="flex items-center gap-3 text-[10px] text-white/45">
            {b.owner && (
              <span className="flex items-center gap-1">
                <User size={9} />
                {b.owner}
              </span>
            )}
            {b.target_at && (
              <span className="flex items-center gap-1">
                <Calendar size={9} />
                deadline {fmtDate(b.target_at)}
              </span>
            )}
          </div>
        </div>

        <BuildCardActions
          id={b.id}
          name={b.name}
          status={b.status}
          statusLabel={badge.label}
          description={b.description}
          currentMilestone={b.current_milestone}
          progress={b.progress_pct}
          companyColor={company.color}
          companyName={company.name}
          requiresAccountSetup={b.requires_account_setup}
          accountStatus={b.account_status}
        />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/dashboard" className="text-white/40 hover:text-white/70">
          <ChevronLeft size={16} />
        </Link>
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: `${company.color}1a`, border: `1px solid ${company.color}33`, color: company.color }}
        >
          <Hammer size={16} />
        </div>
        <div className="flex-1">
          <h1 className="text-base font-semibold text-white">Build Tracker</h1>
          <p className="text-xs text-white/50">{company.name} — {lopend.length} lopend · {voltooid.length} voltooid</p>
        </div>
        <Link
          href="/dashboard/build-tracker/priorities"
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] transition-all text-[11px] text-white/70 hover:text-white"
        >
          <TrendingUp size={14} />
          Prioriteiten
        </Link>
        <NewBuildButton companyColor={company.color} companyName={company.name} />
      </div>

      {/* Canonieke metadata + refresh (read/sync-only) — gescoped op dit bedrijf */}
      <CanonicalTrackerMeta
        document={snap.document}
        counts={snap.counts}
        scopeLabel={scopeKeys.length ? company.short : 'cross-project'}
      />

      {/* Gefilterde canonieke items (alleen wat aan dit bedrijf gekoppeld is) */}
      <div className="bg-white/[0.02] border border-white/[0.08] rounded-xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <ListChecks size={13} className="text-white/50" />
          <h2 className="text-[12px] font-semibold text-white/80">Canonieke items — {company.short}</h2>
          <Link href="/dashboard/build-tracker/canonical" className="ml-auto text-[10px] text-white/45 hover:text-white/75">
            volledige canonieke tracker →
          </Link>
        </div>
        {!hasCanonical ? (
          <p className="text-[11px] text-white/35">Geen gekoppelde canonieke items.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <p className="text-[10px] font-semibold text-red-400/90 flex items-center gap-1 mb-1.5"><AlertTriangle size={11} /> Open blockers (C)</p>
              {canonicalBlockers.length === 0 ? (
                <p className="text-[10px] text-white/30">—</p>
              ) : canonicalBlockers.map((i) => (
                <div key={i.id} className="text-[10.5px] text-white/70 leading-snug mb-1">
                  {i.blocker_code && <span className="text-[9px] font-bold text-red-400 mr-1">{i.blocker_code}</span>}
                  {i.title}
                </div>
              ))}
            </div>
            <div>
              <p className="text-[10px] font-semibold text-blue-400/90 flex items-center gap-1 mb-1.5"><ListChecks size={11} /> Volgende acties (E)</p>
              {canonicalActions.length === 0 ? (
                <p className="text-[10px] text-white/30">—</p>
              ) : canonicalActions.map((i) => (
                <div key={i.id} className="text-[10.5px] text-white/70 leading-snug mb-1">{i.title}</div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Dagprioriteit — vandaag eerst starten, teruggeleid naar jaar-1 doel */}
      <DagPrioriteitSection companySlug={company.id} />

      <ResumeSessionCard />

      {builds.length === 0 ? (
        <div className="py-16 text-center bg-white/[0.02] border border-dashed border-white/10 rounded-xl">
          <Hammer size={28} className="text-white/15 mx-auto mb-3" />
          <p className="text-[12px] text-white/40">Geen builds voor {company.short}</p>
          <p className="text-[10px] text-white/25 mt-1">Voeg een build toe via Supabase of een agent</p>
        </div>
      ) : (
        <div className="space-y-4">
          {lopend.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {lopend.map(renderBuild)}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3">
              <CheckCircle2 size={14} /> Geen lopende builds — alles live.
            </div>
          )}

          {voltooid.length > 0 && (
            <details className="group">
              <summary className="cursor-pointer list-none flex items-center gap-2 text-xs text-white/45 hover:text-white/70 select-none">
                <CheckCircle2 size={13} className="text-emerald-400" />
                {voltooid.length} voltooide build{voltooid.length === 1 ? '' : 's'} — klik om te tonen
              </summary>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3 opacity-70">
                {voltooid.map(renderBuild)}
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  )
}
