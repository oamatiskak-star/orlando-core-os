import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import {
  UserCog, ChevronLeft, Sparkles, AlertTriangle, Target,
  ListChecks, Activity, Settings, Clock,
} from 'lucide-react'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type AiState = {
  agent_name: string
  model: string
  status: string
  current_sprint_id: string | null
  last_brief_at: string | null
  next_brief_at: string | null
  context: Record<string, unknown>
  guardrails: Record<string, unknown>
  updated_at: string
}

type Brief = {
  id: string
  brief_type: string
  generated_at: string
  for_date: string
  headline: string
  summary: string | null
  priorities: Array<{ title?: string; rank?: number; owner?: string }>
  risks: Array<{ title?: string; level?: string }>
  recommendations: Array<{ title?: string; action?: string }>
  delivered: boolean
}

type Sprint = {
  id: string
  sprint_code: string
  theme: string | null
  starts_on: string
  ends_on: string
  status: string
}

function fmtDateTime(s: string | null) {
  if (!s) return '—'
  return new Date(s).toLocaleString('nl-NL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })
}

export default async function AiLeadPage() {
  const supabase = await createClient()

  const [stateRes, briefsRes] = await Promise.all([
    supabase.from('aquier_ai_lead_state').select('*').eq('id', 'singleton').maybeSingle(),
    supabase.from('aquier_ai_lead_briefs').select('*').order('generated_at', { ascending: false }).limit(10),
  ])

  const state = (stateRes.data ?? null) as AiState | null
  const briefs = (briefsRes.data ?? []) as Brief[]

  let sprint: Sprint | null = null
  if (state?.current_sprint_id) {
    const { data } = await supabase
      .from('aquier_sprints')
      .select('*')
      .eq('id', state.current_sprint_id)
      .maybeSingle()
    sprint = (data ?? null) as Sprint | null
  }

  const statusColor =
    state?.status === 'ready'   ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
    : state?.status === 'running' ? 'text-blue-400 bg-blue-500/10 border-blue-500/20'
    : state?.status === 'paused'  ? 'text-amber-400 bg-amber-500/10 border-amber-500/20'
    : 'text-red-400 bg-red-500/10 border-red-500/20'

  const ctx = state?.context ?? {}
  const guards = state?.guardrails ?? {}

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/aquier" className="text-white/40 hover:text-white/70">
          <ChevronLeft size={16} />
        </Link>
        <div className="w-9 h-9 rounded-xl bg-fuchsia-500/10 border border-fuchsia-500/20 flex items-center justify-center">
          <UserCog size={16} className="text-fuchsia-400" />
        </div>
        <div className="flex-1">
          <h1 className="text-base font-semibold text-white">AI Project Leider</h1>
          <p className="text-xs text-white/50">{state?.agent_name ?? 'CHRONOS-AQ'} · {state?.model ?? 'claude-opus-4-7'}</p>
        </div>
        <div className={`px-2.5 py-1 rounded-lg border text-[10px] font-semibold uppercase ${statusColor}`}>
          {state?.status ?? 'unknown'}
        </div>
      </div>

      {/* Status / sprint overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Activity size={12} className="text-fuchsia-400" />
            <span className="text-[10px] uppercase font-bold text-fuchsia-400 tracking-wider">Huidige sprint</span>
          </div>
          {sprint ? (
            <>
              <p className="text-[12px] text-white/85 font-medium">{sprint.sprint_code}</p>
              <p className="text-[10.5px] text-white/55 mt-1">{sprint.theme}</p>
              <p className="text-[10px] text-white/35 mt-1">{fmtDate(sprint.starts_on)} → {fmtDate(sprint.ends_on)}</p>
            </>
          ) : (
            <p className="text-[11px] text-white/30">Geen sprint gekoppeld</p>
          )}
        </div>
        <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock size={12} className="text-cyan-400" />
            <span className="text-[10px] uppercase font-bold text-cyan-400 tracking-wider">Briefs</span>
          </div>
          <p className="text-[10.5px] text-white/55">Laatste: {fmtDateTime(state?.last_brief_at ?? null)}</p>
          <p className="text-[10.5px] text-white/55">Volgende: {fmtDateTime(state?.next_brief_at ?? null)}</p>
        </div>
        <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Target size={12} className="text-emerald-400" />
            <span className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider">Mission</span>
          </div>
          <p className="text-[11px] text-white/65">Y1 target: € {(ctx.y1_target_eur as number)?.toLocaleString('nl-NL') ?? '—'}</p>
          <p className="text-[10.5px] text-white/45 mt-0.5">Launch: {(ctx.launch_date as string) ?? '—'}</p>
        </div>
      </div>

      {/* Latest brief detail */}
      {briefs[0] && (
        <div className="bg-gradient-to-br from-fuchsia-500/8 to-cyan-500/5 border border-fuchsia-500/20 rounded-xl p-5">
          <div className="flex items-start gap-3 mb-3">
            <div className="w-8 h-8 rounded-lg bg-fuchsia-500/15 border border-fuchsia-500/25 flex items-center justify-center flex-shrink-0">
              <Sparkles size={14} className="text-fuchsia-400" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[9px] font-bold text-fuchsia-400 uppercase tracking-wider">{briefs[0].brief_type} brief</span>
                <span className="text-[9px] text-white/30">{fmtDateTime(briefs[0].generated_at)}</span>
              </div>
              <p className="text-[14px] text-white/90 font-semibold">{briefs[0].headline}</p>
              {briefs[0].summary && <p className="text-[12px] text-white/60 mt-1.5 leading-relaxed">{briefs[0].summary}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
            {/* Priorities */}
            <div>
              <h3 className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                <ListChecks size={11} />
                Prioriteiten
              </h3>
              {briefs[0].priorities?.length > 0 ? (
                <ol className="space-y-1.5">
                  {briefs[0].priorities.map((p, idx) => (
                    <li key={idx} className="text-[11px] text-white/70 leading-snug">
                      <span className="text-cyan-400 font-bold mr-1.5">{idx + 1}.</span>
                      {p.title ?? ''} {p.owner && <span className="text-white/35"> · {p.owner}</span>}
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-[10.5px] text-white/30 italic">Worden maandag geseed</p>
              )}
            </div>

            {/* Risks */}
            <div>
              <h3 className="text-[10px] font-bold text-orange-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                <AlertTriangle size={11} />
                Risico's
              </h3>
              {briefs[0].risks?.length > 0 ? (
                <ul className="space-y-1.5">
                  {briefs[0].risks.map((r, idx) => (
                    <li key={idx} className="text-[11px] text-white/70 leading-snug">
                      <span className="text-orange-400 mr-1.5">▲</span>
                      {r.title ?? ''} {r.level && <span className="text-white/35"> · {r.level}</span>}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[10.5px] text-white/30 italic">Nog niets gerapporteerd</p>
              )}
            </div>

            {/* Recommendations */}
            <div>
              <h3 className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                <Target size={11} />
                Aanbevelingen
              </h3>
              {briefs[0].recommendations?.length > 0 ? (
                <ul className="space-y-1.5">
                  {briefs[0].recommendations.map((r, idx) => (
                    <li key={idx} className="text-[11px] text-white/70 leading-snug">
                      <span className="text-emerald-400 mr-1.5">→</span>
                      {r.title ?? r.action ?? ''}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[10.5px] text-white/30 italic">Eerste advies maandag 09:00</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Guardrails */}
      <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Settings size={12} className="text-white/55" />
          <h2 className="text-[12px] font-semibold text-white/75">Guardrails (Human-in-Loop)</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px] text-white/65">
          <div className="flex justify-between">
            <span className="text-white/45">Auto-execute limiet</span>
            <span className="text-white/80 font-medium">€ {(guards.auto_execute_limit_eur as number)?.toLocaleString('nl-NL') ?? '—'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-white/45">Approval boven</span>
            <span className="text-white/80 font-medium">€ {(guards.requires_approval_above_eur as number)?.toLocaleString('nl-NL') ?? '—'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-white/45">Pause bij KPI miss</span>
            <span className="text-white/80 font-medium">&gt; {(guards.pause_on_critical_kpi_miss_pct as number) ?? '—'}%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-white/45">Verplichte review categorieën</span>
            <span className="text-white/80 font-medium text-right text-[10px]">
              {(guards.human_approval_categories as string[] | undefined)?.join(', ') ?? '—'}
            </span>
          </div>
        </div>
      </div>

      {/* Brief history */}
      {briefs.length > 1 && (
        <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-4">
          <h2 className="text-[12px] font-semibold text-white/75 mb-3">Brief Historie</h2>
          <div className="space-y-1.5">
            {briefs.slice(1).map(b => (
              <div key={b.id} className="flex items-center gap-2 py-1.5 px-2 rounded bg-white/[0.02]">
                <span className="text-[9px] uppercase font-bold text-fuchsia-400 w-12 flex-shrink-0">{b.brief_type}</span>
                <span className="text-[11px] text-white/70 flex-1 truncate">{b.headline}</span>
                <span className="text-[9.5px] text-white/30 flex-shrink-0">{fmtDateTime(b.generated_at)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!state && (
        <div className="py-10 text-center bg-white/[0.02] border border-dashed border-white/10 rounded-xl">
          <UserCog size={28} className="text-white/15 mx-auto mb-3" />
          <p className="text-[12px] text-white/30">AI Project Leider nog niet geconfigureerd</p>
          <p className="text-[10px] text-white/20 mt-1">Run migration 082_aquier_command_center.sql</p>
        </div>
      )}
    </div>
  )
}
