import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import {
  ThumbsUp, ThumbsDown, ChevronLeft, Brain, Wrench, AlertTriangle,
  Coins, Users, GitMerge, Rocket, Tag, MoreHorizontal, Clock,
} from 'lucide-react'
import { decideApproval } from './actions'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type Approval = {
  id: string
  requested_at: string
  category: string
  title: string
  rationale: string | null
  proposed_action: string | null
  alternatives: Array<{ option?: string; cost?: number }>
  impact: string | null
  estimated_cost_eur: number | null
  proposed_by_agent: string | null
  related_project_id: string | null
  status: string
  decided_by: string | null
  decided_at: string | null
  decision_note: string | null
}

const CATEGORY_CFG: Record<string, { Icon: typeof Brain; color: string; bg: string; label: string }> = {
  strategie:    { Icon: Brain,          color: 'text-fuchsia-400', bg: 'bg-fuchsia-500/8 border-fuchsia-500/15', label: 'Strategie' },
  verbetering:  { Icon: Wrench,         color: 'text-cyan-400',    bg: 'bg-cyan-500/8 border-cyan-500/15',       label: 'Verbetering' },
  storing:      { Icon: AlertTriangle,  color: 'text-red-400',     bg: 'bg-red-500/8 border-red-500/15',         label: 'Storing' },
  spend:        { Icon: Coins,          color: 'text-amber-400',   bg: 'bg-amber-500/8 border-amber-500/15',     label: 'Uitgave' },
  hire:         { Icon: Users,          color: 'text-emerald-400', bg: 'bg-emerald-500/8 border-emerald-500/15', label: 'Hire' },
  partnership:  { Icon: GitMerge,       color: 'text-violet-400',  bg: 'bg-violet-500/8 border-violet-500/15',   label: 'Partnership' },
  launch:       { Icon: Rocket,         color: 'text-blue-400',    bg: 'bg-blue-500/8 border-blue-500/15',       label: 'Launch' },
  pricing:      { Icon: Tag,            color: 'text-orange-400',  bg: 'bg-orange-500/8 border-orange-500/15',   label: 'Pricing' },
  overig:       { Icon: MoreHorizontal, color: 'text-white/60',    bg: 'bg-white/[0.04] border-white/[0.06]',    label: 'Overig' },
}

function fmtDateTime(s: string | null) {
  if (!s) return '—'
  return new Date(s).toLocaleString('nl-NL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function fmtEur(n: number | null) {
  if (n == null) return '—'
  return n.toLocaleString('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
}

export default async function ApprovalsPage() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('aquier_approvals')
    .select('*')
    .order('status', { ascending: true })
    .order('requested_at', { ascending: false })

  const items = (data ?? []) as Approval[]
  const pending = items.filter(i => i.status === 'pending')
  const decided = items.filter(i => i.status !== 'pending')

  // Group by category
  const groupedPending = new Map<string, Approval[]>()
  pending.forEach(i => {
    if (!groupedPending.has(i.category)) groupedPending.set(i.category, [])
    groupedPending.get(i.category)!.push(i)
  })

  // Order categories
  const orderedCats = ['strategie', 'verbetering', 'storing', 'spend', 'hire', 'partnership', 'launch', 'pricing', 'overig']

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/aquier" className="text-white/40 hover:text-white/70">
          <ChevronLeft size={16} />
        </Link>
        <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
          <ThumbsUp size={16} className="text-emerald-400" />
        </div>
        <div className="flex-1">
          <h1 className="text-base font-semibold text-white">Approve / Decline Systeem</h1>
          <p className="text-xs text-white/50">{pending.length} openstaand · {decided.length} besloten</p>
        </div>
      </div>

      {/* Pending grouped per category */}
      {pending.length > 0 ? (
        orderedCats.map(cat => {
          const list = groupedPending.get(cat)
          if (!list || list.length === 0) return null
          const cfg = CATEGORY_CFG[cat] ?? CATEGORY_CFG.overig
          const Icon = cfg.Icon
          return (
            <div key={cat} className="space-y-2">
              <div className="flex items-center gap-2">
                <Icon size={12} className={cfg.color} />
                <span className={`text-[11px] font-bold uppercase tracking-wider ${cfg.color}`}>{cfg.label}</span>
                <span className="text-[10px] text-white/30">{list.length}</span>
                <div className="flex-1 h-px bg-white/[0.06]" />
              </div>

              {list.map(item => (
                <div key={item.id} className={`border rounded-xl p-4 ${cfg.bg}`}>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex-1">
                      <p className="text-[13px] text-white/90 font-medium">{item.title}</p>
                      {item.proposed_by_agent && (
                        <p className="text-[10px] text-white/40 mt-0.5">
                          Voorstel van <span className="font-mono">{item.proposed_by_agent}</span> · {fmtDateTime(item.requested_at)}
                        </p>
                      )}
                    </div>
                    {item.estimated_cost_eur != null && (
                      <div className="text-right flex-shrink-0">
                        <p className="text-[9px] text-white/35 uppercase">Geschatte kosten</p>
                        <p className={`text-[12px] font-bold ${cfg.color}`}>{fmtEur(item.estimated_cost_eur)}</p>
                      </div>
                    )}
                  </div>

                  {item.rationale && (
                    <div className="mt-2 p-2.5 rounded-lg bg-white/[0.03] border border-white/[0.04]">
                      <p className="text-[9px] text-white/40 uppercase font-bold mb-1">Onderbouwing</p>
                      <p className="text-[11px] text-white/70 leading-snug">{item.rationale}</p>
                    </div>
                  )}

                  {item.proposed_action && (
                    <div className="mt-2 p-2.5 rounded-lg bg-white/[0.03] border border-white/[0.04]">
                      <p className="text-[9px] text-white/40 uppercase font-bold mb-1">Voorgestelde Actie</p>
                      <p className="text-[11px] text-white/70 leading-snug">{item.proposed_action}</p>
                    </div>
                  )}

                  {item.impact && (
                    <div className="mt-2 p-2.5 rounded-lg bg-white/[0.03] border border-white/[0.04]">
                      <p className="text-[9px] text-white/40 uppercase font-bold mb-1">Impact</p>
                      <p className="text-[11px] text-white/70 leading-snug">{item.impact}</p>
                    </div>
                  )}

                  {/* Action buttons */}
                  <form action={decideApproval} className="mt-3 flex items-center gap-2 flex-wrap">
                    <input type="hidden" name="id" value={item.id} />
                    <input
                      type="text"
                      name="note"
                      placeholder="Optionele notitie..."
                      className="flex-1 min-w-0 px-3 py-2 text-[11px] bg-white/[0.03] border border-white/[0.06] rounded-lg text-white/80 placeholder-white/25 focus:outline-none focus:border-white/15"
                    />
                    <button
                      formAction={decideApproval}
                      type="submit"
                      name="decision"
                      value="approved"
                      className="px-3 py-2 text-[11px] font-semibold bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 rounded-lg hover:bg-emerald-500/25 transition-colors flex items-center gap-1.5"
                    >
                      <ThumbsUp size={11} />
                      Approve
                    </button>
                    <button
                      formAction={decideApproval}
                      type="submit"
                      name="decision"
                      value="declined"
                      className="px-3 py-2 text-[11px] font-semibold bg-red-500/15 border border-red-500/30 text-red-300 rounded-lg hover:bg-red-500/25 transition-colors flex items-center gap-1.5"
                    >
                      <ThumbsDown size={11} />
                      Decline
                    </button>
                    <button
                      formAction={decideApproval}
                      type="submit"
                      name="decision"
                      value="deferred"
                      className="px-3 py-2 text-[11px] font-semibold bg-white/[0.05] border border-white/[0.08] text-white/70 rounded-lg hover:bg-white/[0.08] transition-colors flex items-center gap-1.5"
                    >
                      <Clock size={11} />
                      Later
                    </button>
                  </form>
                </div>
              ))}
            </div>
          )
        })
      ) : (
        <div className="py-12 text-center bg-white/[0.02] border border-dashed border-white/10 rounded-xl">
          <ThumbsUp size={28} className="text-white/15 mx-auto mb-3" />
          <p className="text-[12px] text-white/30">Geen openstaande approvals</p>
          <p className="text-[10px] text-white/20 mt-1">AI agents zullen voorstellen plaatsen wanneer beslissingen nodig zijn</p>
        </div>
      )}

      {/* Decision history */}
      {decided.length > 0 && (
        <details className="bg-white/[0.02] border border-white/[0.06] rounded-xl">
          <summary className="px-4 py-3 cursor-pointer text-[11px] text-white/45 hover:text-white/65">
            Besloten ({decided.length})
          </summary>
          <div className="px-4 pb-3 space-y-2">
            {decided.slice(0, 25).map(item => {
              const cfg = CATEGORY_CFG[item.category] ?? CATEGORY_CFG.overig
              const decisionColor =
                item.status === 'approved'   ? 'text-emerald-400 bg-emerald-500/10'
                : item.status === 'declined' ? 'text-red-400 bg-red-500/10'
                : item.status === 'deferred' ? 'text-amber-400 bg-amber-500/10'
                : 'text-white/50 bg-white/[0.04]'
              return (
                <div key={item.id} className="p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                  <div className="flex items-center gap-2">
                    <span className={`text-[8.5px] uppercase font-bold ${cfg.color}`}>{cfg.label}</span>
                    <span className={`text-[8.5px] uppercase font-bold px-1.5 py-0.5 rounded ${decisionColor}`}>{item.status}</span>
                    <span className="text-[11px] text-white/70 flex-1 truncate">{item.title}</span>
                    <span className="text-[9px] text-white/30">{fmtDateTime(item.decided_at)}</span>
                  </div>
                  {item.decision_note && <p className="text-[10px] text-white/45 mt-1 italic">"{item.decision_note}"</p>}
                </div>
              )
            })}
          </div>
        </details>
      )}
    </div>
  )
}
