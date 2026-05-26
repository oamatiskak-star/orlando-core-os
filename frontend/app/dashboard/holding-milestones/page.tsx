import { Target, ChevronLeft } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getActiveCompany } from '@/lib/active-company-server'
import ContinueInClaude from '@/components/build/ContinueInClaude'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type Milestone = {
  id: string
  milestone_nr: number
  naam: string
  value_stage: string | null
  verdienmodel: string | null
  status: string
  progress_pct: number
  fundament: string | null
}

const STATUS_BADGE: Record<string, { label: string; color: string }> = {
  planned:  { label: 'Gepland',  color: 'bg-white/10 text-white/60' },
  building: { label: 'In bouw',  color: 'bg-blue-500/15 text-blue-400' },
  partial:  { label: 'Deels',    color: 'bg-amber-500/15 text-amber-400' },
  live:     { label: 'Live',     color: 'bg-emerald-500/15 text-emerald-400' },
  blocked:  { label: 'Geblokkeerd', color: 'bg-red-500/15 text-red-400' },
}

export default async function HoldingMilestonesPage() {
  const company = await getActiveCompany()

  // Holding-niveau: geen company-filter — dit overkoepelt alle BV's.
  const supabase = await createClient()
  const { data } = await supabase
    .from('holding_milestones')
    .select('id, milestone_nr, naam, value_stage, verdienmodel, status, progress_pct, fundament')
    .order('milestone_nr', { ascending: true })

  const milestones: Milestone[] = (data ?? []) as unknown as Milestone[]

  const overall = milestones.length
    ? Math.round(milestones.reduce((s, m) => s + m.progress_pct, 0) / milestones.length)
    : 0
  const liveCount = milestones.filter((m) => m.status === 'live').length

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
          <Target size={16} />
        </div>
        <div className="flex-1">
          <h1 className="text-base font-semibold text-white">Holding Ecosystem</h1>
          <p className="text-xs text-white/50">
            Autonomous AI Media Holding — {milestones.length} milestones · {liveCount} live · {overall}% gemiddeld
          </p>
        </div>
      </div>

      {milestones.length === 0 ? (
        <div className="py-16 text-center bg-white/[0.02] border border-dashed border-white/10 rounded-xl">
          <Target size={28} className="text-white/15 mx-auto mb-3" />
          <p className="text-[12px] text-white/40">Geen milestones</p>
          <p className="text-[10px] text-white/25 mt-1">Pas migratie 096_holding_milestones toe</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {milestones.map((m) => {
            const badge = STATUS_BADGE[m.status] ?? STATUS_BADGE.planned
            return (
              <div key={m.id} className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[10px] font-mono text-white/35 w-7">M{m.milestone_nr}</span>
                  <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${badge.color}`}>{badge.label}</span>
                  {m.value_stage && (
                    <span className="text-[9px] text-white/35 uppercase tracking-wide">{m.value_stage}</span>
                  )}
                </div>
                <p className="text-[13px] text-white/90 font-medium leading-tight">{m.naam}</p>
                {m.fundament && (
                  <p className="text-[10.5px] text-white/50 mt-1 leading-snug line-clamp-2">{m.fundament}</p>
                )}

                <div className="mt-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                      <div
                        className="h-full"
                        style={{
                          width: `${m.progress_pct}%`,
                          background: `linear-gradient(90deg, ${company.color}, ${company.color}cc)`,
                        }}
                      />
                    </div>
                    <span className="text-[10px] text-white/55 w-9 text-right font-medium">{m.progress_pct}%</span>
                  </div>
                  {m.verdienmodel && (
                    <div className="text-[10px] text-white/45">{m.verdienmodel}</div>
                  )}
                </div>

                <div className="mt-3 pt-3 border-t border-white/[0.06]">
                  <ContinueInClaude
                    companyColor={company.color}
                    context={{
                      tracker: 'Holding Milestones',
                      itemType: 'milestone',
                      name: `M${m.milestone_nr} — ${m.naam}`,
                      statusLabel: badge.label,
                      progressPct: m.progress_pct,
                      description: m.fundament,
                      company: company.name,
                      route: '/dashboard/holding-milestones',
                      extra: [
                        { label: 'Value stage', value: m.value_stage ?? '' },
                        { label: 'Verdienmodel', value: m.verdienmodel ?? '' },
                      ],
                    }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
