import { createAdminClient } from '@/lib/supabase/admin'
import { Activity, Cpu, Coins, Boxes, AlertTriangle, TrendingUp } from 'lucide-react'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const PROJECTS = ['Aquier', 'SterkCalc', 'Vastgoed Core OS', 'STRKBOUW', 'STRKBEHEER', 'YouTube Engine', 'Affiliate Engine', 'Trading Engine', 'Administratie', 'Marketing']

async function v(db: ReturnType<typeof createAdminClient>, view: string, opts?: { single?: boolean; limit?: number }) {
  try {
    let q = db.schema('hermes').from(view).select('*')
    if (opts?.limit) q = q.limit(opts.limit)
    const { data } = await q
    return opts?.single ? (data?.[0] ?? null) : (data ?? [])
  } catch {
    return opts?.single ? null : []
  }
}

export default async function HermesControlCenter() {
  const db = createAdminClient()
  const [cc, tok, models, projects, skills, agents, playbooks, failures, skillPerf] = await Promise.all([
    v(db, 'v_control_center', { single: true }) as Promise<any>,
    v(db, 'v_token_intelligence', { single: true }) as Promise<any>,
    v(db, 'v_model_usage') as Promise<any[]>,
    v(db, 'v_project_usage') as Promise<any[]>,
    v(db, 'v_skill_usage', { limit: 8 }) as Promise<any[]>,
    v(db, 'v_agent_usage', { limit: 8 }) as Promise<any[]>,
    v(db, 'v_playbook_usage', { limit: 8 }) as Promise<any[]>,
    v(db, 'v_failure_intelligence', { limit: 8 }) as Promise<any[]>,
    v(db, 'v_skill_performance', { limit: 8 }) as Promise<any[]>,
  ])

  // Systeem-checks (router/ollama = process-laag → afgeleid uit recente activiteit + queue).
  const queue = cc?.queue_depth ?? 0
  const inFlight = cc?.in_flight ?? 0

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Activity size={16} className="text-emerald-400" />
        <h1 className="text-[15px] font-semibold text-white/90">Hermes Control Center</h1>
        <span className="text-[10px] text-white/40">live observability · alle data uit hermes-views</span>
      </div>

      {/* Systeem + Routing */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
        <Tile icon={<Boxes size={12} />} label="Requests 24u" value={cc?.requests_24h ?? 0} />
        <Tile icon={<Boxes size={12} />} label="Plannen 24u" value={cc?.plans_24h ?? 0} />
        <Tile icon={<AlertTriangle size={12} />} label="Incidenten 24u" value={cc?.incidents_24h ?? 0} tone={cc?.incidents_24h ? 'amber' : undefined} />
        <Tile icon={<TrendingUp size={12} />} label="Success rate" value={`${cc?.success_rate_pct ?? '—'}%`} tone="emerald" />
        <Tile icon={<Cpu size={12} />} label="Queue / in-flight" value={`${queue} / ${inFlight}`} />
        <Tile icon={<Cpu size={12} />} label="Escalaties 24u" value={cc?.escalations_24h ?? 0} />
      </div>

      {/* Token intelligence */}
      <Section title="Token Intelligence (24u) — lokaal vs all-Claude">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-[12px]">
          <KV k="Lokaal" v={`${tok?.local_calls ?? 0} (${tok?.local_pct ?? 0}%)`} tone="emerald" />
          <KV k="GPT" v={tok?.gpt_calls ?? 0} />
          <KV k="Claude" v={tok?.claude_calls ?? 0} tone="amber" />
          <KV k="Werkelijke kosten" v={`$${tok?.actual_cost_usd ?? 0}`} />
          <KV k="Bespaard vs Claude" v={`$${tok?.savings_usd ?? 0}`} tone="emerald" />
        </div>
        <div className="text-[10.5px] text-white/40 mt-1">
          Theoretisch (alles via Claude): ${tok?.theoretical_all_claude_usd ?? 0} · {tok?.in_tokens ?? 0} in / {tok?.out_tokens ?? 0} out tokens
        </div>
      </Section>

      {/* Modellen */}
      <Section title="Modellen — calls / tokens / kosten">
        <Table head={['Provider', 'Calls', 'In-tok', 'Out-tok', 'Kosten $']}
          rows={models.map((m) => [m.provider, m.calls, m.in_tokens, m.out_tokens, m.cost_usd])} />
      </Section>

      {/* Projecten (alle 10) */}
      <Section title="Projecten — plannen (24u / 7d / 30d)">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          {PROJECTS.map((p) => {
            const row = projects.find((x) => x.project === p)
            return (
              <div key={p} className="p-2 rounded-md bg-white/[0.02] border border-white/[0.05]">
                <div className="text-[11px] text-white/75">{p}</div>
                <div className="text-[10px] text-white/45">{row?.plans_24h ?? 0} / {row?.plans_7d ?? 0} / {row?.plans_30d ?? 0}</div>
              </div>
            )
          })}
        </div>
      </Section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Section title="Top skills (30d)">
          <Table head={['Skill', '24u', '7d', '30d']} rows={skills.map((s) => [s.skill, s.uses_24h, s.uses_7d, s.uses_30d])} />
        </Section>
        <Section title="Top agents (30d)">
          <Table head={['Agent', '24u', '7d', '30d']} rows={agents.map((a) => [a.agent, a.uses_24h, a.uses_7d, a.uses_30d])} />
        </Section>
        <Section title="Top playbooks (30d)">
          <Table head={['Playbook', '24u', '7d', '30d']} rows={playbooks.map((p) => [p.playbook, p.uses_24h, p.uses_7d, p.uses_30d])} />
        </Section>
        <Section title="Failure intelligence">
          <Table head={['Type', 'Project', 'Freq', 'Opgelost %']} rows={failures.map((f) => [f.failure_type, f.project, f.frequency, f.resolution_pct ?? '—'])} />
        </Section>
        <Section title="Skill-performance (self-optimization)">
          <Table head={['Skill', 'Runs', 'Succes', 'Succes %']} rows={skillPerf.map((s) => [s.skill, s.runs, s.successes, s.success_pct ?? '—'])} />
        </Section>
      </div>
    </div>
  )
}

function Tile({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: React.ReactNode; tone?: 'emerald' | 'amber' }) {
  const c = tone === 'emerald' ? 'text-emerald-400' : tone === 'amber' ? 'text-amber-400' : 'text-white/90'
  return (
    <div className="bg-white/[0.04] border border-white/[0.06] rounded-lg p-3">
      <div className="flex items-center gap-1.5 text-white/45 text-[10px] uppercase tracking-wide">{icon}{label}</div>
      <div className={`text-lg font-semibold ${c} mt-0.5`}>{value}</div>
    </div>
  )
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
      <h2 className="text-[12px] font-semibold text-white/80 mb-2">{title}</h2>
      {children}
    </section>
  )
}
function KV({ k, v, tone }: { k: string; v: React.ReactNode; tone?: 'emerald' | 'amber' }) {
  const c = tone === 'emerald' ? 'text-emerald-300' : tone === 'amber' ? 'text-amber-300' : 'text-white/85'
  return (
    <div className="p-2 rounded-md bg-white/[0.02] border border-white/[0.05]">
      <div className="text-[10px] text-white/45">{k}</div>
      <div className={`text-[13px] font-medium ${c}`}>{v}</div>
    </div>
  )
}
function Table({ head, rows }: { head: string[]; rows: (string | number | null)[][] }) {
  if (rows.length === 0) return <div className="text-[11px] text-white/35 p-1">Nog geen data — bouwt op via live routing.</div>
  return (
    <table className="w-full text-[11px]">
      <thead><tr className="text-white/40 text-left">{head.map((h) => <th key={h} className="font-normal pb-1">{h}</th>)}</tr></thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className="border-t border-white/[0.04]">
            {r.map((c, j) => <td key={j} className="py-1 text-white/75">{c ?? '—'}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
