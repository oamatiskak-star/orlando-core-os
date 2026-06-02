import { createAdminClient } from '@/lib/supabase/admin'
import { ShieldCheck, ShieldAlert, Bot } from 'lucide-react'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function ago(ts: string | null): string {
  if (!ts) return '—'
  const s = Math.floor((Date.now() - new Date(ts).getTime()) / 1000)
  if (s < 60) return `${s}s geleden`
  if (s < 3600) return `${Math.floor(s / 60)}m geleden`
  if (s < 86400) return `${Math.floor(s / 3600)}u geleden`
  return `${Math.floor(s / 86400)}d geleden`
}

type Decision = {
  id: number
  created_at: string
  host: string | null
  project: string | null
  tool_name: string | null
  kind: string | null
  decision: string
  would_allow: boolean
  live: boolean
  prompt: string | null
  reason: string | null
}

type Rule = {
  id: number
  kind: string
  matcher: string
  pattern: string
  decision: string
  enabled: boolean
  reason: string | null
}

export default async function AutopilotPage() {
  const db = createAdminClient()
  let decisions: Decision[] = []
  let rules: Rule[] = []
  let unavailable = false

  try {
    const h = db.schema('hermes')
    const [decRes, ruleRes] = await Promise.all([
      h.from('v_autopilot_recent').select('*').limit(50),
      h.from('governance_rules').select('id,kind,matcher,pattern,decision,enabled,reason').order('priority', { ascending: false }),
    ])
    decisions = (decRes.data as Decision[]) ?? []
    rules = (ruleRes.data as Rule[]) ?? []
  } catch {
    unavailable = true
  }

  const total = decisions.length
  const wouldAllow = decisions.filter(d => d.would_allow).length
  const autoAllowed = decisions.filter(d => d.decision === 'allow').length
  const anyLive = decisions.some(d => d.live)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Bot size={18} className="text-cyan-400" />
        <h1 className="text-base font-semibold text-white">Autopilot — Claude Code 1/2/3</h1>
        <span
          className={`ml-2 text-[10px] px-2 py-0.5 rounded-full ${
            anyLive ? 'bg-emerald-500/15 text-emerald-300' : 'bg-amber-500/15 text-amber-300'
          }`}
        >
          {anyLive ? 'LIVE' : 'DRY-RUN'}
        </span>
      </div>

      {unavailable ? (
        <p className="text-xs text-red-300">Hermes-schema niet bereikbaar (migratie 126 toegepast?).</p>
      ) : (
        <>
          {/* Tellingen */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Beslissingen (50)', value: total },
              { label: 'Zou goedkeuren', value: wouldAllow },
              { label: 'Echt goedgekeurd', value: autoAllowed },
              { label: 'Naar Orlando (ask)', value: total - autoAllowed },
            ].map(c => (
              <div key={c.label} className="bg-white/[0.06] border border-white/10 rounded-xl p-4">
                <div className="text-2xl font-semibold text-white">{c.value}</div>
                <div className="text-[11px] text-white/50 mt-1">{c.label}</div>
              </div>
            ))}
          </div>

          {/* Recente beslissingen */}
          <div className="bg-white/[0.04] border border-white/10 rounded-xl overflow-hidden">
            <div className="px-4 py-2.5 text-xs font-semibold text-white/70 border-b border-white/10">
              Recente beslissingen
            </div>
            {decisions.length === 0 ? (
              <p className="text-xs text-white/40 p-4">Nog geen beslissingen. Start een Claude Code sessie met de hook actief.</p>
            ) : (
              <div className="divide-y divide-white/5">
                {decisions.map(d => (
                  <div key={d.id} className="flex items-center gap-3 px-4 py-2 text-xs">
                    <span
                      className={`shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded ${
                        d.decision === 'allow'
                          ? 'bg-emerald-500/15 text-emerald-300'
                          : 'bg-white/10 text-white/60'
                      }`}
                    >
                      {d.decision === 'allow' ? <ShieldCheck size={11} /> : <ShieldAlert size={11} />}
                      {d.decision}
                    </span>
                    <span className="shrink-0 text-white/70 w-28 truncate">{d.tool_name ?? '—'}</span>
                    <span className="flex-1 text-white/50 truncate">{d.prompt ?? d.reason ?? '—'}</span>
                    {d.would_allow && !d.live && (
                      <span className="shrink-0 text-amber-300/80">zou goedkeuren</span>
                    )}
                    <span className="shrink-0 text-white/30 w-20 text-right">{ago(d.created_at)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Governance-regels */}
          <div className="bg-white/[0.04] border border-white/10 rounded-xl overflow-hidden">
            <div className="px-4 py-2.5 text-xs font-semibold text-white/70 border-b border-white/10">
              Governance-regels ({rules.length}) — hard default-deny: niet-gematcht = jij beslist
            </div>
            <div className="divide-y divide-white/5">
              {rules.map(r => (
                <div key={r.id} className="flex items-center gap-3 px-4 py-1.5 text-xs">
                  <span
                    className={`shrink-0 w-14 ${
                      r.decision === 'allow' ? 'text-emerald-300' : r.decision === 'deny' ? 'text-red-300' : 'text-white/50'
                    }`}
                  >
                    {r.decision}
                  </span>
                  <span className="shrink-0 text-white/40 w-32">{r.kind}</span>
                  <span className="flex-1 text-white/70 font-mono">{r.pattern}</span>
                  <span className="shrink-0 text-white/30">{r.enabled ? '' : 'uit'}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
