import { createAdminClient } from '@/lib/supabase/admin'
import {
  Activity, Upload, Radio, Trophy, Brain, AlertTriangle,
  Wrench, Timer, ShieldCheck, Send,
} from 'lucide-react'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ── data helpers (alle data uit live views/tabellen; defensief tegen ontbrekende objecten) ──
async function one<T = any>(p: PromiseLike<{ data: T[] | null }>): Promise<T | null> {
  try { const { data } = await p; return (data?.[0] as T) ?? null } catch { return null }
}
async function many<T = any>(p: PromiseLike<{ data: T[] | null }>): Promise<T[]> {
  try { const { data } = await p; return (data ?? []) as T[] } catch { return [] }
}

const CERT_CRITERIA: { key: string; label: string }[] = [
  { key: 'c1_no_human_7d', label: '7 dagen geen menselijke actie nodig' },
  { key: 'c2_uploads_flowing', label: 'Uploads stromen (laatste 24u)' },
  { key: 'c3_channels_healthy', label: 'Kanalen gezond (token + 0 strikes)' },
  { key: 'c4_winners_proxy', label: 'Winners / uploads laatste 7d' },
  { key: 'c5_strategy_improving', label: 'Strategie verbetert (director-cyclus 7d)' },
  { key: 'c6_incidents_detected', label: 'Incidenten worden gedetecteerd' },
  { key: 'c7_incidents_diagnosed', label: 'Incidenten gediagnosticeerd (repair-suggesties)' },
  { key: 'c8_incidents_healed', label: 'Incidenten automatisch hersteld' },
  { key: 'c9_recovery_validated', label: 'Herstel automatisch gevalideerd' },
  { key: 'c10_low_escalation', label: 'Weinig escalaties (≤ 3)' },
]

function fmt(d: string | null | undefined): string {
  if (!d) return 'nooit'
  const t = new Date(d).getTime()
  const mins = Math.round((Date.now() - t) / 60000)
  if (mins < 1) return 'zojuist'
  if (mins < 60) return `${mins} min geleden`
  if (mins < 1440) return `${Math.round(mins / 60)} u geleden`
  return `${Math.round(mins / 1440)} d geleden`
}

export default async function MediaFactoryCommandCenter() {
  const db = createAdminClient()
  const [health, up, channels, winners, cert, ceo, incOpen, incRes, repairs, validations, cycles, strategies, alertsOpen] =
    await Promise.all([
      one(db.from('v_mf_health').select('*')),
      one(db.from('v_mf_uploads').select('*')),
      many(db.from('v_mf_channels').select('*')),
      many(db.from('v_winner_intelligence').select('*').order('views', { ascending: false }).limit(6)),
      one(db.from('v_media_factory_certification').select('*')),
      one(db.from('v_ceo_minutes_daily').select('*')),
      many(db.from('infra_watchdog_incidents').select('*').eq('status', 'open').order('opened_at', { ascending: false }).limit(8)),
      many(db.from('infra_watchdog_incidents').select('*').eq('status', 'resolved').order('resolved_at', { ascending: false }).limit(5)),
      many(db.schema('hermes').from('repair_suggestions').select('*').order('created_at', { ascending: false }).limit(8)),
      many(db.schema('hermes').from('validation_runs').select('*').order('created_at', { ascending: false }).limit(5)),
      many(db.from('director_cycles').select('*').order('cycle_date', { ascending: false }).limit(3)),
      many(db.from('channel_strategy').select('channel_id,niche,updated_at').order('updated_at', { ascending: false }).limit(5)),
      many(db.from('hermes_alerts').select('*').eq('status', 'open').order('last_seen_at', { ascending: false }).limit(10)),
    ])

  const verdict: string = health?.verdict ?? 'ONBEKEND'
  const healthPct: number = health?.health_pct ?? 0
  const ceoMin: number = ceo?.ceo_minutes_estimate ?? health?.ceo_minutes ?? 0
  const ceoTarget: number = ceo?.target_minutes ?? 20
  const withinNorm = ceoMin <= ceoTarget
  const lastCycle = cycles[0]

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Activity size={16} className="text-emerald-400" />
        <h1 className="text-[15px] font-semibold text-white/90">Media Factory · Command Center</h1>
        <span className="text-[10px] text-white/40">één pagina = volledige operationele waarheid · live</span>
      </div>

      {/* 1 — HEALTH SCORE */}
      <Section title="1 · Health Score">
        <div className="flex flex-wrap items-center gap-3">
          <Verdict verdict={verdict} />
          <div className="flex-1 min-w-[180px]">
            <div className="flex justify-between text-[10px] text-white/45 mb-1">
              <span>Health</span><span>{healthPct}%</span>
            </div>
            <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden">
              <div className={`h-full ${healthPct >= 80 ? 'bg-emerald-400' : healthPct >= 50 ? 'bg-amber-400' : 'bg-red-400'}`} style={{ width: `${healthPct}%` }} />
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <KV k="CEO-min/dag" v={`${ceoMin} / ${ceoTarget}`} tone={withinNorm ? 'emerald' : 'amber'} />
            <KV k="Certificering" v={cert?.status ?? '—'} tone={cert?.status === 'CERTIFIED' ? 'emerald' : 'amber'} />
            <KV k="Open incidenten" v={health?.open_incidents ?? 0} tone={health?.open_incidents ? 'amber' : 'emerald'} />
            <KV k="Mens-vereist" v={(health?.open_escalations ?? 0) + (health?.open_critical ?? 0)} tone={(health?.open_escalations ?? 0) + (health?.open_critical ?? 0) ? 'amber' : 'emerald'} />
          </div>
        </div>
      </Section>

      {/* 2 — UPLOADS & PUBLICATIES */}
      <Section title="2 · Uploads & Publicaties" icon={<Upload size={12} />}>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
          <KV k="Uploads vandaag" v={up?.uploads_today ?? 0} tone="emerald" />
          <KV k="Uploads week" v={up?.uploads_week ?? 0} />
          <KV k="Uploads maand" v={up?.uploads_month ?? 0} />
          <KV k="Publicaties vandaag" v={up?.pubs_today ?? 0} tone={up?.pubs_today ? 'emerald' : 'amber'} />
          <KV k="Publicaties maand" v={up?.pubs_month ?? 0} />
          <KV k="Backlog" v={up?.backlog ?? 0} tone={(up?.backlog ?? 0) > 200 ? 'amber' : undefined} />
          <KV k="Vereisen aandacht" v={up?.needs_attention ?? 0} tone={(up?.needs_attention ?? 0) > 50 ? 'amber' : undefined} />
          <KV k="Privé, wacht op publiek" v={up?.uploaded_private_pending_public ?? 0} tone={(up?.uploaded_private_pending_public ?? 0) > 0 ? 'amber' : undefined} />
          <KV k="Laatste upload" v={fmt(up?.last_upload_at)} />
          <KV k="Laatste publicatie" v={fmt(up?.last_publication_at)} tone="amber" />
          <KV k="Oudste backlog-item" v={fmt(up?.oldest_backlog_item)} />
          <KV k="Privé sinds" v={fmt(up?.oldest_private_since)} />
        </div>
      </Section>

      {/* 3 — KANALENSTATUS */}
      <Section title="3 · Kanalenstatus" icon={<Radio size={12} />}>
        <Table
          head={['Kanaal', 'Status', 'Subs', 'Upl 24u', 'Upl 7d', 'Views 24u', 'Views 7d', 'Rev 30d', 'Laatste upload', 'Probleem']}
          rows={channels.map((c) => [
            <Dot key="d" kleur={c.status_kleur} label={c.kanaal} />,
            c.status_kleur, c.subscribers, c.uploads_24u, c.uploads_7d,
            c.views_24u, c.views_7d, `€${Number(c.revenue_30d ?? 0).toFixed(0)}`,
            fmt(c.last_upload_at), c.probleem ?? '—',
          ])}
        />
      </Section>

      {/* 4 — WINNERS */}
      <Section title="4 · Winners" icon={<Trophy size={12} />}>
        <Table
          head={['Titel', 'Kanaal', 'Niche', 'Views', 'CTR', 'Retentie', 'Hook', 'Status', 'Waarom']}
          rows={winners.map((w) => [
            (w.title ?? '—')?.slice(0, 44), w.channel ?? '—', w.niche ?? '—',
            w.views ?? 0, w.ctr != null ? `${w.ctr}%` : '—', w.retention != null ? `${w.retention}%` : '—',
            w.hook_score ?? '—', w.winner_status ?? '—', (w.why_winner ?? '—')?.slice(0, 40),
          ])}
        />
      </Section>

      {/* 5 — STRATEGIE-AANPASSINGEN */}
      <Section title="5 · Strategie-aanpassingen" icon={<Brain size={12} />}>
        {lastCycle ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-2">
            <KV k="Laatste director-cyclus" v={fmt(lastCycle.created_at ?? lastCycle.cycle_date)} />
            <KV k="Fase" v={lastCycle.phase ?? '—'} />
            <KV k="Autonoom gedispatcht" v={Array.isArray(lastCycle.autonomous_dispatched) ? lastCycle.autonomous_dispatched.length : (lastCycle.autonomous_dispatched ?? 0)} tone="emerald" />
            <KV k="Strategie-profielen" v={strategies.length} />
          </div>
        ) : <div className="text-[11px] text-white/35 mb-2">Nog geen director-cyclus — strategie-loop wordt in Fase 4 autonoom ingepland.</div>}
        <Table head={['Cyclus', 'Fase', 'Samenvatting']}
          rows={cycles.map((c) => [c.cycle_date ?? '—', c.phase ?? '—', (c.summary ?? '—')?.slice(0, 80)])} />
      </Section>

      {/* 6 — INCIDENTEN */}
      <Section title="6 · Incidenten (stond vast → root cause → actie → resultaat → mens nodig)" icon={<AlertTriangle size={12} />}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-2">
          <KV k="Open incidenten" v={incOpen.length} tone={incOpen.length ? 'amber' : 'emerald'} />
          <KV k="Automatisch opgelost (recent)" v={incRes.length} tone="emerald" />
          <KV k="Open alerts" v={alertsOpen.length} tone={alertsOpen.length ? 'amber' : 'emerald'} />
          <KV k="Mens-vereist" v={alertsOpen.filter((a) => a.severity === 'critical').length} tone={alertsOpen.some((a) => a.severity === 'critical') ? 'amber' : 'emerald'} />
        </div>
        <Table head={['Open incident', 'Soort', 'Root cause', 'Sinds', 'Voorgestelde actie']}
          rows={incOpen.map((i) => [
            i.service_name ?? i.check_slug ?? '—', i.failure_kind ?? i.incident_kind ?? '—',
            (i.failure_summary ?? '—')?.slice(0, 50), fmt(i.opened_at),
            i.proposed_actions ? 'voorstel aanwezig' : '—',
          ])} />
        {incRes.length > 0 && (
          <div className="mt-2">
            <div className="text-[10.5px] text-white/45 mb-1">Recent automatisch hersteld</div>
            <Table head={['Incident', 'Soort', 'Hersteld']}
              rows={incRes.map((i) => [i.service_name ?? i.check_slug ?? '—', i.failure_kind ?? '—', fmt(i.resolved_at)])} />
          </div>
        )}
      </Section>

      {/* 7 — RECOVERY STATUS */}
      <Section title="7 · Recovery Status (detect → diagnose → repair → verify → report)" icon={<Wrench size={12} />}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <div className="text-[10.5px] text-white/45 mb-1">Diagnoses / repair-suggesties</div>
            <Table head={['Soort', 'Titel', 'Vertrouwen', 'Status', 'Aangemaakt']}
              rows={repairs.map((r) => [r.kind ?? '—', (r.title ?? '—')?.slice(0, 36), r.confidence ?? '—', r.status ?? '—', fmt(r.created_at)])} />
          </div>
          <div>
            <div className="text-[10.5px] text-white/45 mb-1">Validatie-runs (verify)</div>
            <Table head={['Soort', 'Status', 'Pass', 'Fail', 'Score', 'Wanneer']}
              rows={validations.map((v) => [v.run_kind ?? '—', v.status ?? '—', v.passed ?? '—', v.failed ?? '—', v.production_score ?? '—', fmt(v.finished_at ?? v.created_at)])} />
          </div>
        </div>
        <div className="text-[10px] text-white/35 mt-1">Volledige detect→diagnose→repair→verify→report-keten wordt in Fase 3 (Media-Medic) gesloten en vult deze sectie automatisch.</div>
      </Section>

      {/* 8 — CEO MINUTES PER DAY */}
      <Section title="8 · CEO Minutes Per Day (hoofd-KPI)" icon={<Timer size={12} />}>
        <div className="flex flex-wrap items-center gap-3">
          <div className="bg-white/[0.04] border border-white/[0.06] rounded-lg p-3 min-w-[140px]">
            <div className="text-[10px] uppercase tracking-wide text-white/45">Geschat vandaag</div>
            <div className={`text-2xl font-bold ${withinNorm ? 'text-emerald-400' : 'text-amber-400'}`}>{ceoMin} min</div>
            <div className="text-[10px] text-white/40">norm &lt; {ceoTarget} min · {withinNorm ? 'binnen norm' : 'boven norm'}</div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 flex-1">
            <KV k="Manual reviews" v={ceo?.manual_reviews ?? '—'} />
            <KV k="Falende checks" v={ceo?.failing_checks ?? '—'} />
            <KV k="Open incidenten" v={ceo?.open_incidents ?? '—'} />
            <KV k="Open escalaties" v={ceo?.open_escalations ?? '—'} />
          </div>
        </div>
        <div className="text-[10px] text-white/35 mt-1">{ceo?.norm ?? 'review 2m · failing-check 5m · incident 10m · escalation 5m'}</div>
      </Section>

      {/* 9 — 7-DAGEN AUTONOMY CERTIFICATION */}
      <Section title="9 · 7-Dagen Autonomy Certification" icon={<ShieldCheck size={12} />}>
        <div className="mb-2">
          <span className={`text-[12px] font-semibold px-2 py-0.5 rounded ${cert?.status === 'CERTIFIED' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'}`}>
            {cert?.status ?? 'NOT_CERTIFIED'}
          </span>
          <span className="text-[10px] text-white/40 ml-2">de fabriek is pas klaar als alle 10 criteria groen zijn én CEO-min &lt; {ceoTarget}</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1">
          {CERT_CRITERIA.map((c) => {
            const ok = !!cert?.[c.key]
            return (
              <div key={c.key} className="flex items-center gap-2 text-[11px]">
                <span className={ok ? 'text-emerald-400' : 'text-white/30'}>{ok ? '●' : '○'}</span>
                <span className={ok ? 'text-white/75' : 'text-white/45'}>{c.label}</span>
              </div>
            )
          })}
        </div>
      </Section>

      {/* 10 — DAILY DIGEST */}
      <Section title="10 · Daily Digest (1×/dag Telegram — exact dezelfde waarheid)" icon={<Send size={12} />}>
        <pre className="text-[11px] leading-relaxed text-white/70 whitespace-pre-wrap bg-white/[0.02] border border-white/[0.05] rounded-md p-3">
{`📊 Media Factory · dagrapport
Health: ${verdict} (${healthPct}%) · CEO-minuten: ${ceoMin}/${ceoTarget}
Uploads vandaag: ${up?.uploads_today ?? 0} · publicaties vandaag: ${up?.pubs_today ?? 0}
Laatste publicatie: ${fmt(up?.last_publication_at)} · backlog: ${up?.backlog ?? 0}
Nieuwe winners (top): ${winners[0]?.title ? winners[0].title.slice(0, 40) : 'geen'}
Strategie-update: ${lastCycle ? `${lastCycle.phase ?? 'cyclus'} (${fmt(lastCycle.created_at ?? lastCycle.cycle_date)})` : 'geen'}
Open incidenten: ${incOpen.length} · automatisch opgelost: ${incRes.length}
Menselijke actie nodig: ${(health?.open_escalations ?? 0) + (health?.open_critical ?? 0) > 0 ? 'JA' : 'nee'}`}
        </pre>
        <div className="text-[10px] text-white/35 mt-1">De daadwerkelijke once-daily verzending wordt via de Engine Planner ingepland (migratie + functie in deze PR).</div>
      </Section>
    </div>
  )
}

// ── presentational helpers (overgenomen uit hermes/control-center voor consistente styling) ──
function Verdict({ verdict }: { verdict: string }) {
  const map: Record<string, string> = {
    'GEZOND': 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    'LET OP': 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    'INCIDENT': 'bg-orange-500/20 text-orange-300 border-orange-500/30',
    'MENSELIJKE ACTIE NODIG': 'bg-red-500/20 text-red-300 border-red-500/30',
  }
  return <div className={`text-[14px] font-bold px-3 py-1.5 rounded-lg border ${map[verdict] ?? 'bg-white/10 text-white/70 border-white/10'}`}>{verdict}</div>
}
function Dot({ kleur, label }: { kleur: string; label: string }) {
  const c = kleur === 'groen' ? 'bg-emerald-400' : kleur === 'oranje' ? 'bg-amber-400' : kleur === 'rood' ? 'bg-red-400' : 'bg-white/30'
  return <span className="flex items-center gap-1.5"><span className={`inline-block w-2 h-2 rounded-full ${c}`} />{label}</span>
}
function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
      <h2 className="flex items-center gap-1.5 text-[12px] font-semibold text-white/80 mb-2">{icon}{title}</h2>
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
function Table({ head, rows }: { head: string[]; rows: (React.ReactNode)[][] }) {
  if (rows.length === 0) return <div className="text-[11px] text-white/35 p-1">Nog geen data.</div>
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
