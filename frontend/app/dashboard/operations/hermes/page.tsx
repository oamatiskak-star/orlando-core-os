import { createAdminClient } from '@/lib/supabase/admin'
import Link from 'next/link'
import { Cpu, ArrowRightLeft, ShieldAlert, Gauge, ScanLine, Bot } from 'lucide-react'
import RoutingPlanPanel from '@/components/dashboard/hermes/RoutingPlanPanel'

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

async function count(db: ReturnType<typeof createAdminClient>, schema: string, table: string, build: (q: any) => any) {
  try {
    let q = (db as any).schema(schema).from(table).select('id', { count: 'exact', head: true })
    q = build(q)
    const { count } = await q
    return count ?? 0
  } catch { return 0 }
}

export default async function HermesCockpitPage() {
  const db = createAdminClient()
  let unavailable = false
  let agent: any = null
  let hosts: any[] = []
  let scores: any[] = []
  let skills = { total: 0, enabled: 0 }
  let ceoRun: any = null
  const dispatch = { queued: 0, claimed: 0, running: 0, done: 0, failed: 0 }
  const errs = { critical: 0, high: 0, medium: 0, low: 0 }
  let routes = 0, orphans = 0, escalationsOpen = 0, approvalsPending = 0

  try {
    const h = db.schema('hermes')
    const [agentRes, hostsRes, scoreRes, skillsAll, skillsEn, ceoRes] = await Promise.all([
      h.from('agent_state').select('status,last_heartbeat_at,last_tick_at').order('last_heartbeat_at', { ascending: false }).limit(1).maybeSingle(),
      h.from('hosts').select('host_id,label,role,active,last_seen_at').order('host_id'),
      h.from('production_scores').select('dimension,score,severity,computed_at').order('computed_at', { ascending: false }).limit(60),
      count(db, 'hermes', 'skills', (q) => q),
      count(db, 'hermes', 'skills', (q) => q.eq('enabled', true)),
      db.from('ai_ceo_runs').select('summary,created_at,autonomous_dispatched,approval_queued').order('created_at', { ascending: false }).limit(1).maybeSingle(),
    ])
    if (hostsRes.error) unavailable = true
    agent = agentRes.data
    hosts = hostsRes.data ?? []
    skills = { total: skillsAll, enabled: skillsEn }
    ceoRun = ceoRes.data

    // dispatch counts
    for (const s of ['queued', 'claimed', 'running', 'done', 'failed'] as const) {
      dispatch[s] = await count(db, 'hermes', 'dispatch_queue', (q) => q.eq('status', s))
    }
    // open validation errors per severity
    for (const sev of ['critical', 'high', 'medium', 'low'] as const) {
      errs[sev] = await count(db, 'hermes', 'validation_errors', (q) => q.eq('status', 'open').eq('severity', sev))
    }
    routes = await count(db, 'hermes', 'route_registry', (q) => q)
    orphans = await count(db, 'hermes', 'route_registry', (q) => q.eq('is_orphan', true))
    escalationsOpen = await count(db, 'hermes', 'escalations', (q) => q.in('status', ['pending', 'sending', 'sent']))
    approvalsPending = await count(db, 'public', 'approval_queue', (q) => q.in('status', ['pending', 'awaiting_approval']))

    // latest score per dimension
    const seen = new Set<string>()
    scores = (scoreRes.data ?? []).filter((r: any) => (seen.has(r.dimension) ? false : (seen.add(r.dimension), true)))
  } catch {
    unavailable = true
  }

  const sevColor: Record<string, string> = {
    critical: 'text-red-300 bg-red-500/10', high: 'text-amber-300 bg-amber-500/10',
    medium: 'text-sky-300 bg-sky-500/10', low: 'text-emerald-300 bg-emerald-500/10',
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Gauge size={16} className="text-emerald-400" />
        <h1 className="text-[15px] font-semibold text-white/90">Hermes Cockpit — OpenClaw</h1>
      </div>

      {unavailable ? (
        <div className="p-4 rounded-xl border border-dashed border-amber-500/30 bg-amber-500/[0.04] text-[12px] text-amber-300/90">
          Hermes-schema niet bereikbaar — migraties 109/110 nog niet toegepast op deze database.
        </div>
      ) : (
        <>
          {/* Status-strip */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
            <Tile icon={<Bot size={12} />} label="Hermes-agent" value={agent?.status ?? 'onbekend'} sub={ago(agent?.last_heartbeat_at)} />
            <Tile icon={<Cpu size={12} />} label="Capabilities" value={`${skills.enabled}/${skills.total}`} sub="enabled/registry" />
            <Tile icon={<ArrowRightLeft size={12} />} label="Dispatch queued" value={dispatch.queued} sub={`${dispatch.running} running · ${dispatch.done} done`} />
            <Tile icon={<ScanLine size={12} />} label="Routes" value={routes} sub={`${orphans} orphan`} />
            <Tile icon={<ShieldAlert size={12} />} label="Open findings" value={errs.critical + errs.high + errs.medium + errs.low} sub={`${errs.critical} crit · ${errs.high} high`} />
            <Tile icon={<ShieldAlert size={12} />} label="Escalaties" value={escalationsOpen} sub={`${approvalsPending} CEO-approvals`} />
          </div>

          {/* Routing-brein (self-routing AI OS) */}
          <RoutingPlanPanel />

          {/* Hosts */}
          <Section title="Hosts (CLI-L / CLI-R)" href="/dashboard/operations/dispatch" hrefLabel="Naar dispatch-bord →">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {hosts.map((h) => (
                <div key={h.host_id} className="flex items-center justify-between p-2.5 rounded-md bg-white/[0.02] border border-white/[0.05]">
                  <div><span className="font-mono text-emerald-300 text-[12px]">{h.host_id}</span> <span className="text-white/45 text-[11px]">· {h.role}</span><div className="text-[10.5px] text-white/40">{h.label}</div></div>
                  <div className="text-right text-[10.5px]"><span className={h.active ? 'text-emerald-400' : 'text-white/40'}>{h.active ? 'actief' : 'inactief'}</span><div className="text-white/40">{ago(h.last_seen_at)}</div></div>
                </div>
              ))}
              {hosts.length === 0 && <div className="text-[11px] text-white/35 p-2">Geen hosts geregistreerd.</div>}
            </div>
          </Section>

          {/* Production readiness */}
          <Section title="Production readiness (per dimensie)" href="/dashboard/operations/dispatch" hrefLabel="">
            {scores.length === 0 ? (
              <div className="text-[11px] text-white/35 p-2">Nog geen scores — draai de platform-validator (P4).</div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {scores.map((s) => (
                  <div key={s.dimension} className="p-2.5 rounded-md bg-white/[0.02] border border-white/[0.05]">
                    <div className="flex items-center justify-between"><span className="text-[11px] text-white/70 capitalize">{s.dimension}</span>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded ${sevColor[s.severity] || 'text-white/50 bg-white/[0.06]'}`}>{s.severity ?? '—'}</span></div>
                    <div className="text-lg font-semibold text-white/90">{Number(s.score).toFixed(0)}<span className="text-[10px] text-white/40">/100</span></div>
                    <div className="text-[9.5px] text-white/35">{ago(s.computed_at)}</div>
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* Orlando O */}
          <Section title="Orlando O (AI CEO)" href="" hrefLabel="">
            {ceoRun ? (
              <div className="text-[11.5px] text-white/70">
                <div className="text-white/45 text-[10px]">{ago(ceoRun.created_at)} · {ceoRun.autonomous_dispatched ?? 0} autonoom · {ceoRun.approval_queued ?? 0} ter goedkeuring</div>
                <div className="mt-1">{ceoRun.summary ?? '—'}</div>
              </div>
            ) : (
              <div className="text-[11px] text-white/35">Nog geen CEO-run (ai_ceo_runs leeg) — Orlando O is geïnstalleerd maar heeft nog niet gedraaid.</div>
            )}
          </Section>
        </>
      )}
    </div>
  )
}

function Tile({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="bg-white/[0.04] border border-white/[0.06] rounded-lg p-3">
      <div className="flex items-center gap-1.5 text-white/45 text-[10px] uppercase tracking-wide">{icon}{label}</div>
      <div className="text-lg font-semibold text-white/90 mt-0.5">{value}</div>
      {sub && <div className="text-[10px] text-white/35">{sub}</div>}
    </div>
  )
}

function Section({ title, href, hrefLabel, children }: { title: string; href: string; hrefLabel: string; children: React.ReactNode }) {
  return (
    <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[12px] font-semibold text-white/85">{title}</h3>
        {href && hrefLabel && <Link href={href} className="text-[10.5px] text-emerald-400/90 hover:text-emerald-300">{hrefLabel}</Link>}
      </div>
      {children}
    </div>
  )
}
