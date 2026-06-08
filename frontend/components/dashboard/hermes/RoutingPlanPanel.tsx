import { createAdminClient } from '@/lib/supabase/admin'
import { Brain } from 'lucide-react'
import ApprovalButtons from './ApprovalButtons'

interface PlanRow {
  id: string
  request_id: string
  active_project: string | null
  project_confidence: number | null
  candidate_skills: Array<{ name: string }>
  candidate_agents: Array<{ name: string }>
  candidate_boards: Array<{ key: string; label: string }>
  preflight_advice: { gpt?: { risks?: string[] }; claude?: { risks?: string[] } }
  final_selection: { skills?: string[]; agents?: string[]; boards?: string[]; risks?: string[] }
  priority: 'P1' | 'P2' | 'P3'
  dispatched_actions: Array<{ title: string; target_host: string; skill: string }>
  gated_actions: Array<{ approval_id: string; kind: string; reason: string }>
  status: string
  created_at: string
}

interface ApprovalRow {
  id: string
  action_kind: string
  title: string
  reason: string
  created_at: string
}

function ago(ts: string | null): string {
  if (!ts) return '—'
  const s = Math.floor((Date.now() - new Date(ts).getTime()) / 1000)
  if (s < 60) return `${s}s geleden`
  if (s < 3600) return `${Math.floor(s / 60)}m geleden`
  if (s < 86400) return `${Math.floor(s / 3600)}u geleden`
  return `${Math.floor(s / 86400)}d geleden`
}

function Chip({ text, tone = 'slate' }: { text: string; tone?: 'slate' | 'emerald' | 'amber' | 'sky' | 'violet' }) {
  const tones: Record<string, string> = {
    slate: 'bg-white/[0.05] text-white/65 border-white/[0.08]',
    emerald: 'bg-emerald-500/12 text-emerald-300 border-emerald-500/20',
    amber: 'bg-amber-500/12 text-amber-300 border-amber-500/20',
    sky: 'bg-sky-500/12 text-sky-300 border-sky-500/20',
    violet: 'bg-violet-500/12 text-violet-300 border-violet-500/20',
  }
  return <span className={`text-[10px] px-1.5 py-0.5 rounded border ${tones[tone]}`}>{text}</span>
}

export default async function RoutingPlanPanel() {
  const db = createAdminClient()
  let plans: PlanRow[] = []
  let approvals: ApprovalRow[] = []
  let unavailable = false

  try {
    const h = db.schema('hermes')
    const [planRes, apprRes] = await Promise.all([
      h.from('routing_plans').select('*').order('created_at', { ascending: false }).limit(6),
      h.from('approvals').select('id, action_kind, title, reason, created_at').eq('status', 'pending').order('created_at', { ascending: false }).limit(10),
    ])
    if (planRes.error) unavailable = true
    plans = (planRes.data ?? []) as PlanRow[]
    approvals = (apprRes.data ?? []) as ApprovalRow[]
  } catch {
    unavailable = true
  }

  if (unavailable) {
    return (
      <section className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
        <Header />
        <div className="text-[11px] text-amber-300/80 mt-2">
          Routing-brein niet bereikbaar — migratie 124 nog niet toegepast op deze database.
        </div>
      </section>
    )
  }

  return (
    <section className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 space-y-3">
      <Header />

      {/* Openstaande goedkeuringen (harde gate) */}
      {approvals.length > 0 && (
        <div className="rounded-lg border border-amber-500/25 bg-amber-500/[0.05] p-2.5 space-y-2">
          <div className="text-[11px] font-medium text-amber-300">⛔ Wacht op goedkeuring ({approvals.length})</div>
          {approvals.map((a) => (
            <div key={a.id} className="flex items-center justify-between gap-2 text-[11px]">
              <div className="min-w-0">
                <span className="font-mono text-amber-200">{a.action_kind}</span>
                <span className="text-white/45"> · {a.title}</span>
                <div className="text-[10px] text-white/40 truncate">{a.reason}</div>
              </div>
              <ApprovalButtons approvalId={a.id} />
            </div>
          ))}
        </div>
      )}

      {/* Recente routing-plannen */}
      {plans.length === 0 ? (
        <div className="text-[11px] text-white/35">Nog geen routing-plannen — stel een vrije vraag in de Command Center.</div>
      ) : (
        <div className="space-y-2">
          {plans.map((p) => {
            const sel = p.final_selection ?? {}
            const risks = [...(p.preflight_advice?.gpt?.risks ?? []), ...(p.preflight_advice?.claude?.risks ?? []), ...(sel.risks ?? [])]
            return (
              <div key={p.id} className="rounded-lg bg-white/[0.02] border border-white/[0.05] p-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] font-medium text-white/85">{p.active_project ?? 'onbekend'}</span>
                    <Chip text={p.priority} tone={p.priority === 'P1' ? 'amber' : 'slate'} />
                    {p.project_confidence != null && (
                      <span className="text-[9.5px] text-white/35">{Math.round(p.project_confidence * 100)}%</span>
                    )}
                  </div>
                  <span className="text-[9.5px] text-white/35">{ago(p.created_at)}</span>
                </div>

                <div className="mt-1.5 flex flex-wrap gap-1">
                  {(sel.skills ?? p.candidate_skills?.map((s) => s.name) ?? []).map((s) => (
                    <Chip key={`sk-${s}`} text={s} tone="sky" />
                  ))}
                  {(sel.boards ?? p.candidate_boards?.map((b) => b.key) ?? []).map((b) => (
                    <Chip key={`bd-${b}`} text={b} tone="violet" />
                  ))}
                </div>

                {(sel.agents ?? p.candidate_agents?.map((a) => a.name) ?? []).length > 0 && (
                  <div className="mt-1 text-[10px] text-white/45">
                    agents: {(sel.agents ?? p.candidate_agents.map((a) => a.name)).join(', ')}
                  </div>
                )}

                <div className="mt-1.5 flex flex-wrap gap-1.5 text-[10px]">
                  {p.dispatched_actions?.length > 0 && (
                    <span className="text-emerald-300">✅ {p.dispatched_actions.length} gedispatcht</span>
                  )}
                  {p.gated_actions?.length > 0 && (
                    <span className="text-amber-300">⛔ {p.gated_actions.length} gegate</span>
                  )}
                  {!p.dispatched_actions?.length && !p.gated_actions?.length && (
                    <span className="text-white/35">alleen advies</span>
                  )}
                </div>

                {risks.length > 0 && (
                  <div className="mt-1 text-[10px] text-white/45">risico's: {risks.slice(0, 3).join('; ')}</div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

function Header() {
  return (
    <div className="flex items-center gap-1.5">
      <Brain size={13} className="text-violet-400" />
      <h2 className="text-[12px] font-semibold text-white/85">Hermes routing-brein</h2>
    </div>
  )
}
